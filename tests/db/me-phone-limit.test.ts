import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { sendReq, type ErrorBody } from '../helpers/client-area-db';
import { userClient } from './helpers/client';

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
import { PATCH } from '@/app/api/v1/me/route';

const patch = (body: unknown) => PATCH(sendReq('PATCH', '/api/v1/me', body));
const phoneN = (i: number) => `+22571${String(Date.now()).slice(-6)}${String(i).padStart(2, '0')}`;

describe('PATCH /api/v1/me : plafond et erreurs de champ', () => {
  it('6e changement de téléphone en une heure : 429 RATE_LIMITED', async () => {
    await login();
    for (let i = 0; i < 5; i++) expect((await patch({ phone: phoneN(i) })).status).toBe(200);
    const res = await patch({ phone: phoneN(9) });
    expect(res.status).toBe(429);
    expect(((await res.json()) as ErrorBody).error.code).toBe('RATE_LIMITED');
  });

  it('les PATCH sans téléphone ne comptent pas', async () => {
    await login();
    for (let i = 0; i < 7; i++) expect((await patch({ language: 'en' })).status).toBe(200);
    expect((await patch({ phone: phoneN(1) })).status).toBe(200);
  });

  it('téléphone invalide : 400 avec details.fields.phone', async () => {
    await login();
    const res = await patch({ phone: '123' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { details: { fields: Record<string, string> } } };
    expect(body.error.details.fields.phone).toBe('INVALID_PHONE');
  });

  it('téléphone déjà pris : 409 avec details.fields.phone', async () => {
    await login();
    const other = await makeFundedUser(created, { balance: 0 });
    const res = await patch({ phone: other.phone });
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: { code: string; details: { fields: Record<string, string> } };
    };
    expect(body.error.code).toBe('PHONE_TAKEN');
    expect(body.error.details.fields.phone).toBe('PHONE_TAKEN');
  });
});
