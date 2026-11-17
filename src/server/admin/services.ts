import 'server-only';
import type { z } from 'zod';
import type { Json } from '@/server/db/types';
import type { listServicesQuerySchema, patchServiceSchema } from '@/server/schemas/admin-services';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { computePricePer1000Xaf } from '@/server/pricing/compute-price';

type ListQuery = z.infer<typeof listServicesQuerySchema>;
type Patch = z.infer<typeof patchServiceSchema>;

// Réponse admin seulement : contient le coût et le nom du fournisseur.
const COLUMNS =
  'id, platform, category, provider_name, name_fr, name_en, custom_name_fr, custom_name_en, description_fr, description_en, custom_description_fr, custom_description_en, cost_usd_1000, multiplier, price_xaf_1000, active, available, sort_order, min_qty, max_qty';

async function readUsdXafRate(): Promise<number> {
  const { data, error } = await createAdminClient()
    .from('settings')
    .select('value')
    .eq('key', 'usd_xaf_rate')
    .single();
  if (error || typeof data.value !== 'number') throw new Error('admin_setting_read_failed');
  return data.value;
}

export async function listAdminServices(query: ListQuery) {
  let req = createAdminClient().from('services').select(COLUMNS, { count: 'exact' });
  if (query.platform) req = req.eq('platform', query.platform);
  if (query.active) req = req.eq('active', query.active === 'true');
  if (query.q) {
    // On retire les caractères spéciaux du filtre PostgREST (virgule, parenthèses, jokers) : la recherche reste littérale.
    const term = query.q.replace(/[,()%_*\\]/g, ' ').trim();
    const parts = term ? [`name_fr.ilike.%${term}%`, `name_en.ilike.%${term}%`] : [];
    if (/^\d{1,9}$/.test(query.q)) parts.push(`id.eq.${query.q}`);
    if (parts.length === 0)
      return { items: [], total: 0, page: query.page, limit: query.limit, hasMore: false };
    req = req.or(parts.join(','));
  }
  const from = (query.page - 1) * query.limit;
  // Ordre stable (sort_order puis id) : une page ne chevauche jamais la suivante.
  const { data, error, count } = await req
    .order('sort_order')
    .order('id')
    .range(from, from + query.limit - 1);
  if (error) throw new Error('admin_services_list_failed');
  const total = count ?? 0;
  return {
    items: data,
    total,
    page: query.page,
    limit: query.limit,
    hasMore: from + data.length < total,
  };
}

/** Aperçu : prix actuel et prix après changement de marge, recalculés ici, rien n'est écrit. */
export async function previewServiceMultiplier(id: number, multiplier: number) {
  const { data, error } = await createAdminClient()
    .from('services')
    .select('cost_usd_1000, price_xaf_1000')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('admin_service_read_failed');
  if (!data) return apiError('NOT_FOUND');
  if (data.cost_usd_1000 === null) return apiError('VALIDATION_ERROR');
  const rate = await readUsdXafRate();
  return {
    old_price_xaf_1000: data.price_xaf_1000,
    new_price_xaf_1000: computePricePer1000Xaf(data.cost_usd_1000, rate, multiplier),
  };
}

export async function updateAdminService(adminId: string, id: number, patch: Patch) {
  const { confirm, ...changes } = patch;
  if (Object.keys(changes).length === 0) return apiError('VALIDATION_ERROR');
  // Une nouvelle marge change le prix client : confirmation explicite obligatoire.
  if (changes.multiplier !== undefined && confirm !== true) {
    return apiError('VALIDATION_ERROR', { fields: { confirm: 'REQUIRED' } });
  }
  const db = createAdminClient();
  const { error } = await db.rpc('update_service', {
    p_service: id,
    p_admin: adminId,
    p_changes: changes as Json,
  });
  if (error) {
    if (error.message.includes('SERVICE_NOT_FOUND')) return apiError('NOT_FOUND');
    if (error.message.includes('INVALID_FIELD') || error.message.includes('EMPTY_CHANGES')) {
      return apiError('VALIDATION_ERROR');
    }
    throw new Error('admin_service_update_failed');
  }
  const { data, error: readError } = await db
    .from('services')
    .select(COLUMNS)
    .eq('id', id)
    .single();
  if (readError) throw new Error('admin_service_read_failed');
  return { service: data };
}
