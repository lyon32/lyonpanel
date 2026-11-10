import 'server-only';
import { z } from 'zod';
import type {
  CatalogSettings,
  CatalogStore,
  MultiplierRule,
  StoredService,
} from '@/server/catalog/sync-services';
import { createAdminClient } from '@/server/db/supabase-admin';

const PAGE = 1000; // limite de lignes par requête de Supabase

const settingsSchema = z.object({
  usd_xaf_rate: z.coerce.number().positive(),
  default_multiplier: z.coerce.number().positive(),
  price_alert_pct: z.coerce.number().nonnegative(),
});

/** CatalogStore branché sur Supabase (client « service », serveur uniquement). */
export function createSupabaseCatalogStore(): CatalogStore {
  const db = createAdminClient();

  return {
    async getSettings(): Promise<CatalogSettings> {
      const { data, error } = await db
        .from('settings')
        .select('key, value')
        .in('key', ['usd_xaf_rate', 'default_multiplier', 'price_alert_pct']);
      if (error) throw new Error(`settings: ${error.message}`);
      const parsed = settingsSchema.parse(Object.fromEntries(data.map((r) => [r.key, r.value])));
      return {
        usdXafRate: parsed.usd_xaf_rate,
        defaultMultiplier: parsed.default_multiplier,
        priceAlertPct: parsed.price_alert_pct,
      };
    },

    async getMultiplierRules(): Promise<MultiplierRule[]> {
      const { data, error } = await db
        .from('price_multipliers')
        .select('platform, category, multiplier');
      if (error) throw new Error(`price_multipliers: ${error.message}`);
      return data;
    },

    async listServices(): Promise<StoredService[]> {
      const rows: StoredService[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from('services')
          .select(
            'id, platform, category, name_fr, provider_name, provider_type, cost_usd_1000, multiplier, price_xaf_1000, min_qty, max_qty, refill, cancel, dripfeed, active, available',
          )
          .order('id')
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`services: ${error.message}`);
        for (const r of data) {
          rows.push({
            ...r,
            category: r.category ?? 'other',
            name_fr: r.name_fr ?? '',
            provider_name: r.provider_name ?? '',
            provider_type: r.provider_type ?? '',
            cost_usd_1000: r.cost_usd_1000 ?? 0,
            price_xaf_1000: r.price_xaf_1000 ?? 0,
          });
        }
        if (data.length < PAGE) return rows;
      }
    },

    async insertServices(rows) {
      const { error } = await db.from('services').insert(rows);
      if (error) throw new Error(`services: ${error.message}`);
    },

    async updateService(id, patch) {
      const { error } = await db.from('services').update(patch).eq('id', id);
      if (error) throw new Error(`services: ${error.message}`);
    },

    async addPriceHistory(rows) {
      const { error } = await db.from('service_price_history').insert(rows);
      if (error) throw new Error(`service_price_history: ${error.message}`);
    },
  };
}
