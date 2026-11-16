import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  balanceOf,
  cleanupUsers,
  makeFollowersService,
  makeFundedUser,
  newKey,
  resetOrderSettings,
  restoreOrderSettingsAfterAll,
} from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));

import { quoteOrder } from '@/server/orders/quote';
import { computeDiscountedTotalXaf } from '@/server/pricing/compute-discounted-total';
import { getWallet } from '@/server/wallet/wallet';

/*
 * Remise automatique 10 % dès 50 000 XAF rechargés (seuil inclus) et personnalisée :
 * jamais cumulées, même total côté TypeScript (devis, computeDiscountedTotalXaf) et côté SQL (place_order).
 * Nouveau comportement de getWallet : next_discount_threshold_xaf = null aussi quand la remise
 * personnalisée est >= à la remise automatique.
 */
const created: string[] = [];
restoreOrderSettingsAfterAll();
beforeEach(resetOrderSettings);
afterEach(() => cleanupUsers(created));

const link = 'https://www.tiktok.com/@client_test';
async function placeSql(userId: string, serviceId: number, qty: number) {
  const { data, error } = await adminClient().rpc('place_order', {
    p_user: userId,
    p_service: serviceId,
    p_link: link,
    p_qty: qty,
    p_comments: null,
    p_idem_key: newKey(),
  });
  expect(error).toBeNull();
  return data as { charged_xaf: number };
}

describe('remise au seuil exact', () => {
  it('49 999 XAF rechargés : 0 %, total 1 155 pour 1 000 abonnés', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000, recharged: 49_999 });
    expect(await quoteOrder(u.id, { service_id: s.id, quantity: 1000 })).toMatchObject({
      discount_pct: 0,
      total_xaf: 1155,
    });
    expect((await placeSql(u.id, s.id, 1000)).charged_xaf).toBe(1155);
  });

  it('50 000 XAF rechargés : 10 %, total 1 040, débit SQL identique', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000, recharged: 50_000 });
    expect(await quoteOrder(u.id, { service_id: s.id, quantity: 1000 })).toMatchObject({
      discount_pct: 10,
      total_xaf: 1040,
    });
    expect((await placeSql(u.id, s.id, 1000)).charged_xaf).toBe(1040);
    expect(await balanceOf(u.id)).toBe(3960);
  });

  it('getWallet : 49 999 -> 0 % et palier 50 000 ; 50 000 -> 10 % et palier null', async () => {
    const a = await makeFundedUser(created, { recharged: 49_999 });
    const b = await makeFundedUser(created, { recharged: 50_000 });
    expect(await getWallet(a.id)).toMatchObject({
      discount_pct: 0,
      next_discount_threshold_xaf: 50_000,
    });
    expect(await getWallet(b.id)).toMatchObject({
      discount_pct: 10,
      next_discount_threshold_xaf: null,
    });
  });
});

describe('automatique contre personnalisée : jamais cumulées', () => {
  it('auto 10 % + personnalisée 15 % : 15 % (pas 25), devis et place_order d accord', async () => {
    const s = await makeFollowersService({ price_xaf_1000: 1000 });
    const u = await makeFundedUser(created, {
      balance: 5000,
      recharged: 60_000,
      profile: { custom_discount_pct: 15 },
    });
    const q = await quoteOrder(u.id, { service_id: s.id, quantity: 1000 });
    expect(q).toMatchObject({ discount_pct: 15, total_xaf: 850 });
    expect((await placeSql(u.id, s.id, 1000)).charged_xaf).toBe(850);
  });

  it('auto 10 % + personnalisée 5 % : 10 % (pas 15), devis et place_order d accord', async () => {
    const s = await makeFollowersService({ price_xaf_1000: 1000 });
    const u = await makeFundedUser(created, {
      balance: 5000,
      recharged: 60_000,
      profile: { custom_discount_pct: 5 },
    });
    expect(await quoteOrder(u.id, { service_id: s.id, quantity: 1000 })).toMatchObject({
      discount_pct: 10,
      total_xaf: 900,
    });
    expect((await placeSql(u.id, s.id, 1000)).charged_xaf).toBe(900);
  });

  it('getWallet : personnalisée >= auto donne un palier null ; plus basse, le palier reste', async () => {
    const hi = await makeFundedUser(created, {
      recharged: 1_000,
      profile: { custom_discount_pct: 15 },
    });
    const eq = await makeFundedUser(created, {
      recharged: 1_000,
      profile: { custom_discount_pct: 10 },
    });
    const lo = await makeFundedUser(created, {
      recharged: 1_000,
      profile: { custom_discount_pct: 5 },
    });
    expect(await getWallet(hi.id)).toMatchObject({
      discount_pct: 15,
      next_discount_threshold_xaf: null,
    });
    expect((await getWallet(eq.id)).next_discount_threshold_xaf).toBeNull();
    expect(await getWallet(lo.id)).toMatchObject({
      discount_pct: 5,
      next_discount_threshold_xaf: 50_000,
    });
  });
});

describe('même total côté TypeScript et côté SQL', () => {
  it.each([
    [1155, 10, 0],
    [1155, 10, 10],
    [1155, 17, 10],
    [999, 33, 10],
    [1155, 1000, 10],
    [1155, 7, 15],
  ])(
    'prix %i, quantité %i, remise %i pour cent : computeDiscountedTotalXaf = débit de place_order',
    async (price, qty, pct) => {
      const s = await makeFollowersService({ price_xaf_1000: price, min_qty: 1 });
      const u = await makeFundedUser(created, {
        balance: 100_000,
        recharged: pct === 10 ? 50_000 : 0,
        profile: pct === 15 ? { custom_discount_pct: 15 } : undefined,
      });
      const q = await quoteOrder(u.id, { service_id: s.id, quantity: qty });
      const sql = await placeSql(u.id, s.id, qty);
      expect(q.total_xaf).toBe(computeDiscountedTotalXaf(price, qty, pct));
      expect(sql.charged_xaf).toBe(q.total_xaf);
    },
  );
});
