import 'server-only';
import type { z } from 'zod';
import type { listPaymentsQuerySchema } from '@/server/schemas/admin-payments';
import { createAdminClient } from '@/server/db/supabase-admin';
import { decodeCursor, encodeCursor, keysetFilter } from '@/server/orders/list-orders';

type Query = z.infer<typeof listPaymentsQuerySchema>;

/** Liste en lecture seule. Colonnes en liste blanche : jamais raw_webhook ni identifiants SasPay bruts. */
export async function listPayments(query: Query) {
  let req = createAdminClient()
    .from('payments')
    .select(
      'id, user_id, status, credited_xaf, fee_xaf, total_paid, pay_currency, saspay_network, created_at, succeeded_at',
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(query.limit + 1);
  if (query.status) req = req.eq('status', query.status);
  if (query.cursor) req = req.or(keysetFilter(decodeCursor(query.cursor)));
  const { data, error } = await req;
  if (error) throw new Error('admin_payments_list_failed');
  const page = data.slice(0, query.limit);
  const last = page[page.length - 1];
  return {
    items: page,
    next_cursor: data.length > query.limit && last ? encodeCursor(last) : null,
  };
}
