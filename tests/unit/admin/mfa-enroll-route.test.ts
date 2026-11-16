import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeMfaSupabase } from '../../helpers/fake-mfa-session';
import { memoryStore } from '../../helpers/memory-attempt-store';
import type { AttemptStore } from '@/server/auth/rate-limit';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const ref = vi.hoisted(() => ({ store: null as AttemptStore | null, client: null as unknown }));
vi.mock('@/server/db/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/server/auth/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/server/auth/rate-limit')>()),
  createAttemptStore: () => ref.store,
}));
vi.mock('@/server/auth/require-admin', () => ({
  requireAdminUser: async () => ({ id: 'admin-1', supabase: ref.client }),
}));

import { POST, PUT } from '@/app/api/v1/admin/mfa/enroll/route';

/*
 * Limiteur sur POST et PUT /api/v1/admin/mfa/enroll (relecture 11.5 point 3c) : au plus 10 appels par administrateur
 * et par 15 minutes (createRateLimiter, portée propre à l'enrôlement), au-delà 429 RATE_LIMITED.
 * Le compteur des mauvais codes (admin-mfa) est un autre compteur : il n'est pas touché ici.
 */

const FACTOR_ID = '0b9f5f0e-3c1e-4c53-9a3a-5c1b8e9d2a11';
const request = (method: 'POST' | 'PUT', body?: unknown) =>
  new NextRequest('http://localhost/api/v1/admin/mfa/enroll', {
    method,
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const statuses = async (n: number, call: () => Promise<Response>) => {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((await call()).status);
  return out;
};

beforeEach(() => {
  ref.store = memoryStore().store;
  ref.client = fakeMfaSupabase({ factors: [] }).client;
});

describe('POST /api/v1/admin/mfa/enroll : limiteur', () => {
  it('les premiers appels passent, le 12e est refusé en 429 RATE_LIMITED', async () => {
    const res = await statuses(12, () => POST(request('POST')));
    expect(res[0]).toBe(200);
    expect(res.filter((s) => s === 200).length).toBeLessThanOrEqual(10);
    expect(res[11]).toBe(429);
    const last = await POST(request('POST'));
    expect((await last.json()).error.code).toBe('RATE_LIMITED');
  });
});

describe('PUT /api/v1/admin/mfa/enroll : limiteur', () => {
  it('les premiers appels (bon code) passent, le 12e est refusé en 429 RATE_LIMITED', async () => {
    const body = { factor_id: FACTOR_ID, code: '123456' };
    const res = await statuses(12, () => PUT(request('PUT', body)));
    expect(res[0]).toBe(200);
    expect(res.filter((s) => s === 200).length).toBeLessThanOrEqual(10);
    expect(res[11]).toBe(429);
  });
});
