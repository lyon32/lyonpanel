import { randomUUID } from 'node:crypto';
import { adminClient } from '../db/helpers/client';

export type OrderOverrides = Record<string, unknown>;

/** Insère une vraie commande directement (sans débit : pour préparer des cas de test). */
export async function makeOrder(
  userId: string,
  serviceId: number,
  overrides: OrderOverrides = {},
): Promise<{ id: string } & Record<string, unknown>> {
  const row = {
    user_id: userId,
    service_id: serviceId,
    link: 'https://www.tiktok.com/@client_test',
    quantity: 100,
    price_xaf_1000: 1500,
    discount_pct: 0,
    charged_xaf: 150,
    cost_usd: 0.15,
    idem_key: randomUUID(),
    ...overrides,
  };
  const { data, error } = await adminClient().from('orders').insert(row).select().single();
  if (error || !data) throw new Error(`makeOrder a échoué : ${error?.message}`);
  return data as { id: string } & Record<string, unknown>;
}
