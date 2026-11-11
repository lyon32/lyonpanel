import 'server-only';
import { createSessionClient } from '@/server/db/supabase-server';
import { decodeCursor, encodeCursor, keysetFilter } from '@/server/orders/list-orders';

export const TX_TYPES = ['recharge', 'order', 'refund', 'referral_bonus', 'adjustment'] as const;
export type TxType = (typeof TX_TYPES)[number];

export interface WalletTransaction {
  id: string;
  type: TxType;
  amount_xaf: number;
  balance_after_xaf: number;
  order_short_id?: number;
  created_at: string;
}

type Row = {
  id: string;
  type: TxType;
  amount_xaf: number;
  balance_after_xaf: number;
  created_at: string;
  orders: { short_id: number } | null;
};

export async function listTransactions(
  userId: string,
  q: { type?: TxType; limit: number; cursor?: string },
): Promise<{ data: WalletTransaction[]; next_cursor: string | null }> {
  // Client de session : la RLS limite aux lignes du client ; seules les colonnes publiques sont lues
  // (jamais ref, note, created_by, payment_id).
  const supabase = await createSessionClient();
  let query = supabase
    .from('wallet_transactions')
    .select('id, type, amount_xaf, balance_after_xaf, created_at, orders(short_id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(q.limit + 1);
  if (q.type) query = query.eq('type', q.type);
  if (q.cursor) query = query.or(keysetFilter(decodeCursor(q.cursor)));
  const { data, error } = await query;
  if (error) throw new Error(`transactions: ${error.message}`);

  const rows = data as unknown as Row[];
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    data: page.map((r) => ({
      id: r.id,
      type: r.type,
      amount_xaf: r.amount_xaf,
      balance_after_xaf: r.balance_after_xaf,
      ...(r.orders ? { order_short_id: r.orders.short_id } : {}),
      created_at: r.created_at,
    })),
    next_cursor: rows.length > q.limit && last ? encodeCursor(last) : null,
  };
}
