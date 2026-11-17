import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Somme des lignes `refund` du portefeuille pour cette commande. */
export async function totalRefundedXaf(orderId: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from('wallet_transactions')
    .select('amount_xaf')
    .eq('order_id', orderId)
    .eq('type', 'refund');
  if (error) throw new Error('refund_total_failed');
  return (data ?? []).reduce((sum, r) => sum + Number(r.amount_xaf), 0);
}

const REFUND_ERRORS = [
  'ORDER_NOT_FOUND',
  'ALREADY_REFUNDED',
  'ORDER_NOT_REFUNDABLE',
  'AMOUNT_TOO_HIGH',
  'REASON_REQUIRED',
  'NOT_ADMIN',
] as const;

/** Remboursement admin : uniquement par la fonction SQL (plafond, cumul et idempotence y sont garantis). */
export async function refundOrder(
  adminId: string,
  orderId: string,
  input: { amount_xaf: number; reason: string },
  idemKey: string | null,
) {
  if (!UUID.test(orderId)) return apiError('ORDER_NOT_FOUND');
  const { data, error } = await createAdminClient().rpc('refund_order', {
    p_order: orderId,
    p_amount: input.amount_xaf,
    p_admin: adminId,
    p_reason: input.reason,
    ...(idemKey ? { p_idem_key: idemKey } : {}),
  });
  if (error) {
    const code = REFUND_ERRORS.find((c) => error.message.includes(c));
    if (code) return apiError(code);
    throw new Error('refund_order_failed');
  }
  return {
    refunded_xaf: input.amount_xaf,
    total_refunded_xaf: await totalRefundedXaf(orderId),
    order_status: data.status,
  };
}
