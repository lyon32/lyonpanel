import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStore } from '../../helpers/memory-attempt-store';

vi.mock('server-only', () => ({}));

// API_SPEC §5 : POST /payments = 5 / minute par client. Compteur en mémoire, aucun accès base.
const h = vi.hoisted(() => ({ userId: 'user-a', store: undefined as unknown }));
vi.mock('@/server/auth/require-api-user', () => ({
  requireApiUser: vi.fn(async () => ({ id: h.userId })),
}));
vi.mock('@/server/db/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () => ({
    from: () => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'order', 'limit', 'lt']) q[m] = () => q;
      q.then = (ok: (v: unknown) => unknown) => ok({ data: [], error: null });
      return q;
    },
  }),
}));
vi.mock('@/server/payments/create-payment', () => ({
  createPayment: vi.fn(async () => ({ id: 'pay-1', checkoutUrl: 'https://pay.test/c' })),
}));
vi.mock('@/server/payments/quote', () => ({
  quotePayment: vi.fn(async (a: number) => ({ amountXaf: a, feeXaf: 0, totalToPay: a })),
}));
vi.mock('@/server/auth/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/server/auth/rate-limit')>()),
  createAttemptStore: () => h.store,
}));

const post = (url: string, key = crypto.randomUUID()) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method: 'POST',
    body: JSON.stringify({ amount_xaf: 3000 }),
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'idempotency-key': key,
    },
  });

beforeEach(() => {
  h.store = memoryStore().store;
  h.userId = 'user-a';
});

describe('limite de débit POST /api/v1/payments (5 / minute / client)', () => {
  it('laisse passer les 5 premières créations (201)', async () => {
    const { POST } = await import('@/app/api/v1/payments/route');
    for (let i = 0; i < 5; i++) expect((await POST(post('/api/v1/payments'))).status).toBe(201);
  });

  it('refuse la 6e en 1 minute : 429 RATE_LIMITED, Retry-After, format API_SPEC §3', async () => {
    const { POST } = await import('@/app/api/v1/payments/route');
    for (let i = 0; i < 5; i++) await POST(post('/api/v1/payments'));
    const res = await POST(post('/api/v1/payments'));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(Number(res.headers.get('retry-after'))).toBeLessThanOrEqual(60);
    const { error } = await res.json();
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.message).toEqual(expect.any(String));
    expect(error.request_id).toMatch(/^req_/);
  });

  it('ne limite pas un autre client', async () => {
    const { POST } = await import('@/app/api/v1/payments/route');
    for (let i = 0; i < 5; i++) await POST(post('/api/v1/payments'));
    expect((await POST(post('/api/v1/payments'))).status).toBe(429);
    h.userId = 'user-b';
    expect((await POST(post('/api/v1/payments'))).status).toBe(201);
  });

  it('la limite repart après 1 minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const { POST } = await import('@/app/api/v1/payments/route');
      for (let i = 0; i < 5; i++) await POST(post('/api/v1/payments'));
      expect((await POST(post('/api/v1/payments'))).status).toBe(429);
      vi.setSystemTime(Date.now() + 61_000);
      expect((await POST(post('/api/v1/payments'))).status).toBe(201);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ne s’applique pas au devis (/quote) : 10 devis passent', async () => {
    const { POST } = await import('@/app/api/v1/payments/quote/route');
    for (let i = 0; i < 10; i++)
      expect((await POST(post('/api/v1/payments/quote'))).status).toBe(200);
  });

  it('ne s’applique pas à GET : 10 listes passent même après 6 créations', async () => {
    const { POST, GET } = await import('@/app/api/v1/payments/route');
    for (let i = 0; i < 5; i++) await POST(post('/api/v1/payments'));
    expect((await POST(post('/api/v1/payments'))).status).toBe(429);
    for (let i = 0; i < 10; i++) {
      const res = await GET(new NextRequest('http://localhost:3000/api/v1/payments'));
      expect(res.status).toBe(200);
    }
  });
});
