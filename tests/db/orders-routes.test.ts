import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import { makeUser, type TestUser } from '../factories/user';
import {
  FORBIDDEN_ORDER_KEYS,
  TIKTOK_LINK,
  balanceOf,
  cleanupUsers,
  makeFakeProvider,
  makeFollowersService,
  makeFundedUser,
  newKey,
  ordersOf,
  resetOrderSettings,
  restoreOrderSettingsAfterAll,
  type FakeProvider,
} from '../helpers/orders-db';
import { userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const h = vi.hoisted(() => ({ provider: null as unknown as FakeProvider }));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));

// La session du navigateur est remplacée par un vrai client connecté (la RLS reste réelle).
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { GET as getOrder } from '@/app/api/v1/orders/[id]/route';
import { POST as quoteRoute } from '@/app/api/v1/orders/quote/route';
import { GET as listOrders, POST as createOrderRoute } from '@/app/api/v1/orders/route';

/*
 * Routes attendues (API_SPEC §6.5), préfixe /api/v1, format d erreur §3, fichiers :
 *   src/app/api/v1/orders/quote/route.ts   POST /orders/quote  {service_id, quantity}
 *        -> 200 {price_xaf_1000, discount_pct, total_xaf, balance_after_xaf}  (aucun débit)
 *   src/app/api/v1/orders/route.ts
 *        POST /orders  en-tête Idempotency-Key obligatoire, {service_id, link, quantity, comments?, expected_total_xaf}
 *             -> 201 Order (in_progress) | 202 Order (to_review)
 *        GET  /orders?status=&limit=&cursor= -> 200 {data: Order[], next_cursor: string | null}
 *   src/app/api/v1/orders/[id]/route.ts    GET /orders/{id} -> 200 Order | 404 (commande d un autre client = 404)
 *   (signature Next 15 : GET(req, { params: Promise<{ id: string }> }))
 * POST : Origin = site (sinon 403 FORBIDDEN) ; non connecté : 401 UNAUTHENTICATED ; client bloqué : 403 ACCOUNT_BLOCKED.
 * Order = {id, short_id, service: {id, name, platform}, link, quantity, charged_xaf, status, start_count, remains,
 *          created_at, updated_at} et RIEN d autre.
 */

const ORIGIN = 'http://localhost:3000';
const created: string[] = [];
restoreOrderSettingsAfterAll();

type ErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown>; request_id: string };
};
const ORDER_KEYS = [
  'charged_xaf',
  'created_at',
  'id',
  'link',
  'quantity',
  'remains',
  'service',
  'short_id',
  'start_count',
  'status',
  'updated_at',
];

async function login(
  opts: Parameters<typeof makeFundedUser>[1] = { balance: 5000 },
): Promise<TestUser> {
  const u = await makeFundedUser(created, opts);
  session.client = await userClient(u.id);
  return u;
}

beforeEach(async () => {
  session.client = null;
  h.provider = makeFakeProvider(100);
  await resetOrderSettings();
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const get = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`${ORIGIN}${path}`, { headers });

const body = (serviceId: number, over: Record<string, unknown> = {}) => ({
  service_id: serviceId,
  link: TIKTOK_LINK,
  quantity: 1000,
  expected_total_xaf: 1155,
  ...over,
});
const send = (
  payload: unknown,
  key: string | null = newKey(),
  headers: Record<string, string> = {},
) =>
  createOrderRoute(
    post('/api/v1/orders', payload, { ...(key ? { 'idempotency-key': key } : {}), ...headers }),
  );

describe('POST /api/v1/orders/quote', () => {
  it('1 000 abonnés : 200 avec prix, remise, total et solde après, sans aucun débit', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const res = await quoteRoute(
      post('/api/v1/orders/quote', { service_id: s.id, quantity: 1000 }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      price_xaf_1000: 1155,
      discount_pct: 0,
      total_xaf: 1155,
      balance_after_xaf: 3845,
    });
    expect(await balanceOf(u.id)).toBe(5000);
    expect(await ordersOf(u.id)).toHaveLength(0);
  });

  it('ignore un total envoyé par le navigateur', async () => {
    const s = await makeFollowersService();
    await login();
    const res = await quoteRoute(
      post('/api/v1/orders/quote', { service_id: s.id, quantity: 1000, total_xaf: 1 }),
    );
    expect(((await res.json()) as { total_xaf: number }).total_xaf).toBe(1155);
  });

  it('quantité hors limites : 422 QUANTITY_OUT_OF_RANGE avec min et max', async () => {
    const s = await makeFollowersService({ min_qty: 10, max_qty: 10_000 });
    await login();
    const res = await quoteRoute(post('/api/v1/orders/quote', { service_id: s.id, quantity: 5 }));
    expect(res.status).toBe(422);
    const b = (await res.json()) as ErrorBody;
    expect(b.error.code).toBe('QUANTITY_OUT_OF_RANGE');
    expect(b.error.details).toEqual({ min: 10, max: 10_000 });
  });

  it('non connecté : 401 UNAUTHENTICATED', async () => {
    const res = await quoteRoute(post('/api/v1/orders/quote', { service_id: 1, quantity: 10 }));
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('corps invalide : 400 VALIDATION_ERROR', async () => {
    await login();
    const res = await quoteRoute(post('/api/v1/orders/quote', { service_id: 'abc', quantity: -1 }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/orders', () => {
  it('succès : 201, commande in_progress, solde débité, forme Order sans champ interne', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const res = await send(body(s.id));
    expect(res.status).toBe(201);
    const order = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(order).sort()).toEqual(ORDER_KEYS);
    for (const k of FORBIDDEN_ORDER_KEYS) expect(order).not.toHaveProperty(k);
    expect(JSON.stringify(order)).not.toMatch(/provider|fournisseur|jap/i);
    expect(order).toMatchObject({ status: 'in_progress', charged_xaf: 1155, quantity: 1000 });
    expect(await balanceOf(u.id)).toBe(3845);
  });

  it('échec du fournisseur : 202, commande to_review, solde toujours débité, aucun détail fournisseur', async () => {
    const s = await makeFollowersService();
    const u = await login();
    h.provider.add.mockRejectedValue(new Error('JAP: secret-detail'));
    const res = await send(body(s.id));
    expect(res.status).toBe(202);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ status: 'to_review' });
    expect(text).not.toMatch(/secret-detail|JAP/);
    expect(await balanceOf(u.id)).toBe(3845);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
  });

  it('double clic (même Idempotency-Key) : même commande, un seul débit, statut < 300 aux deux appels', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const key = newKey();
    const a = await send(body(s.id), key);
    const b = await send(body(s.id), key);
    expect(a.status).toBe(201);
    expect(b.status).toBeLessThan(300);
    expect(((await b.json()) as { id: string }).id).toBe(((await a.json()) as { id: string }).id);
    expect(await ordersOf(u.id)).toHaveLength(1);
    expect(await balanceOf(u.id)).toBe(3845);
  });

  it('même clé, contenu différent : 409 IDEMPOTENCY_CONFLICT', async () => {
    const s = await makeFollowersService();
    await login();
    const key = newKey();
    await send(body(s.id), key);
    const res = await send(body(s.id, { quantity: 2000, expected_total_xaf: 2310 }), key);
    expect(res.status).toBe(409);
    expect(((await res.json()) as ErrorBody).error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('sans Idempotency-Key : 400 VALIDATION_ERROR, aucune commande', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const res = await send(body(s.id), null);
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    expect(await ordersOf(u.id)).toHaveLength(0);
  });

  it('non connecté : 401 UNAUTHENTICATED', async () => {
    const s = await makeFollowersService();
    const res = await send(body(s.id));
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('Origin étranger : 403 FORBIDDEN, aucun débit', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const res = await send(body(s.id), newKey(), { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(((await res.json()) as ErrorBody).error.code).toBe('FORBIDDEN');
    expect(await balanceOf(u.id)).toBe(5000);
  });

  it('client bloqué : 403 ACCOUNT_BLOCKED', async () => {
    const s = await makeFollowersService();
    await login({ balance: 5000, profile: { status: 'blocked' } });
    const res = await send(body(s.id));
    expect(res.status).toBe(403);
    expect(((await res.json()) as ErrorBody).error.code).toBe('ACCOUNT_BLOCKED');
  });

  it('solde insuffisant : 422 INSUFFICIENT_BALANCE avec missing_xaf = 155, message FR puis EN avec le montant', async () => {
    const s = await makeFollowersService();
    await login({ balance: 1000 });
    const fr = await send(body(s.id), newKey(), { cookie: 'NEXT_LOCALE=fr' });
    expect(fr.status).toBe(422);
    const frBody = (await fr.json()) as ErrorBody;
    expect(frBody.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(frBody.error.details).toEqual({ missing_xaf: 155 });
    expect(frBody.error.message).toMatch(/155/);
    const en = (await (
      await send(body(s.id), newKey(), { cookie: 'NEXT_LOCALE=en' })
    ).json()) as ErrorBody;
    expect(en.error.message).toMatch(/155/);
    expect(en.error.message).not.toBe(frBody.error.message);
  });

  it('prix changé : 422 PRICE_CHANGED avec new_total_xaf, aucun débit', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const res = await send(body(s.id, { expected_total_xaf: 900 }));
    expect(res.status).toBe(422);
    const b = (await res.json()) as ErrorBody;
    expect(b.error.code).toBe('PRICE_CHANGED');
    expect(b.error.details).toEqual({ new_total_xaf: 1155 });
    expect(await balanceOf(u.id)).toBe(5000);
  });

  it('lien d une autre plateforme : 422 INVALID_LINK avec un message FR clair et un message EN', async () => {
    const s = await makeFollowersService();
    await login();
    const link = 'https://www.instagram.com/p/Cabc/';
    const fr = (await (
      await send(body(s.id, { link }), newKey(), { cookie: 'NEXT_LOCALE=fr' })
    ).json()) as ErrorBody;
    const en = (await (
      await send(body(s.id, { link }), newKey(), { cookie: 'NEXT_LOCALE=en' })
    ).json()) as ErrorBody;
    expect(fr.error.code).toBe('INVALID_LINK');
    expect(fr.error.message).toMatch(/lien/i);
    expect(en.error.message).toMatch(/link/i);
  });

  it('plafond journalier atteint : 422 DAILY_LIMIT_REACHED avec limit_xaf', async () => {
    const s = await makeFollowersService({ price_xaf_1000: 1000, max_qty: 200_000 });
    await login({ balance: 1_000_000 });
    const res = await send(body(s.id, { quantity: 100_005, expected_total_xaf: 100_005 }));
    expect(res.status).toBe(422);
    const b = (await res.json()) as ErrorBody;
    expect(b.error.code).toBe('DAILY_LIMIT_REACHED');
    expect(b.error.details).toEqual({ limit_xaf: 100_000 });
  });

  it('service inactif : 422 SERVICE_UNAVAILABLE', async () => {
    const s = await makeFollowersService({ active: false });
    await login();
    const res = await send(body(s.id));
    expect(res.status).toBe(422);
    expect(((await res.json()) as ErrorBody).error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it.each([
    ['total attendu décimal', { expected_total_xaf: 1155.5 }],
    ['quantité en texte', { quantity: '1000' }],
    ['lien absent', { link: undefined }],
  ])('%s : 400 VALIDATION_ERROR', async (_l, patch) => {
    const s = await makeFollowersService();
    await login();
    const res = await send(body(s.id, patch));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('JSON cassé : 400, pas 500', async () => {
    await login();
    const res = await send('{pas du json');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/orders', () => {
  it('liste uniquement les commandes du client, la plus récente d abord, forme Order sans champ interne', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const other = await makeUser();
    created.push(other.id);
    const mine = await makeOrder(u.id, s.id);
    await makeOrder(other.id, s.id);
    const res = await listOrders(get('/api/v1/orders'));
    expect(res.status).toBe(200);
    const b = (await res.json()) as { data: Record<string, unknown>[]; next_cursor: string | null };
    expect(b.data.map((o) => o.id)).toEqual([mine.id]);
    expect(Object.keys(b.data[0]!).sort()).toEqual(ORDER_KEYS);
    expect(b.next_cursor).toBeNull();
  });

  it('pagination par curseur : 3 commandes, limit=2 puis page suivante avec le curseur', async () => {
    const s = await makeFollowersService();
    const u = await login();
    for (let i = 0; i < 3; i++) await makeOrder(u.id, s.id);
    const first = (await (await listOrders(get('/api/v1/orders?limit=2'))).json()) as {
      data: { id: string }[];
      next_cursor: string | null;
    };
    expect(first.data).toHaveLength(2);
    expect(first.next_cursor).toBeTruthy();
    const second = (await (
      await listOrders(
        get(`/api/v1/orders?limit=2&cursor=${encodeURIComponent(first.next_cursor!)}`),
      )
    ).json()) as { data: { id: string }[]; next_cursor: string | null };
    expect(second.data).toHaveLength(1);
    expect(second.next_cursor).toBeNull();
    const ids = [...first.data, ...second.data].map((o) => o.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('filtre ?status=to_review', async () => {
    const s = await makeFollowersService();
    const u = await login();
    await makeOrder(u.id, s.id, { status: 'to_review' });
    await makeOrder(u.id, s.id, { status: 'completed' });
    const b = (await (await listOrders(get('/api/v1/orders?status=to_review'))).json()) as {
      data: { status: string }[];
    };
    expect(b.data).toHaveLength(1);
    expect(b.data[0]!.status).toBe('to_review');
  });

  it('limit au-dessus de 100 ou statut inconnu : 400 VALIDATION_ERROR', async () => {
    await login();
    expect((await listOrders(get('/api/v1/orders?limit=101'))).status).toBe(400);
    expect((await listOrders(get('/api/v1/orders?status=nimporte'))).status).toBe(400);
  });

  it('non connecté : 401 UNAUTHENTICATED', async () => {
    const res = await listOrders(get('/api/v1/orders'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/orders/{id}', () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it('renvoie la commande du client (forme Order, sans champ interne)', async () => {
    const s = await makeFollowersService();
    const u = await login();
    const o = await makeOrder(u.id, s.id, { error: 'JAP: secret-detail', cost_usd: 0.15 });
    const res = await getOrder(get(`/api/v1/orders/${o.id}`), params(o.id));
    expect(res.status).toBe(200);
    const text = await res.text();
    const order = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(order).sort()).toEqual(ORDER_KEYS);
    expect(text).not.toMatch(/secret-detail|JAP|cost_usd/);
  });

  it('la commande d un autre client : 404 (jamais son contenu)', async () => {
    const s = await makeFollowersService();
    await login();
    const other = await makeUser();
    created.push(other.id);
    const theirs = await makeOrder(other.id, s.id);
    const res = await getOrder(get(`/api/v1/orders/${theirs.id}`), params(theirs.id));
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorBody).error.code).toMatch(/^(NOT_FOUND|ORDER_NOT_FOUND)$/);
  });

  it('identifiant inconnu ou invalide : 404', async () => {
    await login();
    const unknown = '00000000-0000-4000-8000-000000000000';
    expect((await getOrder(get(`/api/v1/orders/${unknown}`), params(unknown))).status).toBe(404);
    expect((await getOrder(get('/api/v1/orders/abc'), params('abc'))).status).toBe(404);
  });

  it('non connecté : 401', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect((await getOrder(get(`/api/v1/orders/${id}`), params(id))).status).toBe(401);
  });
});
