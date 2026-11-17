import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  sync: vi.fn(async (_deps?: { onPriceJump?: (j: unknown) => unknown }) => ({
    added: 0,
    removed: 0,
    repriced: 0,
    alerts: 0,
  })),
}));
vi.mock('@/server/catalog/sync-services', () => ({ syncServices: m.sync }));
vi.mock('@/server/catalog/supabase-catalog-store', () => ({
  createSupabaseCatalogStore: () => ({}),
}));
vi.mock('@/server/providers', () => ({ getProvider: () => ({}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { GET } from '@/app/api/cron/services/route';
import { notifyOwner } from '@/server/providers/telegram';

const SECRET = 'cron_test_only_not_a_real_secret';
const call = (authorization?: string) =>
  GET(
    new NextRequest('http://localhost/api/cron/services', {
      headers: authorization ? { authorization } : {},
    }),
    { params: Promise.resolve({}) } as never,
  );

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET);
  m.sync.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/cron/services', () => {
  it('401 sans secret, rien n est synchronisé', async () => {
    expect((await call()).status).toBe(401);
    expect(m.sync).not.toHaveBeenCalled();
  });

  it('401 avec un mauvais secret', async () => {
    expect((await call('Bearer nope')).status).toBe(401);
    expect(m.sync).not.toHaveBeenCalled();
  });

  it('200 avec le bon secret : lance la synchro et renvoie le bilan', async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(m.sync).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ added: 0, removed: 0 });
  });

  it('un saut de prix prévient le propriétaire', async () => {
    m.sync.mockImplementationOnce(async (deps) => {
      await deps?.onPriceJump?.({
        serviceId: 5,
        oldPriceXaf1000: 1000,
        newPriceXaf1000: 1500,
        changePct: 50,
      });
      return { added: 0, removed: 0, repriced: 1, alerts: 1 };
    });
    await call(`Bearer ${SECRET}`);
    expect(notifyOwner).toHaveBeenCalledWith(
      'price_jump',
      expect.objectContaining({ service_id: 5 }),
    );
  });
});
