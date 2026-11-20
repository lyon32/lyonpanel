import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';

/**
 * Montant déjà rendu au client par commande (lignes `refund` du portefeuille), en entiers XAF.
 * Le filtre user_id double la garde : un client ne voit que ses propres remboursements.
 */
export async function refundedXafByOrder(
  userId: string,
  orderIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (orderIds.length === 0) return totals;
  const { data, error } = await createAdminClient()
    .from('wallet_transactions')
    .select('order_id, amount_xaf')
    .eq('user_id', userId)
    .eq('type', 'refund')
    .in('order_id', orderIds);
  if (error) throw new Error('refunded_amounts_failed');
  for (const row of data) {
    if (row.order_id)
      totals.set(row.order_id, (totals.get(row.order_id) ?? 0) + Number(row.amount_xaf));
  }
  return totals;
}
