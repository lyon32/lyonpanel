import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { ensureAdmin, fakeSession, load } from '../helpers/admin-db';
import { getReq, sendReq, type ErrorBody } from '../helpers/client-area-db';

vi.mock('server-only', () => ({}));
const notify = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: notify.fn }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Accès admin (phase 11, décisions 1) : garde `requireAdmin` et routes /api/v1/admin/*.
 * Modules attendus :
 *   src/server/auth/require-admin.ts            requireAdmin(): Promise<{ id: string }>
 *   src/app/api/v1/admin/stats/route.ts         GET
 *   src/app/api/v1/admin/users/route.ts         GET
 *   src/app/api/v1/admin/mfa/verify/route.ts    POST { code } (6 chiffres)
 * Règles (API_SPEC §3 et §8, SECURITY_NOTES §2) :
 *   - visiteur, client ou admin sans facteur TOTP : 404 NOT_FOUND (jamais 403) ;
 *   - admin connecté avec un facteur TOTP mais en aal1 : 401 MFA_REQUIRED ;
 *   - admin en aal2 : accès.
 */

let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const created: string[] = [];
beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  await admin.release();
});
beforeEach(() => {
  session.client = null;
  notify.fn.mockClear();
});
afterEach(async () => {
  await cleanupUsers(created);
});

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;
const code = async (res: Response) => ((await res.json()) as ErrorBody).error.code;
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

const GUARDED: { name: string; call: () => Promise<Response> }[] = [
  {
    name: 'GET /admin/stats',
    call: async () =>
      (await load<{ GET: Handler }>('@/app/api/v1/admin/stats/route')).GET(
        getReq('/api/v1/admin/stats?range=today'),
      ),
  },
  {
    name: 'GET /admin/users',
    call: async () =>
      (await load<{ GET: Handler }>('@/app/api/v1/admin/users/route')).GET(
        getReq('/api/v1/admin/users'),
      ),
  },
  {
    name: 'GET /admin/users/{id}',
    call: async () =>
      (await load<{ GET: Handler }>('@/app/api/v1/admin/users/[id]/route')).GET(
        getReq(`/api/v1/admin/users/${randomUUID()}`),
        idCtx(randomUUID()),
      ),
  },
  {
    name: 'POST /admin/users/{id}/notes',
    call: async () =>
      (await load<{ POST: Handler }>('@/app/api/v1/admin/users/[id]/notes/route')).POST(
        sendReq('POST', '/api/v1/admin/users/x/notes', { body: 'x' }),
        idCtx(randomUUID()),
      ),
  },
];

describe('requireAdmin', () => {
  type Mod = { requireAdmin: () => Promise<{ id: string }> };
  const run = async () => (await load<Mod>('@/server/auth/require-admin')).requireAdmin();

  it('admin en aal2 : renvoie son identifiant', async () => {
    session.client = fakeSession(admin.id, { current: 'aal2' });
    expect(await run()).toEqual({ id: admin.id });
  });

  it('visiteur : NOT_FOUND (404)', async () => {
    session.client = fakeSession(null);
    await expect(run()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('client ordinaire, même en aal2 : NOT_FOUND (404), jamais FORBIDDEN', async () => {
    const u = await makeFundedUser(created);
    session.client = fakeSession(u.id, { current: 'aal2' });
    await expect(run()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('admin en aal1 avec un facteur TOTP à confirmer : MFA_REQUIRED (401)', async () => {
    session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal2' });
    await expect(run()).rejects.toMatchObject({ code: 'MFA_REQUIRED', status: 401 });
  });

  it('admin en aal1 sans aucun facteur TOTP : NOT_FOUND (404)', async () => {
    session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal1', factors: [] });
    await expect(run()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('client bloqué ou supprimé n’obtient jamais l’admin (404)', async () => {
    const u = await makeFundedUser(created, { profile: { status: 'blocked' } });
    session.client = fakeSession(u.id, { current: 'aal2' });
    await expect(run()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe.each(GUARDED)('$name : accès', ({ call }) => {
  it('visiteur : 404 NOT_FOUND', async () => {
    session.client = fakeSession(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('NOT_FOUND');
  });

  it('client connecté : 404 NOT_FOUND, même corps qu’un visiteur', async () => {
    const u = await makeFundedUser(created);
    session.client = fakeSession(u.id, { current: 'aal2' });
    const res = await call();
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('NOT_FOUND');
  });

  it('admin sans code à 6 chiffres confirmé (aal1) : 401 MFA_REQUIRED', async () => {
    session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal2' });
    const res = await call();
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('MFA_REQUIRED');
  });

  it('admin en aal1 sans facteur : 404', async () => {
    session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal1', factors: [] });
    expect((await call()).status).toBe(404);
  });

  it('admin en aal2 : passe la garde (jamais 401 ni 403 ; 404 seulement pour une ressource absente)', async () => {
    session.client = fakeSession(admin.id, { current: 'aal2' });
    const res = await call();
    expect([200, 201, 404]).toContain(res.status);
    if (res.status === 404) expect(await code(res)).toBe('USER_NOT_FOUND');
  });
});

describe('POST /admin/mfa/verify : code à 6 chiffres, 2 appareils', () => {
  const FACTORS = [
    { id: 'f1', factor_type: 'totp', status: 'verified' },
    { id: 'f2', factor_type: 'totp', status: 'verified' },
  ] as const;
  const post = async (body: unknown) =>
    (await load<{ POST: Handler }>('@/app/api/v1/admin/mfa/verify/route')).POST(
      sendReq('POST', '/api/v1/admin/mfa/verify', body),
    );
  const adminAal1 = (validCodes: Record<string, string> = { f1: '123456', f2: '654321' }) =>
    fakeSession(admin.id, { current: 'aal1', next: 'aal2', factors: [...FACTORS], validCodes });

  it('code valide du 1er appareil : 200', async () => {
    session.client = adminAal1();
    expect((await post({ code: '123456' })).status).toBe(200);
  });

  it('code valide du 2e appareil (téléphone perdu, gestionnaire de mots de passe) : 200', async () => {
    const s = adminAal1();
    session.client = s;
    expect((await post({ code: '654321' })).status).toBe(200);
    expect(s.auth.mfa.verify).toHaveBeenCalledWith(
      expect.objectContaining({ factorId: 'f2', code: '654321' }),
    );
  });

  it('mauvais code : 401 MFA_REQUIRED, aucun accès accordé', async () => {
    session.client = adminAal1();
    const res = await post({ code: '000000' });
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('MFA_REQUIRED');
  });

  it.each([['12345'], ['1234567'], ['12a456'], [' 12345'], [''], [123456], [null], [undefined]])(
    'code mal formé %j : 400 VALIDATION_ERROR, aucun appel à Supabase',
    async (bad) => {
      const s = adminAal1();
      session.client = s;
      const res = await post({ code: bad });
      expect(res.status).toBe(400);
      expect(await code(res)).toBe('VALIDATION_ERROR');
      expect(s.auth.mfa.verify).not.toHaveBeenCalled();
    },
  );

  it('visiteur : 404', async () => {
    session.client = fakeSession(null);
    expect((await post({ code: '123456' })).status).toBe(404);
  });

  it('client ordinaire : 404, le code n’est jamais vérifié', async () => {
    const u = await makeFundedUser(created);
    const s = fakeSession(u.id, { current: 'aal1', next: 'aal2' });
    session.client = s;
    expect((await post({ code: '123456' })).status).toBe(404);
    expect(s.auth.mfa.verify).not.toHaveBeenCalled();
  });

  it('5 mauvais codes de suite : une alerte Telegram sans le code ni l’adresse email', async () => {
    session.client = adminAal1();
    for (let i = 0; i < 5; i++) await post({ code: '000000' });
    const calls = notify.fn.mock.calls as unknown as [string, Record<string, unknown>][];
    expect(calls.some(([event]) => event === 'admin_login_failed')).toBe(true);
    expect(JSON.stringify(calls)).not.toContain('000000');
  });
});
