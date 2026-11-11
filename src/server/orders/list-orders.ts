import 'server-only';
import { toPublicOrder, type Order } from './place-order';
import type { OrderRow } from './submit-to-provider';
import { buildServiceName } from '@/server/catalog/build-name';
import type { CatalogLocale, Network, ServiceType } from '@/server/catalog/labels';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';
import { apiError } from '@/server/http/api-error';

// Seules ces colonnes quittent la base : jamais cost_usd, error, provider_order_id, idem_key.
const ORDER_COLUMNS =
  'id, short_id, service_id, link, quantity, charged_xaf, status, start_count, remains, created_at, updated_at';
const SERVICE_COLUMNS =
  'id, platform, category, name_fr, refill, cancel, dripfeed, min_qty, max_qty';

type PublicOrderColumns = Pick<
  OrderRow,
  | 'id'
  | 'short_id'
  | 'service_id'
  | 'link'
  | 'quantity'
  | 'charged_xaf'
  | 'status'
  | 'start_count'
  | 'remains'
  | 'created_at'
  | 'updated_at'
>;

// Date ISO stricte, en UTC (chiffres et séparateurs seulement) : insérée dans un filtre PostgREST.
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|\+00:00)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Curseur = date + id (base64url) : deux commandes de même date ne sont ni perdues ni doublées. */
export function encodeCursor(row: { created_at: string; id: string }): string {
  return Buffer.from(`${row.created_at}|${row.id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  if (
    !createdAt ||
    !id ||
    !UUID.test(id) ||
    !ISO.test(createdAt) ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    apiError('VALIDATION_ERROR', { fields: { cursor: 'INVALID_CURSOR' } });
  }
  return { createdAt, id };
}

// Valeurs déjà validées (ISO, UUID) : rien de libre n'entre dans le filtre.
export function keysetFilter(c: { createdAt: string; id: string }): string {
  const date = c.createdAt.replace('+00:00', 'Z');
  return ['created_at.lt.', date, ',and(created_at.eq.', date, ',id.lt.', c.id, ')'].join('');
}

/** Noms localisés du catalogue (repli sur name_fr si le service n'est pas classé). */
async function toOrders(rows: PublicOrderColumns[], locale: CatalogLocale): Promise<Order[]> {
  const ids = [...new Set(rows.map((r) => r.service_id))];
  if (ids.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from('services')
    .select(SERVICE_COLUMNS)
    .in('id', ids);
  if (error) throw new Error(`services des commandes: ${error.message}`);
  const byId = new Map(data.map((s) => [s.id, s]));
  return rows.map((row) => {
    const s = byId.get(row.service_id);
    if (!s) return apiError('INTERNAL_ERROR');
    const name = s.category
      ? buildServiceName(
          { ...s, platform: s.platform as Network, category: s.category as ServiceType },
          locale,
        )
      : s.name_fr;
    // Les colonnes non lues par toPublicOrder (coût, erreur…) ne sont volontairement pas chargées.
    return toPublicOrder(row as OrderRow, { id: s.id, name_fr: name, platform: s.platform });
  });
}

export async function listOrders(
  userId: string,
  q: { status?: OrderRow['status']; limit: number; cursor?: string },
  locale: CatalogLocale,
): Promise<{ data: Order[]; next_cursor: string | null }> {
  // Client de session : la RLS limite aux commandes du client, le filtre user_id double la garde.
  const supabase = await createSessionClient();
  let query = supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(q.limit + 1);
  if (q.status) query = query.eq('status', q.status);
  if (q.cursor) {
    const c = decodeCursor(q.cursor);
    query = query.or(keysetFilter(c));
  }
  const { data, error } = await query;
  if (error) throw new Error(`liste des commandes: ${error.message}`);
  const rows = data as unknown as PublicOrderColumns[];
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    data: await toOrders(page, locale),
    next_cursor: rows.length > q.limit && last ? encodeCursor(last) : null,
  };
}

export async function getOrder(userId: string, id: string, locale: CatalogLocale): Promise<Order> {
  // Identifiant illisible ou commande d'un autre client : même 404, rien n'est révélé.
  if (!UUID.test(id)) apiError('ORDER_NOT_FOUND');
  const supabase = await createSessionClient();
  const { data } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) apiError('ORDER_NOT_FOUND');
  const [order] = await toOrders([data as unknown as PublicOrderColumns], locale);
  if (!order) return apiError('INTERNAL_ERROR');
  return order;
}
