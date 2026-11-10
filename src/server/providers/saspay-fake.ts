import 'server-only';
import {
  verifyWebhookSignature,
  type CheckoutSessionParams,
  type SaspayApi,
  type SaspayStatus,
  type SaspayVerification,
} from './saspay-types';
import { apiError } from '@/server/http/api-error';

// Mêmes frais que le réglage par défaut (saspay_fee_pct = 3).
const FAKE_FEE_PCT = 3;

export type FakeSession = {
  params: CheckoutSessionParams;
  status: SaspayStatus;
  transactionId: string | null;
  expiresAt: string;
};

export type SettleOutcome = 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface FakeSaspay extends SaspayApi {
  sessions: Map<string, FakeSession>;
  /** Simule le paiement (ou l'échec) d'une session ; renvoie la charge `data` d'un webhook SasPay. */
  settle(
    sessionId: string,
    outcome: SettleOutcome,
    opts?: { netAmount?: string },
  ): { transactionId: string; data: Record<string, unknown> };
}

const money = (xaf: number) => `${xaf}.00`;

/**
 * Faux SasPay pour le mode test : déterministe, sans réseau, sans clé.
 * Les sessions vivent en mémoire du processus.
 */
export function createFakeSaspay(options: { webhookSecret?: string } = {}): FakeSaspay {
  const sessions = new Map<string, FakeSession>();
  const transactions = new Map<string, SaspayVerification>();

  function session(sessionId: string): FakeSession {
    const found = sessions.get(sessionId);
    if (!found) return apiError('PROVIDER_ERROR');
    return found;
  }

  return {
    sessions,

    async createCheckoutSession(params) {
      // Identifiant déduit du paiement : le même paiement redonne la même session.
      const sessionId = `cs_fake_${params.metadata.lyonpanel_payment_id}`;
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
          params,
          status: 'PENDING',
          transactionId: null,
          expiresAt: params.expiresAt,
        });
      }
      return { sessionId, checkoutUrl: `https://checkout.saspay.invalid/pay/${sessionId}` };
    },

    async getCheckoutSessionStatus(sessionId) {
      const s = session(sessionId);
      return { status: s.status, transactionId: s.transactionId };
    },

    async verifyPayment(transactionId) {
      const tx = transactions.get(transactionId);
      if (!tx) return apiError('PROVIDER_ERROR');
      return { ...tx };
    },

    async getMyRates() {
      return [{ network: 'fake', feePct: FAKE_FEE_PCT }];
    },

    verifyWebhook: (rawBody, signature, timestamp) =>
      verifyWebhookSignature(options.webhookSecret, rawBody, signature, timestamp),

    settle(sessionId, outcome, opts = {}) {
      const s = session(sessionId);
      const amountXaf = Math.round(Number(s.params.amount));
      const feeXaf = Math.ceil((amountXaf * FAKE_FEE_PCT) / 100);
      const transactionId = `txn_fake_${s.params.metadata.lyonpanel_payment_id}`;
      const verification: SaspayVerification = {
        status: outcome,
        netAmount: opts.netAmount ?? money(amountXaf),
        fee: money(feeXaf),
        charged: money(amountXaf + feeXaf),
        currency: s.params.currency,
      };
      s.status = outcome;
      s.transactionId = transactionId;
      transactions.set(transactionId, verification);
      return {
        transactionId,
        data: {
          id: transactionId,
          reference: `ref_${transactionId}`,
          status: outcome,
          amount: s.params.amount,
          fee: verification.fee,
          charged: verification.charged,
          net_amount: verification.netAmount,
          fee_charge_mode: 'ADD_ON',
          currency: s.params.currency,
          country: s.params.country ?? 'CM',
          network: 'mtn_cm',
          msisdn: '+237600000001',
        },
      };
    },
  };
}
