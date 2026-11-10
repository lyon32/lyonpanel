import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStore } from '../../helpers/memory-attempt-store';

vi.mock('server-only', () => ({}));

// API_SPEC §5 : POST /orders = 10 / minute par client. Compteur en mémoire, aucun accès base.
// Même mécanisme que POST /payments : createRateLimiter({ store: createAttemptStore(...) }).consume(
//   { scope: 'orders', key: user.id, max: 10, windowSeconds: 60 }) AVANT tout appel à placeOrder.
const h = vi.hoisted(() => ({ userId: 'user-a', store: undefined as unknown }));
vi.mock('@/server/auth/require-api-user', () => ({
  requireApiUser: vi.fn(async () => ({ id: h.userId })),
}));
vi.mock('@/server/db/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => ({}) }));
const placeOrder = vi.hoisted(() =>
  vi.fn(async () => ({ id: 'o-1', status: 'in_progress', charged_xaf: 1155 })),
);
vi.mock('@/server/orders/place-order', () => ({ placeOrder }));
vi.mock('@/server/auth/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/server/auth/rate-limit')>()),
  createAttemptStore: () => h.store,
}));

const post = (key = crypto.randomUUID()) =>
  new NextRequest('http://localhost:3000/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify({
      service_id: 1,
      link: 'https://www.tiktok.com/@client',
      quantity: 100,
      expected_total_xaf: 1155,
    }),
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'idempotency-key': key,
    },
  });

beforeEach(() => {
  h.store = memoryStore().store;
  h.userId = 'user-a';
  placeOrder.mockClear();
});

describe('limite de débit POST /api/v1/orders (10 / minute / client)', () => {
  it('laisse passer les 10 premières commandes (201)', async () => {
    const { POST } = await import('@/app/api/v1/orders/route');
    for (let i = 0; i < 10; i++) expect((await POST(post())).status).toBe(201);
  });

  it('refuse la 11e en 1 minute : 429 RATE_LIMITED avec Retry-After, placeOrder non appelé', async () => {
    const { POST } = await import('@/app/api/v1/orders/route');
    for (let i = 0; i < 10; i++) await POST(post());
    placeOrder.mockClear();
    const res = await POST(post());
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string; request_id: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.request_id).toMatch(/^req_/);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('la limite est par client : un autre client passe encore', async () => {
    const { POST } = await import('@/app/api/v1/orders/route');
    for (let i = 0; i < 11; i++) await POST(post());
    h.userId = 'user-b';
    expect((await POST(post())).status).toBe(201);
  });
});

describe('limite de débit POST /api/v1/orders/quote (60 / minute / client)', () => {
  const quote = () =>
    new NextRequest('http://localhost:3000/api/v1/orders/quote', {
      method: 'POST',
      body: JSON.stringify({ service_id: 1, quantity: 100 }),
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    });

  it('refuse le 61e devis en 1 minute : 429 RATE_LIMITED avec Retry-After', async () => {
    vi.doMock('@/server/orders/quote', () => ({
      quoteOrder: vi.fn(async () => ({ total_xaf: 1155 })),
    }));
    const { POST } = await import('@/app/api/v1/orders/quote/route');
    for (let i = 0; i < 60; i++) expect((await POST(quote())).status).toBe(200);
    const res = await POST(quote());
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
