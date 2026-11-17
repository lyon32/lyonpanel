import 'server-only';
import type { z } from 'zod';
import { totalRefundedXaf } from './refund-order';
import { refundableAmountXaf } from './refunds';
import type { listAdminOrdersQuerySchema } from '@/server/schemas/admin-orders';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { decodeCursor, encodeCursor, keysetFilter } from '@/server/orders/list-orders';

type Query = z.infer<typeof listAdminOrdersQuerySchema>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Vue admin : le numéro fournisseur et le coût sont voulus ici (jamais dans une réponse client).
const LIST_COLUMNS =
  'id, short_id, user_id, service_id, quantity, charged_xaf, status, provider_order_id, created_at, profiles(email, phone)';
const DETAIL_COLUMNS =
  'id, short_id, user_id, service_id, link, quantity, charged_xaf, cost_usd, status, start_count, remains, provider_order_id, error, resent_at, cancel_requested_at, created_at, updated_at, profiles(email, phone), services(name_fr)';

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export async function listAdminOrders(query: Query) {
  let req = createAdminClient()
    .from('orders')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(query.limit + 1);
  if (query.status) req = req.eq('status', query.status);
  if (query.q) req = req.or(['short_id.eq.', query.q, ',provider_order_id.eq.', query.q].join(''));
  if (query.cursor) req = req.or(keysetFilter(decodeCursor(query.cursor)));
  const { data, error } = await req;
  if (error) throw new Error('admin_orders_list_failed');
  const page = data.slice(0, query.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(({ profiles, charged_xaf, ...o }) => ({
      ...o,
      charged_xaf: Number(charged_xaf),
      user_email: one(profiles)?.email ?? null,
      user_phone: one(profiles)?.phone ?? null,
    })),
    next_cursor: data.length > query.limit && last ? encodeCursor(last) : null,
  };
}

export async function getAdminOrder(id: string) {
  if (!UUID.test(id)) return apiError('ORDER_NOT_FOUND');
  const db = createAdminClient();
  const { data, error } = await db.from('orders').select(DETAIL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error('admin_order_failed');
  if (!data) return apiError('ORDER_NOT_FOUND');
  const [refundedXaf, rate] = await Promise.all([
    totalRefundedXaf(id),
    db.from('settings').select('value').eq('key', 'usd_xaf_rate').single(),
  ]);
  if (rate.error) throw new Error('admin_order_rate_failed');
  const { profiles, services, ...order } = data;
  const costUsd = order.cost_usd === null ? null : Number(order.cost_usd);
  const charged = Number(order.charged_xaf);
  return {
    order: {
      ...order,
      charged_xaf: charged,
      cost_usd: costUsd,
      profit_xaf: costUsd === null ? null : charged - Math.round(costUsd * Number(rate.data.value)),
      refunded_xaf: refundedXaf,
      refundable_xaf: refundableAmountXaf({
        chargedXaf: charged,
        quantity: order.quantity,
        remains: order.remains ?? order.quantity,
        refundedXaf,
      }),
      resent: order.resent_at !== null,
      service_name: one(services)?.name_fr ?? null,
      user_email: one(profiles)?.email ?? null,
      user_phone: one(profiles)?.phone ?? null,
    },
  };
}
