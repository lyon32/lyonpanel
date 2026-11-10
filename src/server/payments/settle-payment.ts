import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import type { Json } from '@/server/db/types';
import { notifyOwner } from '@/server/providers/telegram';

// Règle commune au webhook et au rattrapage : un seul endroit décide si l'on crédite.

export type PaymentRow = {
  id: string;
  user_id: string;
  credited_xaf: number;
  fee_xaf: number;
  total_paid: number;
  status: string;
  saspay_session_id: string;
};

export const PAYMENT_COLUMNS =
  'id, user_id, credited_xaf, fee_xaf, total_paid, status, saspay_session_id';

export type Settlement = {
  transactionId: string;
  /** Montants SasPay en texte décimal ("3000.00"). */
  netAmount: string;
  fee: string;
  charged: string;
  network: string | null;
  /** Charge conservée dans payments.raw_webhook (sans donnée personnelle). */
  raw: Json;
};

/** "3000.00" -> 3000 ; un montant avec de vrais centimes ("3000.50") ou illisible -> null. */
export function parseWholeXaf(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const match = /^(\d{1,12})(?:\.0{1,2})?$/.exec(text.trim());
  return match?.[1] ? Number(match[1]) : null;
}

/**
 * Crédite le portefeuille par la fonction SQL credit_payment, du net_amount seulement.
 * - déjà crédité -> 'duplicate' ;
 * - montant net différent du montant demandé -> alerte au propriétaire, aucun crédit ('ignored').
 */
export async function creditSettlement(
  payment: PaymentRow,
  s: Settlement,
): Promise<'credited' | 'duplicate' | 'ignored'> {
  if (payment.status === 'succeeded') return 'duplicate';

  const net = parseWholeXaf(s.netAmount);
  if (net !== payment.credited_xaf) {
    await notifyOwner('payment_mismatch', {
      payment_id: payment.id,
      transaction_id: s.transactionId,
      expected_xaf: payment.credited_xaf,
      received_net_amount: s.netAmount,
    });
    return 'ignored';
  }

  const { data, error } = await createAdminClient().rpc('credit_payment', {
    p_payment_id: payment.id,
    p_saspay_transaction_id: s.transactionId,
    p_net_amount_xaf: net,
    p_fee_xaf: parseWholeXaf(s.fee) ?? payment.fee_xaf,
    p_total_paid: parseWholeXaf(s.charged) ?? payment.total_paid,
    p_network: s.network ?? 'unknown',
    p_raw: s.raw,
  });
  if (error) {
    // Payé après expiration (paiement déjà marqué failed) ou montant refusé par la base : examen humain.
    if (/PAYMENT_NOT_PAYABLE|AMOUNT_MISMATCH/.test(error.message)) {
      await notifyOwner('payment_mismatch', {
        payment_id: payment.id,
        transaction_id: s.transactionId,
        reason: /PAYMENT_NOT_PAYABLE/.test(error.message)
          ? 'paid_after_failure'
          : 'amount_mismatch',
      });
      return 'ignored';
    }
    if (/PAYMENT_NOT_FOUND/.test(error.message)) return 'ignored';
    throw new Error(`credit_payment: ${error.message}`);
  }
  const credited =
    typeof data === 'object' && data !== null && !Array.isArray(data) && data.credited;
  return credited === true ? 'credited' : 'duplicate';
}

/** Passe une recharge en attente à `failed` ; false si elle n'était plus en attente (déjà traitée). */
export async function markPaymentFailed(paymentId: string, raw?: Json): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from('payments')
    .update({ status: 'failed', ...(raw === undefined ? {} : { raw_webhook: raw }) })
    .eq('id', paymentId)
    .in('status', ['created', 'pending'])
    .select('id');
  if (error) throw new Error(`échec du paiement: ${error.message}`);
  return data.length > 0;
}
