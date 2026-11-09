import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createStatelessClient } from '@/server/db/supabase-server';

/** Ligne de la vue services_public : seules colonnes lisibles, aucune donnée fournisseur. */
export interface PublicServiceRow {
  id: number;
  platform: string;
  category: string;
  name_fr: string;
  price_xaf_1000: number;
  min_qty: number;
  max_qty: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  sort_order: number;
}

const COLUMNS =
  'id, platform, category, name_fr, price_xaf_1000, min_qty, max_qty, refill, cancel, dripfeed, sort_order';
const PAGE = 1000; // limite de lignes par requête de Supabase

type RawRow = {
  [K in keyof PublicServiceRow]: PublicServiceRow[K] | null;
};

/** Ignore une ligne incomplète plutôt que d'afficher un service sans prix. */
function complete(r: RawRow): PublicServiceRow | null {
  if (r.category === null || r.name_fr === null || r.price_xaf_1000 === null) return null;
  return {
    ...r,
    category: r.category,
    name_fr: r.name_fr,
    price_xaf_1000: r.price_xaf_1000,
  } as PublicServiceRow;
}

export async function listPublicServices(): Promise<PublicServiceRow[]> {
  const db = createStatelessClient();
  const rows: PublicServiceRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('services_public')
      .select(COLUMNS)
      .order('sort_order')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`services_public: ${error.message}`);
    for (const r of data as RawRow[]) {
      const row = complete(r);
      if (row) rows.push(row);
    }
    if (data.length < PAGE) return rows;
  }
}

export async function getPublicService(id: number): Promise<PublicServiceRow | null> {
  const { data, error } = await createStatelessClient()
    .from('services_public')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`services_public: ${error.message}`);
  return data ? complete(data as RawRow) : null;
}

/** Taux d'affichage USD ; vient du réglage usd_xaf_rate (la table settings n'est pas publique). */
export async function getUsdXafRate(): Promise<number> {
  const { data, error } = await createAdminClient()
    .from('settings')
    .select('value')
    .eq('key', 'usd_xaf_rate')
    .single();
  if (error) throw new Error(`settings: ${error.message}`);
  return z.coerce.number().positive().parse(data.value);
}
