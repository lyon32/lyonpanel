import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import { cleanupUsers, makeFollowersService, makeFundedUser } from '../helpers/orders-db';
import { getReq, makeTransaction, type ErrorBody } from '../helpers/client-area-db';
import { userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { GET as wallet } from '@/app/api/v1/wallet/route';
import { GET as transactions } from '@/app/api/v1/wallet/transactions/route';

/*
 * Routes attendues (API_SPEC §6.3) :
 *   src/app/api/v1/wallet/route.ts   GET -> 200 {balance_xaf, total_recharged_xaf, discount_pct, next_discount_threshold_xaf}
 *        (entiers XAF ; next_discount_threshold_xaf = seuil de remise auto restant ou null s'il est atteint)
 *   src/app/api/v1/wallet/transactions/route.ts
 *        GET ?type=&limit=&cursor= -> 200 {data: [{id, type, amount_xaf, balance_after_xaf, order_short_id?, created_at}],
 *        next_cursor: string | null}, du plus récent au plus ancien, même pagination que /orders (limit 1..100, défaut 20,
 *        curseur invalide : 400 VALIDATION_ERROR). Filtre type : recharge|order|refund|referral_bonus|adjustment
 *        (autre valeur : 400). Seulement les lignes du client connecté. Aucune clé hors la liste ci-dessus
 *        (jamais ref, note, created_by, payment_id, user_id).
 *   Non connecté : 401 UNAUTHENTICATED.
 */

const created: string[] = [];
beforeEach(() => {
  session.client = null;
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});

async function login(opts: Parameters<typeof makeFundedUser>[1] = { balance: 0 }) {
  const u = await makeFundedUser(created, opts);
  session.client = await userClient(u.id);
  return u;
}
const list = async (query = '') => {
  const res = await transactions(getReq(`/api/v1/wallet/transactions${query}`));
  return { res, json: await res.json() };
};
const minute = (n: number) => new Date(Date.UTC(2026, 10, 1, 10, n)).toISOString();

describe('GET /api/v1/wallet', () => {
  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const res = await wallet(getReq('/api/v1/wallet'));
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('renvoie le solde et le total rechargé en entiers XAF, avec les 4 clés prévues', async () => {
    await login({ balance: 4200, recharged: 12_000 });
    const res = await wallet(getReq('/api/v1/wallet'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual([
      'balance_xaf',
      'discount_pct',
      'next_discount_threshold_xaf',
      'total_recharged_xaf',
    ]);
    expect(json.balance_xaf).toBe(4200);
    expect(json.total_recharged_xaf).toBe(12_000);
    expect(json.discount_pct).toBe(0);
    expect(json.next_discount_threshold_xaf).toBe(50_000);
  });

  it('ne renvoie jamais le solde d un autre client', async () => {
    await makeFundedUser(created, { balance: 99_999 });
    await login({ balance: 10 });
    const json = await (await wallet(getReq('/api/v1/wallet'))).json();
    expect(json.balance_xaf).toBe(10);
  });
});

describe('GET /api/v1/wallet/transactions', () => {
  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const { res, json } = await list();
    expect(res.status).toBe(401);
    expect((json as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('sans mouvement : 200, liste vide, pas de page suivante', async () => {
    await login();
    const { res, json } = await list();
    expect(res.status).toBe(200);
    expect(json).toEqual({ data: [], next_cursor: null });
  });

  it('liste du plus récent au plus ancien avec les clés prévues seulement', async () => {
    const u = await login();
    const old = await makeTransaction(u.id, { created_at: minute(1) });
    const recent = await makeTransaction(u.id, { created_at: minute(2), type: 'adjustment' });
    const { json } = await list();
    expect(json.data.map((t: { id: string }) => t.id)).toEqual([recent.id, old.id]);
    for (const t of json.data) {
      expect(
        Object.keys(t).every((k) =>
          [
            'id',
            'type',
            'amount_xaf',
            'balance_after_xaf',
            'order_short_id',
            'created_at',
          ].includes(k),
        ),
      ).toBe(true);
      expect(typeof t.amount_xaf).toBe('number');
      expect(typeof t.balance_after_xaf).toBe('number');
    }
    const raw = JSON.stringify(json);
    expect(raw).not.toMatch(/"(ref|note|created_by|payment_id|user_id)"/);
  });

  it("n'affiche que les mouvements du client connecté", async () => {
    const other = await makeFundedUser(created, { balance: 0 });
    await makeTransaction(other.id);
    const u = await login();
    const mine = await makeTransaction(u.id);
    const { json } = await list();
    expect(json.data.map((t: { id: string }) => t.id)).toEqual([mine.id]);
  });

  it('pagine : limit=2 sur 5 lignes donne 2, puis 2, puis 1, sans doublon ni oubli', async () => {
    const u = await login();
    const ids: string[] = [];
    for (let i = 1; i <= 5; i++)
      ids.push((await makeTransaction(u.id, { created_at: minute(i) })).id);
    const expected = [...ids].reverse();
    const seen: string[] = [];
    let cursor: string | null = null;
    const sizes: number[] = [];
    for (let guard = 0; guard < 5; guard++) {
      const { json } = await list(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      sizes.push(json.data.length);
      seen.push(...json.data.map((t: { id: string }) => t.id));
      cursor = json.next_cursor;
      if (!cursor) break;
    }
    expect(sizes).toEqual([2, 2, 1]);
    expect(seen).toEqual(expected);
  });

  it('filtre par type : type=order ne renvoie que les achats', async () => {
    const u = await login();
    const s = await makeFollowersService();
    const order = await makeOrder(u.id, s.id);
    await makeTransaction(u.id, { type: 'recharge', created_at: minute(1) });
    const debit = await makeTransaction(u.id, {
      type: 'order',
      amount_xaf: -150,
      order_id: order.id,
      created_at: minute(2),
    });
    const { json } = await list('?type=order');
    expect(json.data.map((t: { id: string }) => t.id)).toEqual([debit.id]);
    expect(json.data[0].type).toBe('order');
    expect(json.data[0].order_short_id).toBeDefined();
  });

  it.each(['gift', 'ORDER', ''])('refuse le type %j (400 VALIDATION_ERROR)', async (type) => {
    await login();
    const { res, json } = await list(`?type=${type}`);
    expect(res.status).toBe(400);
    expect((json as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it.each(['0', '101', '-1', 'abc'])('refuse limit=%s (400 VALIDATION_ERROR)', async (limit) => {
    await login();
    const { res } = await list(`?limit=${limit}`);
    expect(res.status).toBe(400);
  });

  it('refuse un curseur invalide (400 VALIDATION_ERROR)', async () => {
    await login();
    const { res, json } = await list('?cursor=pas-un-curseur');
    expect(res.status).toBe(400);
    expect((json as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });
});
