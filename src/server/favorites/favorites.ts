import 'server-only';
import type { CatalogLocale } from '@/server/catalog/labels';
import { toPublicService, type PublicService } from '@/server/catalog/present-catalog';
import { listPublicServicesByIds } from '@/server/catalog/public-catalog';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';
import { apiError } from '@/server/http/api-error';

/** Identifiant de service : entier positif de la base (int4) ; tout autre texte = service introuvable. */
export function parseServiceId(raw: string): number {
  const id = /^[1-9]\d{0,9}$/.test(raw) ? Number(raw) : 0;
  if (id < 1 || id > 2_147_483_647) apiError('NOT_FOUND');
  return id;
}

/** Favoris du client, du plus récent au plus ancien, au format du catalogue (en XAF). */
export async function listFavorites(
  userId: string,
  locale: CatalogLocale,
): Promise<PublicService[]> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('favorites')
    .select('service_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`favorites: ${error.message}`);
  const ids = data.map((f) => f.service_id);
  if (ids.length === 0) return [];
  const byId = new Map(
    (await listPublicServicesByIds(ids, createAdminClient())).map((r) => [r.id, r]),
  );
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toPublicService(row, { currency: 'XAF', locale, usdXafRate: 1 })] : [];
  });
}

/** Idempotent : un doublon (clé primaire) n'est pas une erreur. */
export async function addFavorite(userId: string, serviceId: number): Promise<void> {
  // La vue services_public ne montre que les services actifs : un service masqué = introuvable.
  if ((await listPublicServicesByIds([serviceId], createAdminClient())).length === 0) {
    apiError('NOT_FOUND');
  }
  const supabase = await createSessionClient();
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, service_id: serviceId });
  if (error && error.code !== '23505') throw new Error(`favorites: ${error.message}`);
}

export async function removeFavorite(userId: string, serviceId: number): Promise<void> {
  const supabase = await createSessionClient();
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('service_id', serviceId);
  if (error) throw new Error(`favorites: ${error.message}`);
}
