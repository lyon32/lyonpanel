import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import { cleanupUsers, makeFollowersService, makeFundedUser } from '../helpers/orders-db';
import { getReq } from '../helpers/client-area-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

const created: string[] = [];
beforeEach(() => {
  session.client = null;
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});
async function login() {
  const u = await makeFundedUser(created, { balance: 5000 });
  session.client = await userClient(u.id);
  return u;
}
import { GET as suggestion } from '@/app/api/v1/orders/suggestion/route';

const call = async () => (await suggestion(getReq('/api/v1/orders/suggestion'))).json();

describe('suggestion : services vendables seulement', () => {
  it.each([{ active: false }, { available: false }])(
    'saute le service %j et propose le suivant',
    async (off) => {
      const u = await login();
      const a = await makeFollowersService();
      const b = await makeFollowersService();
      await makeOrder(u.id, a.id, { quantity: 100 });
      await makeOrder(u.id, a.id, { quantity: 100 });
      await makeOrder(u.id, b.id, { quantity: 300 });
      await adminClient().from('services').update(off).eq('id', a.id);
      expect((await call()).suggestion).toMatchObject({ service: { id: b.id }, quantity: 300 });
    },
  );

  it('aucun service vendable : suggestion null', async () => {
    const u = await login();
    const a = await makeFollowersService();
    await makeOrder(u.id, a.id, { quantity: 100 });
    await adminClient().from('services').update({ active: false }).eq('id', a.id);
    expect(await call()).toEqual({ suggestion: null });
  });
});
