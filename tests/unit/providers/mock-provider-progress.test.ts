import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { forceMockOrderStatus, createMockProvider } from '@/server/providers/mock-provider';
import { POST as failNext } from '@/app/api/test/provider/fail-next/route';
import { POST as forceStatus } from '@/app/api/test/provider/force-status/route';

/*
 * Attendus (plan 7.3a), src/server/providers/mock-provider.ts :
 *   - status(ids) fait avancer chaque commande d un pas par appel : Pending -> In progress -> Completed
 *     (puis reste Completed, remains = 0) ;
 *   - forceMockOrderStatus(providerOrderId: number, status: 'Partial' | 'Canceled'): le prochain status() renvoie ce statut ;
 *   - route POST /api/test/provider/force-status  { providerOrderId, status }  (en-tête x-test-secret = TEST_ROUTE_SECRET) ;
 *   - route POST /api/test/provider/fail-next protégée par TEST_ROUTE_SECRET (plus SASPAY_WEBHOOK_SECRET),
 *     404 hors PROVIDER_MODE=mock ou en production.
 */

const ADD = { service: 900001, link: 'https://www.tiktok.com/@x/video/1', quantity: 1000 };
const SECRET = 'test_route_secret_only_for_tests';

describe('faux fournisseur : progression', () => {
  it('status() avance d un pas par appel : Pending -> In progress -> Completed, puis reste Completed', async () => {
    const p = createMockProvider();
    const { order } = await p.add(ADD);
    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) seen.push((await p.status([order]))[order]!.status);
    const first = seen.indexOf('In progress');
    const last = seen.indexOf('Completed');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(last).toBeGreaterThan(first);
    expect(seen.slice(last).every((s) => s === 'Completed')).toBe(true);
    expect(seen.slice(0, first).every((s) => s === 'Pending')).toBe(true);
    expect(new Set(seen.slice(first, last))).toEqual(new Set(['In progress']));
  });

  it('à Completed : remains vaut 0 ; avant : remains > 0', async () => {
    const p = createMockProvider();
    const { order } = await p.add(ADD);
    const first = (await p.status([order]))[order]!;
    expect(Number(first.remains)).toBeGreaterThan(0);
    let last = first;
    for (let i = 0; i < 5; i += 1) last = (await p.status([order]))[order]!;
    expect(last.status).toBe('Completed');
    expect(Number(last.remains)).toBe(0);
  });

  it('deux commandes avancent indépendamment', async () => {
    const p = createMockProvider();
    const a = (await p.add(ADD)).order;
    await p.status([a]);
    await p.status([a]);
    const b = (await p.add(ADD)).order;
    const out = await p.status([a, b]);
    expect(out[a]!.status).toBe('Completed');
    expect(out[b]!.status).not.toBe('Completed');
  });

  it('forceMockOrderStatus : le prochain status renvoie Partial puis Canceled', async () => {
    const p = createMockProvider();
    const a = (await p.add(ADD)).order;
    const b = (await p.add(ADD)).order;
    forceMockOrderStatus(a, 'Partial');
    forceMockOrderStatus(b, 'Canceled');
    const out = await p.status([a, b]);
    expect(out[a]!.status).toBe('Partial');
    expect(out[b]!.status).toBe('Canceled');
  });
});

function post(path: string, secret: string | null, body: unknown = {}) {
  return new NextRequest(`http://localhost/api/test/provider/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret === null ? {} : { 'x-test-secret': secret }),
    },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({}) } as never;

beforeEach(() => {
  vi.stubEnv('PROVIDER_MODE', 'mock');
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('TEST_ROUTE_SECRET', SECRET);
  vi.stubEnv('SASPAY_WEBHOOK_SECRET', 'autre_secret_saspay');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('routes de test du faux fournisseur', () => {
  it('fail-next : 200 avec TEST_ROUTE_SECRET', async () => {
    expect((await failNext(post('fail-next', SECRET), ctx)).status).toBe(200);
  });

  it('fail-next : refuse SASPAY_WEBHOOK_SECRET (secret dédié)', async () => {
    expect((await failNext(post('fail-next', 'autre_secret_saspay'), ctx)).status).toBe(403);
  });

  it('fail-next : refuse sans secret, et quand TEST_ROUTE_SECRET n est pas configuré', async () => {
    expect((await failNext(post('fail-next', null), ctx)).status).toBe(403);
    vi.stubEnv('TEST_ROUTE_SECRET', '');
    expect((await failNext(post('fail-next', ''), ctx)).status).toBe(403);
  });

  it('fail-next : 404 hors mode mock', async () => {
    vi.stubEnv('PROVIDER_MODE', 'live');
    expect((await failNext(post('fail-next', SECRET), ctx)).status).toBe(404);
  });

  it('fail-next : 404 en production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await failNext(post('fail-next', SECRET), ctx)).status).toBe(404);
  });

  it('force-status : 200 avec le bon secret et force le statut du fournisseur', async () => {
    const p = createMockProvider();
    const { order } = await p.add(ADD);
    const res = await forceStatus(
      post('force-status', SECRET, { providerOrderId: order, status: 'Partial' }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await p.status([order]))[order]!.status).toBe('Partial');
  });

  it('force-status : mauvais secret 403, hors mock 404, statut invalide 400', async () => {
    const body = { providerOrderId: 10_001, status: 'Partial' };
    expect((await forceStatus(post('force-status', 'faux', body), ctx)).status).toBe(403);
    expect(
      (await forceStatus(post('force-status', SECRET, { ...body, status: 'Completed' }), ctx))
        .status,
    ).toBe(400);
    vi.stubEnv('PROVIDER_MODE', 'live');
    expect((await forceStatus(post('force-status', SECRET, body), ctx)).status).toBe(404);
  });
});
