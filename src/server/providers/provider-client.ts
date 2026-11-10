import 'server-only';
import { z } from 'zod';
import {
  providerAddSchema,
  providerBalanceSchema,
  providerServicesSchema,
  providerStatusSchema,
  type ProviderApi,
  type ProviderStatus,
} from './types';
import { ApiError, apiError } from '@/server/http/api-error';

export interface ProviderClientOptions {
  apiUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Client de l'API v2 du fournisseur. La clé part dans le corps du POST (jamais dans l'adresse).
 * Toute panne devient une ApiError générique : ni la clé, ni le message brut, ni le nom du
 * fournisseur ne remontent. Aucune reprise automatique, surtout pas pour `add`.
 */
export function createProviderClient(options: ProviderClientOptions): ProviderApi {
  const { apiUrl, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const doFetch = options.fetch ?? fetch;

  async function call(action: string, params: Record<string, string> = {}): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    let payload: unknown;
    try {
      const res = await doFetch(apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ key: apiKey, action, ...params }),
        signal: controller.signal,
      });
      if (!res.ok) apiError('PROVIDER_ERROR');
      payload = JSON.parse(await res.text());
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const isTimeout = timedOut || (e instanceof Error && e.name === 'TimeoutError');
      return apiError(isTimeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR');
    } finally {
      clearTimeout(timer);
    }
    // Une erreur métier arrive parfois en HTTP 200 : { "error": "..." }.
    if (typeof payload === 'object' && payload !== null && 'error' in payload) {
      apiError('PROVIDER_ERROR');
    }
    return payload;
  }

  function parse<S extends z.ZodType>(schema: S, payload: unknown): z.output<S> {
    const result = schema.safeParse(payload);
    if (!result.success) apiError('PROVIDER_ERROR');
    return result.data;
  }

  return {
    async services() {
      return parse(providerServicesSchema, await call('services'));
    },
    async balance() {
      return parse(providerBalanceSchema, await call('balance'));
    },
    async add({ service, link, quantity, comments }) {
      const params: Record<string, string> = {
        service: String(service),
        link,
        quantity: String(quantity),
      };
      if (comments) params.comments = comments.join('\n');
      return parse(providerAddSchema, await call('add', params));
    },
    async status(ids) {
      const raw = parse(
        z.record(z.string(), z.unknown()),
        await call('status', { orders: ids.join(',') }),
      );
      const out: Record<number, ProviderStatus> = {};
      for (const [id, value] of Object.entries(raw)) {
        // Une commande inconnue revient sous la forme { error }, on l'ignore.
        const parsed = providerStatusSchema.safeParse(value);
        if (parsed.success) out[Number(id)] = parsed.data;
      }
      return out;
    },
  };
}
