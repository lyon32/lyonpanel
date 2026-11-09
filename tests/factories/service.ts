import { adminClient } from '../db/helpers/client';

export type ServiceOverrides = Record<string, unknown>;

let nextId = 9_000_000 + (Date.now() % 900_000);

/** Insère un vrai service (id unique par appel, hors plage réelle du fournisseur). */
export async function makeService(
  overrides: ServiceOverrides = {},
): Promise<{ id: number } & Record<string, unknown>> {
  nextId += 1;
  const row = {
    id: nextId,
    platform: 'tiktok',
    category: 'followers',
    name_fr: 'Abonnés TikTok (test)',
    jap_name: 'JAP test service',
    jap_type: 'Default',
    cost_usd_1000: 1.5,
    price_xaf_1000: 1500,
    min_qty: 10,
    max_qty: 10000,
    active: true,
    available: true,
    ...overrides,
  };
  const { data, error } = await adminClient().from('services').insert(row).select().single();
  if (error || !data) throw new Error(`makeService a échoué : ${error?.message}`);
  return data as { id: number } & Record<string, unknown>;
}
