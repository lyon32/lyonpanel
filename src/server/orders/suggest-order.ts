import 'server-only';
import { buildServiceName } from '@/server/catalog/build-name';
import type { CatalogLocale, Network, ServiceType } from '@/server/catalog/labels';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';

export type OrderSuggestion = {
  service: { id: number; name: string; platform: string };
  quantity: number;
} | null;

type Row = { service_id: number; quantity: number; created_at: string };

// Plus grand effectif ; à égalité, la valeur vue le plus récemment (lastSeen le plus grand).
function pickTop<K>(keys: Iterable<K>, count: Map<K, number>, lastSeen: Map<K, string>): K | null {
  let best: K | null = null;
  for (const k of keys) {
    if (best === null) {
      best = k;
      continue;
    }
    const diff = (count.get(k) ?? 0) - (count.get(best) ?? 0);
    if (diff > 0 || (diff === 0 && (lastSeen.get(k) ?? '') > (lastSeen.get(best) ?? ''))) best = k;
  }
  return best;
}

function tally<K>(rows: Row[], keyOf: (r: Row) => K) {
  const count = new Map<K, number>();
  const lastSeen = new Map<K, string>();
  for (const r of rows) {
    const k = keyOf(r);
    count.set(k, (count.get(k) ?? 0) + 1);
    if ((lastSeen.get(k) ?? '') < r.created_at) lastSeen.set(k, r.created_at);
  }
  return { count, lastSeen };
}

/** Service le plus commandé et sa quantité habituelle ; null si aucune commande ou option coupée. */
export async function suggestOrder(
  userId: string,
  locale: CatalogLocale,
): Promise<OrderSuggestion> {
  // La table profiles n'est pas lisible avec la session : lecture admin, limitée à l'id authentifié.
  const { data: profile, error: pErr } = await createAdminClient()
    .from('profiles')
    .select('suggestions_enabled')
    .eq('id', userId)
    .maybeSingle();
  if (pErr) throw new Error(`profil suggestion: ${pErr.message}`);
  if (!profile?.suggestions_enabled) return null;

  // Commandes : client de session, la RLS limite au client, le filtre user_id double la garde.
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('orders')
    .select('service_id, quantity, created_at')
    .eq('user_id', userId);
  if (error) throw new Error(`commandes suggestion: ${error.message}`);
  const allRows = data as Row[];
  if (allRows.length === 0) return null;

  // Jamais de service désactivé ou indisponible : on ne garde que les commandes de services vendables.
  const { data: sellable, error: selErr } = await createAdminClient()
    .from('services')
    .select('id')
    .in('id', [...new Set(allRows.map((r) => r.service_id))])
    .eq('active', true)
    .eq('available', true);
  if (selErr) throw new Error(`services vendables: ${selErr.message}`);
  const sellableIds = new Set((sellable ?? []).map((x) => x.id));
  const rows = allRows.filter((r) => sellableIds.has(r.service_id));
  if (rows.length === 0) return null;

  const byService = tally(rows, (r) => r.service_id);
  const serviceId = pickTop(byService.count.keys(), byService.count, byService.lastSeen);
  if (serviceId === null) return null;
  const byQty = tally(
    rows.filter((r) => r.service_id === serviceId),
    (r) => r.quantity,
  );
  const quantity = pickTop(byQty.count.keys(), byQty.count, byQty.lastSeen);
  if (quantity === null) return null;

  const { data: s, error: sErr } = await createAdminClient()
    .from('services')
    .select('id, platform, category, name_fr, refill, cancel, dripfeed, min_qty, max_qty')
    .eq('id', serviceId)
    .maybeSingle();
  if (sErr) throw new Error(`service suggestion: ${sErr.message}`);
  if (!s) return null;
  const name = s.category
    ? buildServiceName(
        { ...s, platform: s.platform as Network, category: s.category as ServiceType },
        locale,
      )
    : s.name_fr;
  return { service: { id: s.id, name, platform: s.platform }, quantity };
}
