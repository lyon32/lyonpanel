import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const saspayStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED']);
export type SaspayStatus = z.infer<typeof saspayStatusSchema>;

export interface CheckoutSessionParams {
  /** Texte décimal, ex. "3000.00" : le montant CRÉDITÉ au client (les frais s'ajoutent en ADD_ON). */
  amount: string;
  currency: 'XAF' | 'XOF';
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  country?: string;
  returnUrl: string;
  metadata: { lyonpanel_payment_id: string };
  feeChargeMode: 'ADD_ON';
  expiresAt: string;
}

export interface SaspayVerification {
  status: SaspayStatus;
  netAmount: string;
  fee: string;
  charged: string;
  currency: string;
}

/** Contrat commun du vrai client et du faux SasPay (LLD §4.5). `createCheckoutSession` n'est jamais relancé. */
export interface SaspayApi {
  createCheckoutSession(
    p: CheckoutSessionParams,
  ): Promise<{ sessionId: string; checkoutUrl: string }>;
  getCheckoutSessionStatus(
    sessionId: string,
  ): Promise<{ status: SaspayStatus; transactionId: string | null }>;
  verifyPayment(transactionId: string): Promise<SaspayVerification>;
  getMyRates(): Promise<{ network: string; feePct: number }[]>;
  verifyWebhook(rawBody: string, signature: string, timestamp: string): boolean;
}

// Réponses SasPay : tout ce qui ne ressemble pas à ces formes est une réponse invalide.
export const sessionCreatedSchema = z.object({ id: z.string().min(1), checkout_url: z.url() });
export const sessionStatusSchema = z.object({
  status: saspayStatusSchema,
  transaction: z.object({ id: z.string().min(1) }).nullish(),
});
export const verificationSchema = z.object({
  status: saspayStatusSchema,
  net_amount: z.string(),
  fee: z.string(),
  charged: z.string(),
  currency: z.string(),
});
export const ratesSchema = z.array(z.object({ network: z.string(), fee_pct: z.coerce.number() }));

// Tolérance de l'horodatage d'un webhook (docs/06-saspay.md §3).
const MAX_SKEW_SECONDS = 300;

/**
 * Vérifie un webhook : horodatage à ± 300 s, puis HMAC-SHA256 hexadécimal de
 * `timestamp + "." + corps brut`, comparé en temps constant. Ne lève jamais.
 */
export function verifyWebhookSignature(
  secret: string | undefined,
  rawBody: string,
  signature: string,
  timestamp: string,
): boolean {
  if (!secret || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  // Longueur et alphabet vérifiés avant : timingSafeEqual lève une erreur si les tailles diffèrent.
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
