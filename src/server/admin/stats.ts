import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';

export type StatsRange = 'today' | '7d' | '30d';

export interface AdminStats {
  range: StatsRange;
  from: string;
  to: string;
  sales_xaf: number;
  profit_xaf: number;
  orders_count: number;
  recharges_xaf: number;
  recharges_count: number;
  new_users_count: number;
  by_country: { country: string; sales_xaf: number; orders_count: number }[];
  provider_balance_usd: number | null;
  provider_low: boolean;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const PAGE = 1000;

/** Début de la fenêtre. « Aujourd'hui » = minuit en UTC+1 (décision du propriétaire), le reste est glissant. */
export function rangeStart(range: StatsRange, now: Date): Date {
  if (range === '7d') return new Date(now.getTime() - 7 * DAY_MS);
  if (range === '30d') return new Date(now.getTime() - 30 * DAY_MS);
  const local = new Date(now.getTime() + HOUR_MS); // heure locale vue comme de l'UTC
  const midnightLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnightLocal - HOUR_MS);
}

/** Lit toutes les lignes par pages de 1000 : PostgREST coupe sinon silencieusement les résultats. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error('admin_stats_query_failed');
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function setting(key: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  const value = Number(data?.value);
  if (error || !Number.isFinite(value)) throw new Error(`setting_missing:${key}`);
  return value;
}

export async function getAdminStats(
  range: StatsRange,
  now: Date = new Date(),
): Promise<AdminStats> {
  const db = createAdminClient();
  const from = rangeStart(range, now).toISOString();
  const to = now.toISOString();
  const [rate, lowThreshold] = await Promise.all([
    setting('usd_xaf_rate'),
    setting('provider_low_balance_usd'),
  ]);

  const orders = await fetchAll<{
    charged_xaf: number;
    cost_usd: number | string | null;
    profiles: { country: string } | { country: string }[] | null;
  }>((a, b) =>
    db
      .from('orders')
      .select('charged_xaf, cost_usd, profiles(country)')
      .neq('status', 'refunded')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at')
      .order('id')
      .range(a, b),
  );
  const payments = await fetchAll<{ credited_xaf: number }>((a, b) =>
    db
      .from('payments')
      .select('credited_xaf')
      .eq('status', 'succeeded')
      .gte('succeeded_at', from)
      .lte('succeeded_at', to)
      .order('id')
      .range(a, b),
  );
  const { count: newUsers } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', from)
    .lte('created_at', to);
  const { data: snapshot } = await db
    .from('provider_balance_snapshots')
    .select('balance_usd')
    .lte('taken_at', to)
    .order('taken_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let sales = 0;
  let profit = 0;
  const countries = new Map<string, { sales_xaf: number; orders_count: number }>();
  for (const o of orders) {
    const charged = Number(o.charged_xaf);
    sales += charged;
    // Coût inconnu (commande pas encore envoyée) : pas de bénéfice calculable, on ne l'invente pas.
    if (o.cost_usd !== null) profit += charged - Math.round(Number(o.cost_usd) * rate);
    const profile = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
    const country = profile?.country ?? '??';
    const entry = countries.get(country) ?? { sales_xaf: 0, orders_count: 0 };
    entry.sales_xaf += charged;
    entry.orders_count += 1;
    countries.set(country, entry);
  }

  const balance = snapshot ? Number(snapshot.balance_usd) : null;
  return {
    range,
    from,
    to,
    sales_xaf: sales,
    profit_xaf: profit,
    orders_count: orders.length,
    recharges_xaf: payments.reduce((sum, p) => sum + Number(p.credited_xaf), 0),
    recharges_count: payments.length,
    new_users_count: newUsers ?? 0,
    by_country: [...countries]
      .map(([country, v]) => ({ country, ...v }))
      .sort((x, y) => y.sales_xaf - x.sales_xaf),
    provider_balance_usd: balance,
    provider_low: balance !== null && balance < lowThreshold,
  };
}
