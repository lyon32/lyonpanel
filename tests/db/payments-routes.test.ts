import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePayment } from '../factories/payment';
import { makeUser, removeUser, type TestUser } from '../factories/user';
import {
  restoreRechargeStateAfterAll,
  setRechargeSettings,
  setupFakeSaspayEnv,
  walletOf,
} from '../helpers/payments-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

// La session du navigateur est remplacée par un vrai client connecté (la RLS reste réelle).
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? {
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    },
}));

import { GET as getPayment } from '@/app/api/v1/payments/[id]/route';
import { GET as listPayments, POST as createPaymentRoute } from '@/app/api/v1/payments/route';
import { POST as quoteRoute } from '@/app/api/v1/payments/quote/route';

// Routes attendues (API_SPEC §6.6), préfixe /api/v1, format d'erreur §3 :
//   POST /payments/quote  {amount_xaf} -> 200 {amount_xaf, fee_xaf, total_to_pay}
//   POST /payments        en-tête Idempotency-Key, {amount_xaf} -> 201 {id, status: "pending", checkout_url}
//   GET  /payments        -> {data: [{id, amount_xaf, fee_xaf, status, created_at}], next_cursor}
//   GET  /payments/{id}   -> {id, amount_xaf, fee_xaf, status, created_at}
// POST : en-tête Origin identique au site (CSRF). Utilisateur non connecté : 401 UNAUTHENTICATED.

setupFakeSaspayEnv();
restoreRechargeStateAfterAll();
const db = adminClient();
const created: string[] = [];
const ORIGIN = 'http://localhost:3000';

async function login(): Promise<TestUser> {
  const u = await makeUser();
  created.push(u.id);
  session.client = await userClient(u.id);
  return u;
}

beforeEach(async () => {
  session.client = null;
  await setRechargeSettings();
});
afterEach(async () => {
  vi.restoreAllMocks();
  session.client = null;
  while (created.length) await removeUser(created.pop()!);
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const get = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`${ORIGIN}${path}`, { headers });

type ErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown>; request_id: string };
};

describe('POST /api/v1/payments/quote', () => {
  it('3 000 XAF : frais 90, total 3 090 (calculés côté serveur)', async () => {
    await login();
    const res = await quoteRoute(post('/api/v1/payments/quote', { amount_xaf: 3000 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ amount_xaf: 3000, fee_xaf: 90, total_to_pay: 3090 });
  });

  it('ignore les frais et le total envoyés par le navigateur', async () => {
    await login();
    const res = await quoteRoute(
      post('/api/v1/payments/quote', { amount_xaf: 3000, fee_xaf: 0, total_to_pay: 1 }),
    );
    expect(await res.json()).toEqual({ amount_xaf: 3000, fee_xaf: 90, total_to_pay: 3090 });
  });

  it('499 XAF : 422 AMOUNT_BELOW_MINIMUM avec le minimum lu des réglages', async () => {
    await login();
    const res = await quoteRoute(post('/api/v1/payments/quote', { amount_xaf: 499 }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('AMOUNT_BELOW_MINIMUM');
    expect(body.error.details).toEqual({ min_xaf: 500 });
  });
});

describe('POST /api/v1/payments', () => {
  it('crée la recharge : 201 {id, status: pending, checkout_url}', async () => {
    const u = await login();
    const res = await createPaymentRoute(
      post('/api/v1/payments', { amount_xaf: 3000 }, { 'idempotency-key': randomUUID() }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; status: string; checkout_url: string };
    expect(body.status).toBe('pending');
    expect(body.checkout_url).toMatch(/^https?:\/\//);
    expect(Object.keys(body).sort()).toEqual(['checkout_url', 'id', 'status']);
    const { data } = await db
      .from('payments')
      .select('user_id,total_paid')
      .eq('id', body.id)
      .single();
    expect(data).toMatchObject({ user_id: u.id, total_paid: 3090 });
  });

  it('même Idempotency-Key deux fois : même paiement, une seule ligne', async () => {
    await login();
    const key = randomUUID();
    const send = () =>
      createPaymentRoute(
        post('/api/v1/payments', { amount_xaf: 3000 }, { 'idempotency-key': key }),
      );
    const a = (await (await send()).json()) as { id: string };
    const bRes = await send();
    expect(bRes.status).toBeLessThan(300);
    const b = (await bRes.json()) as { id: string };
    expect(b.id).toBe(a.id);
    const { data } = await db.from('payments').select('id').eq('idem_key', key);
    expect(data).toHaveLength(1);
  });

  it('sans Idempotency-Key : 400 VALIDATION_ERROR', async () => {
    await login();
    const res = await createPaymentRoute(post('/api/v1/payments', { amount_xaf: 3000 }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('utilisateur non connecté : 401 UNAUTHENTICATED, aucune recharge créée', async () => {
    const key = randomUUID();
    const res = await createPaymentRoute(
      post('/api/v1/payments', { amount_xaf: 3000 }, { 'idempotency-key': key }),
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    const { data } = await db.from('payments').select('id').eq('idem_key', key);
    expect(data).toHaveLength(0);
  });

  it('requête venant d un autre site (Origin étranger) : 403 FORBIDDEN', async () => {
    await login();
    const res = await createPaymentRoute(
      post(
        '/api/v1/payments',
        { amount_xaf: 3000 },
        { 'idempotency-key': randomUUID(), origin: 'https://evil.example' },
      ),
    );
    expect(res.status).toBe(403);
    expect(((await res.json()) as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it.each([
    ['zéro', { amount_xaf: 0 }],
    ['négatif', { amount_xaf: -500 }],
    ['décimal', { amount_xaf: 3000.5 }],
    ['texte', { amount_xaf: '3000' }],
    ['absent', {}],
  ])('montant %s : 400 VALIDATION_ERROR au format unique', async (_label, payload) => {
    await login();
    const res = await createPaymentRoute(
      post('/api/v1/payments', payload, { 'idempotency-key': randomUUID() }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.request_id).toMatch(/^req_/);
  });

  it('JSON cassé : 400 VALIDATION_ERROR, pas 500', async () => {
    await login();
    const res = await createPaymentRoute(
      post('/api/v1/payments', '{pas du json', { 'idempotency-key': randomUUID() }),
    );
    expect(res.status).toBe(400);
  });

  it('499 XAF : 422 AMOUNT_BELOW_MINIMUM, message en français puis en anglais', async () => {
    await login();
    const send = (cookie: string) =>
      createPaymentRoute(
        post('/api/v1/payments', { amount_xaf: 499 }, { 'idempotency-key': randomUUID(), cookie }),
      );
    const fr = (await (await send('NEXT_LOCALE=fr')).json()) as ErrorBody;
    const en = (await (await send('NEXT_LOCALE=en')).json()) as ErrorBody;
    expect(fr.error.code).toBe('AMOUNT_BELOW_MINIMUM');
    expect(en.error.code).toBe('AMOUNT_BELOW_MINIMUM');
    expect(fr.error.message).toContain('500');
    expect(en.error.message).toContain('500');
    expect(fr.error.message).not.toBe(en.error.message);
  });

  it('le montant et les frais viennent du serveur, jamais du navigateur', async () => {
    await login();
    const res = await createPaymentRoute(
      post(
        '/api/v1/payments',
        { amount_xaf: 3000, fee_xaf: 0, total_paid: 3000, total_to_pay: 3000 },
        { 'idempotency-key': randomUUID() },
      ),
    );
    const { id } = (await res.json()) as { id: string };
    const { data } = await db.from('payments').select('fee_xaf,total_paid').eq('id', id).single();
    expect(data).toEqual({ fee_xaf: 90, total_paid: 3090 });
  });

  it('créer une recharge ne modifie pas le solde (seul le webhook crédite)', async () => {
    const u = await login();
    await createPaymentRoute(
      post('/api/v1/payments', { amount_xaf: 3000 }, { 'idempotency-key': randomUUID() }),
    );
    expect((await walletOf(u.id)).balance_xaf).toBe(0);
  });
});

describe('GET /api/v1/payments et /payments/{id}', () => {
  it('liste uniquement les recharges du client connecté, avec les seules colonnes prévues', async () => {
    const a = await login();
    const b = await makeUser();
    created.push(b.id);
    const mine = await makePayment(a.id, { credited_xaf: 3000, fee_xaf: 90, total_paid: 3090 });
    const theirs = await makePayment(b.id);

    const res = await listPayments(get('/api/v1/payments'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Record<string, unknown>[];
      next_cursor: string | null;
    };
    const ids = body.data.map((p) => p.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    expect('next_cursor' in body).toBe(true);
    const row = body.data.find((p) => p.id === mine.id)!;
    expect(Object.keys(row).sort()).toEqual([
      'amount_xaf',
      'created_at',
      'fee_xaf',
      'id',
      'status',
    ]);
    expect(row).toMatchObject({ amount_xaf: 3000, fee_xaf: 90 });
  });

  it('non connecté : 401 sur la liste et sur le détail', async () => {
    expect((await listPayments(get('/api/v1/payments'))).status).toBe(401);
    const res = await getPayment(get('/api/v1/payments/x'), {
      params: Promise.resolve({ id: randomUUID() }),
    });
    expect(res.status).toBe(401);
  });

  it('détail d une recharge à soi : 200 avec le statut courant', async () => {
    const a = await login();
    const mine = await makePayment(a.id, { status: 'pending' });
    const res = await getPayment(get(`/api/v1/payments/${mine.id}`), {
      params: Promise.resolve({ id: mine.id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ id: mine.id, status: 'pending' });
    expect(Object.keys(body).sort()).toEqual([
      'amount_xaf',
      'created_at',
      'fee_xaf',
      'id',
      'status',
    ]);
  });

  it('détail de la recharge d un autre client : 404, rien n est révélé', async () => {
    await login();
    const other = await makeUser();
    created.push(other.id);
    const theirs = await makePayment(other.id);
    const res = await getPayment(get(`/api/v1/payments/${theirs.id}`), {
      params: Promise.resolve({ id: theirs.id }),
    });
    expect(res.status).toBe(404);
    expect(['PAYMENT_NOT_FOUND', 'NOT_FOUND']).toContain(
      ((await res.json()) as ErrorBody).error.code,
    );
  });

  it('identifiant illisible : 404, pas 500', async () => {
    await login();
    const res = await getPayment(get('/api/v1/payments/abc'), {
      params: Promise.resolve({ id: 'abc' }),
    });
    expect(res.status).toBe(404);
  });
});
