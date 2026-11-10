import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  sync: vi.fn(async () => ({ checked: 0 })),
  recover: vi.fn(async () => ({ recovered: 0 })),
}));
vi.mock('@/server/orders/sync-order-statuses', () => ({ syncOrderStatuses: m.sync }));
vi.mock('@/server/orders/recover-stuck-orders', () => ({ recoverStuckOrders: m.recover }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { GET } from '@/app/api/cron/orders/route';

const SECRET = 'cron_test_only_not_a_real_secret';
const call = (authorization?: string) =>
  GET(
    new NextRequest('http://localhost/api/cron/orders', {
      headers: authorization ? { authorization } : {},
    }),
    { params: Promise.resolve({}) } as never,
  );

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET);
  m.sync.mockClear();
  m.recover.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /api/cron/orders', () => {
  it('401 sans en-tête Authorization, et rien n est lancé', async () => {
    expect((await call()).status).toBe(401);
    expect(m.sync).not.toHaveBeenCalled();
    expect(m.recover).not.toHaveBeenCalled();
  });

  it('401 avec un mauvais secret', async () => {
    expect((await call('Bearer pas-le-bon')).status).toBe(401);
    expect(m.sync).not.toHaveBeenCalled();
  });

  it('401 quand CRON_SECRET n est pas configuré, même avec « Bearer undefined »', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await call('Bearer undefined')).status).toBe(401);
    expect(m.sync).not.toHaveBeenCalled();
  });

  it('200 avec le bon secret : lance la synchronisation ET le rattrapage', async () => {
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(m.sync).toHaveBeenCalledTimes(1);
    expect(m.recover).toHaveBeenCalledTimes(1);
  });
});
