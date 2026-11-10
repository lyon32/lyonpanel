import { afterEach, describe, expect, it } from 'vitest';
import { makeOrder } from '../factories/order';
import { cleanupUsers, makeFollowersService, makeFundedUser, newKey } from '../helpers/orders-db';
import { adminClient } from './helpers/client';

/* Migration phase 7 : idem_key unique par (user_id, idem_key) ; colonne orders.alerted_at. */

const created: string[] = [];
afterEach(async () => {
  await cleanupUsers(created);
});

describe('orders.idem_key', () => {
  it('deux clients différents peuvent réutiliser la même clé', async () => {
    const s = await makeFollowersService();
    const a = await makeFundedUser(created);
    const b = await makeFundedUser(created);
    const key = newKey();
    await makeOrder(a.id, s.id, { idem_key: key });
    await expect(makeOrder(b.id, s.id, { idem_key: key })).resolves.toBeTruthy();
  });

  it('un même client ne peut pas réutiliser sa clé (violation d unicité 23505)', async () => {
    const s = await makeFollowersService();
    const a = await makeFundedUser(created);
    const key = newKey();
    await makeOrder(a.id, s.id, { idem_key: key });
    const { error } = await adminClient().from('orders').insert({
      user_id: a.id,
      service_id: s.id,
      link: 'https://www.tiktok.com/@client_test',
      quantity: 100,
      price_xaf_1000: 1500,
      discount_pct: 0,
      charged_xaf: 150,
      cost_usd: 0.15,
      idem_key: key,
    });
    expect(error?.code).toBe('23505');
  });
});

describe('orders.alerted_at', () => {
  it('existe, vide par défaut, et accepte une date', async () => {
    const s = await makeFollowersService();
    const a = await makeFundedUser(created);
    const o = await makeOrder(a.id, s.id);
    const { data, error } = await adminClient()
      .from('orders')
      .select('alerted_at')
      .eq('id', o.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ alerted_at: null });
    const up = await adminClient()
      .from('orders')
      .update({ alerted_at: new Date().toISOString() })
      .eq('id', o.id);
    expect(up.error).toBeNull();
  });
});
