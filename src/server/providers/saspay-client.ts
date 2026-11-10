import 'server-only';
import type { z } from 'zod';
import { createFakeSaspay, type FakeSaspay } from './saspay-fake';
import {
  ratesSchema,
  sessionCreatedSchema,
  sessionStatusSchema,
  verificationSchema,
  verifyWebhookSignature,
  type SaspayApi,
} from './saspay-types';
import { loadServerEnv } from '@/server/env';
import { ApiError, apiError } from '@/server/http/api-error';

export { createFakeSaspay } from './saspay-fake';
export type { SaspayApi } from './saspay-types';

export interface SaspayClientOptions {
  apiUrl: string;
  apiKey: string;
  webhookSecret?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Client de l'API SasPay. La clé part dans l'en-tête Authorization (jamais dans l'adresse).
 * Toute panne devient une ApiError générique : ni la clé ni le message brut ne remontent.
 * Aucune reprise automatique, surtout pas pour la création d'une session (double paiement).
 */
export function createSaspayClient(options: SaspayClientOptions): SaspayApi {
  const { apiUrl, apiKey, webhookSecret, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const doFetch = options.fetch ?? fetch;
  const base = apiUrl.replace(/\/+$/, '');

  /** Appelle SasPay et renvoie `data` validé par `schema`. */
  async function call<S extends z.ZodType>(
    path: string,
    schema: S,
    body?: Record<string, unknown>,
  ): Promise<z.output<S>> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    let envelope: unknown;
    try {
      const res = await doFetch(`${base}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          authorization: `Bearer ${apiKey}`,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      if (!res.ok) apiError('PROVIDER_ERROR');
      envelope = JSON.parse(await res.text());
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const isTimeout = timedOut || (e instanceof Error && e.name === 'TimeoutError');
      return apiError(isTimeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR');
    } finally {
      clearTimeout(timer);
    }
    // Enveloppe { success, data | error, code } : une erreur métier peut arriver en HTTP 200.
    if (typeof envelope !== 'object' || envelope === null) return apiError('PROVIDER_ERROR');
    const { success, data } = envelope as { success?: unknown; data?: unknown };
    if (success !== true) return apiError('PROVIDER_ERROR');
    const parsed = schema.safeParse(data);
    if (!parsed.success) return apiError('PROVIDER_ERROR');
    return parsed.data;
  }

  return {
    async createCheckoutSession(p) {
      const data = await call('/checkout-sessions/', sessionCreatedSchema, {
        amount: p.amount,
        currency: p.currency,
        customer_email: p.customerEmail,
        customer_name: p.customerName,
        customer_phone: p.customerPhone,
        country: p.country,
        return_url: p.returnUrl,
        metadata: p.metadata,
        fee_charge_mode: p.feeChargeMode,
        expires_at: p.expiresAt,
      });
      return { sessionId: data.id, checkoutUrl: data.checkout_url };
    },

    async getCheckoutSessionStatus(sessionId) {
      const data = await call(
        `/checkout-sessions/${encodeURIComponent(sessionId)}/status/`,
        sessionStatusSchema,
      );
      return { status: data.status, transactionId: data.transaction?.id ?? null };
    },

    async verifyPayment(transactionId) {
      const data = await call(
        `/payments/${encodeURIComponent(transactionId)}/verify/`,
        verificationSchema,
      );
      return {
        status: data.status,
        netAmount: data.net_amount,
        fee: data.fee,
        charged: data.charged,
        currency: data.currency,
      };
    },

    async getMyRates() {
      const data = await call('/pricing/my-rates/', ratesSchema);
      return data.map((r) => ({ network: r.network, feePct: r.fee_pct }));
    },

    verifyWebhook: (rawBody, signature, timestamp) =>
      verifyWebhookSignature(webhookSecret, rawBody, signature, timestamp),
  };
}

let sharedFake: FakeSaspay | null = null;

/** Le faux SasPay du processus (mode test) : mêmes sessions pour le code serveur et pour les tests. */
export function getFakeSaspay(): FakeSaspay {
  return (sharedFake ??= createFakeSaspay({
    webhookSecret: loadServerEnv().SASPAY_WEBHOOK_SECRET,
  }));
}

/**
 * Faux SasPay en mode test sans clé ; vrai client dès qu'une clé est fournie.
 * Le mode live sans clé refuse de démarrer.
 */
export function getSaspay(): SaspayApi {
  const env = loadServerEnv();
  const { SASPAY_API_URL: apiUrl, SASPAY_API_KEY: apiKey } = env;
  if (!apiKey) {
    // Le faux SasPay ne doit jamais servir en production : il validerait de faux paiements.
    if (env.VERCEL_ENV === 'production')
      throw new Error('Le faux SasPay est interdit en production');
    if (env.SASPAY_MODE === 'live') throw new Error('SASPAY_API_KEY est obligatoire en mode live');
    return getFakeSaspay();
  }
  if (!apiUrl) throw new Error('SASPAY_API_URL est obligatoire quand SASPAY_API_KEY est fournie');
  return createSaspayClient({ apiUrl, apiKey, webhookSecret: env.SASPAY_WEBHOOK_SECRET });
}
