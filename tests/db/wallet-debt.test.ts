import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ensureAdmin } from '../helpers/admin-db';
import { getReq } from '../helpers/client-area-db';
import { makeDebtor } from '../helpers/debt-db';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { GET as wallet } from '@/app/api/v1/wallet/route';

/*
 * GET /api/v1/wallet (getWallet, src/server/wallet/wallet.ts) expose en plus : debt_xaf = max(0, -balance_xaf)
 * (entier XAF). balance_xaf peut être négatif. L'écran affiche wallet.debtNotice quand debt_xaf > 0.
 */

const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  await admin.release();
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});

const read = async () => {
  const res = await wallet(getReq('/api/v1/wallet'));
  return { status: res.status, json: await res.json() };
};

describe('GET /api/v1/wallet : dette', () => {
  it('client à -500 : balance_xaf -500 et debt_xaf 500', async () => {
    const u = await makeDebtor(created, 500, admin.id);
    session.client = await userClient(u.id);
    const { status, json } = await read();
    expect(status).toBe(200);
    expect(json).toMatchObject({ balance_xaf: -500, debt_xaf: 500 });
  });

  it('client à 1200 : debt_xaf 0', async () => {
    const u = await makeFundedUser(created, { balance: 1200 });
    session.client = await userClient(u.id);
    const { json } = await read();
    expect(json).toMatchObject({ balance_xaf: 1200, debt_xaf: 0 });
  });

  it('client à 0 : debt_xaf 0', async () => {
    const u = await makeFundedUser(created, { balance: 0 });
    session.client = await userClient(u.id);
    expect((await read()).json.debt_xaf).toBe(0);
  });
});
