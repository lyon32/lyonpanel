import 'server-only';
import { PAYMENT_EXPIRY_MINUTES } from './create-payment';
import {
  PAYMENT_COLUMNS,
  creditSettlement,
  markPaymentFailed,
  type PaymentRow,
} from './settle-payment';
import { createAdminClient } from '@/server/db/supabase-admin';
import { getSaspay } from '@/server/providers/saspay-client';

// Lot maximal par passage du cron (toutes les 5 min) : borne le temps d'exécution.
const BATCH_SIZE = 100;

/**
 * Rattrapage des recharges restées `pending` (webhook perdu après les 5 essais de SasPay).
 * - session payée et confirmée par verifyPayment -> crédit (credit_payment, jamais deux fois) ;
 * - session échouée ou annulée -> `failed` ;
 * - toujours en attente après 30 min -> `failed` (expirée).
 * Une panne SasPay sur une recharge n'empêche pas de traiter les autres : le prochain passage la reverra.
 */
export async function reconcilePendingPayments(
  olderThanMinutes = 5,
): Promise<{ credited: number; failed: number }> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data, error } = await createAdminClient()
    .from('payments')
    .select(`${PAYMENT_COLUMNS}, created_at`)
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (error) throw new Error(`paiements en attente: ${error.message}`);

  const saspay = getSaspay();
  let credited = 0;
  let failed = 0;

  // Restées `created` : arrêt serveur entre l'insertion et l'appel SasPay, aucune session n'existe.
  // Après l'expiration, plus rien ne peut les payer : on les ferme.
  const expiryCutoff = new Date(Date.now() - PAYMENT_EXPIRY_MINUTES * 60_000).toISOString();
  const { data: stale, error: staleError } = await createAdminClient()
    .from('payments')
    .update({ status: 'failed' })
    .eq('status', 'created')
    .lt('created_at', expiryCutoff)
    .select('id');
  if (staleError) throw new Error(`paiements non initialisés: ${staleError.message}`);
  failed += stale.length;

  for (const row of data as (PaymentRow & { created_at: string })[]) {
    try {
      const session = await saspay.getCheckoutSessionStatus(row.saspay_session_id);
      if (session.status === 'SUCCESS') {
        if (!session.transactionId) continue;
        // Double contrôle auprès de SasPay avant de créditer.
        const tx = await saspay.verifyPayment(session.transactionId);
        if (tx.status !== 'SUCCESS') continue;
        const result = await creditSettlement(row, {
          transactionId: session.transactionId,
          netAmount: tx.netAmount,
          fee: tx.fee,
          charged: tx.charged,
          network: null,
          raw: { source: 'reconcile', transaction_id: session.transactionId, status: tx.status },
        });
        if (result === 'credited') credited += 1;
      } else if (session.status === 'FAILED' || session.status === 'CANCELLED') {
        if (await markPaymentFailed(row.id)) failed += 1;
      } else {
        const ageMinutes = (Date.now() - new Date(row.created_at).getTime()) / 60_000;
        if (ageMinutes >= PAYMENT_EXPIRY_MINUTES && (await markPaymentFailed(row.id))) {
          failed += 1;
        }
      }
    } catch {
      // Panne SasPay ou de lecture sur cette recharge : on passe à la suivante.
    }
  }
  return { credited, failed };
}
