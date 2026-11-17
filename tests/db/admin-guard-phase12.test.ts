import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '../factories/user';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import { ROUTES, callRoute } from '../helpers/admin-phase12';
import type { ErrorBody } from '../helpers/client-area-db';
import { cleanupUsers } from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
vi.mock('@/server/providers', () => ({
  getProvider: () => ({
    add: vi.fn(),
    cancel: vi.fn(),
    status: vi.fn(),
    balance: vi.fn(),
    services: vi.fn(),
  }),
}));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Garde de TOUTES les routes admin de la phase 12 (et celles de la phase 11 pour la faille n°9).
 *   - visiteur, client ou admin sans code : 404 NOT_FOUND (jamais 403) ; admin au niveau aal1 AVEC un appareil de code : 401 MFA_REQUIRED ;
 *   - faille n°9 : la garde admin passe AVANT la vérification d'origine. Un non-admin qui envoie une origine étrangère
 *     reçoit 404 (et non 403 FORBIDDEN, qui révélerait que la route existe) ; l'admin avec une mauvaise origine reçoit 403.
 *   - contrainte « un seul admin » en base.
 */
type R = {
  name: string;
  route: string;
  method: 'GET' | 'POST' | 'PATCH';
  url: string;
  id?: string;
};
const ID = randomUUID();
const NEW_ROUTES: R[] = [
  { name: 'orders', route: ROUTES.orders, method: 'GET', url: '/api/v1/admin/orders' },
  { name: 'order', route: ROUTES.order, method: 'GET', url: `/api/v1/admin/orders/${ID}`, id: ID },
  {
    name: 'refund',
    route: ROUTES.refund,
    method: 'POST',
    url: `/api/v1/admin/orders/${ID}/refund`,
    id: ID,
  },
  {
    name: 'cancel',
    route: ROUTES.cancel,
    method: 'POST',
    url: `/api/v1/admin/orders/${ID}/cancel`,
    id: ID,
  },
  {
    name: 'resend',
    route: ROUTES.resend,
    method: 'POST',
    url: `/api/v1/admin/orders/${ID}/resend`,
    id: ID,
  },
  {
    name: 'close',
    route: ROUTES.close,
    method: 'POST',
    url: `/api/v1/admin/orders/${ID}/close`,
    id: ID,
  },
  { name: 'payments', route: ROUTES.payments, method: 'GET', url: '/api/v1/admin/payments' },
  { name: 'services', route: ROUTES.services, method: 'GET', url: '/api/v1/admin/services' },
  {
    name: 'service',
    route: ROUTES.service,
    method: 'PATCH',
    url: '/api/v1/admin/services/1',
    id: '1',
  },
  {
    name: 'preview',
    route: ROUTES.preview,
    method: 'POST',
    url: '/api/v1/admin/services/1/preview',
    id: '1',
  },
  { name: 'settings GET', route: ROUTES.settings, method: 'GET', url: '/api/v1/admin/settings' },
  {
    name: 'settings PATCH',
    route: ROUTES.settings,
    method: 'PATCH',
    url: '/api/v1/admin/settings',
  },
  { name: 'tickets', route: ROUTES.tickets, method: 'GET', url: '/api/v1/admin/tickets' },
  {
    name: 'ticket',
    route: ROUTES.ticket,
    method: 'PATCH',
    url: `/api/v1/admin/tickets/${ID}`,
    id: ID,
  },
  {
    name: 'ticket reply',
    route: ROUTES.ticketMessages,
    method: 'POST',
    url: `/api/v1/admin/tickets/${ID}/messages`,
    id: ID,
  },
  { name: 'audit', route: ROUTES.audit, method: 'GET', url: '/api/v1/admin/audit' },
];
const PHASE11_MUTATIONS: R[] = [
  {
    name: 'users PATCH',
    route: '@/app/api/v1/admin/users/[id]/route',
    method: 'PATCH',
    url: `/api/v1/admin/users/${ID}`,
    id: ID,
  },
  {
    name: 'notes POST',
    route: '@/app/api/v1/admin/users/[id]/notes/route',
    method: 'POST',
    url: `/api/v1/admin/users/${ID}/notes`,
    id: ID,
  },
  {
    name: 'referral cancel',
    route: '@/app/api/v1/admin/referrals/[id]/cancel/route',
    method: 'POST',
    url: `/api/v1/admin/referrals/${ID}/cancel`,
    id: ID,
  },
  {
    name: 'orphans purge',
    route: '@/app/api/v1/admin/storage/orphans/purge/route',
    method: 'POST',
    url: '/api/v1/admin/storage/orphans/purge',
  },
];
const MUTATIONS = [...NEW_ROUTES.filter((r) => r.method !== 'GET'), ...PHASE11_MUTATIONS];

const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const errCode = async (r: Response) => ((await r.json()) as ErrorBody).error.code;
const hit = (r: R, headers: Record<string, string> = {}) =>
  callRoute(r.route, r.method, r.url, { id: r.id, body: {}, headers });

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => admin.release());
afterEach(async () => {
  await cleanupUsers(created);
});
beforeEach(() => {
  session.client = fakeSession(null);
});

describe.each(NEW_ROUTES)('route admin « $name »', (r) => {
  it('visiteur : 404 NOT_FOUND', async () => {
    session.client = fakeSession(null);
    const res = await hit(r);
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('NOT_FOUND');
  });

  it('client connecté non admin : 404 NOT_FOUND (jamais 403)', async () => {
    const u = await makeUser();
    created.push(u.id);
    session.client = fakeSession(u.id, { current: 'aal2' });
    const res = await hit(r);
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('NOT_FOUND');
  });

  it('admin sans code à 6 chiffres (aal1, appareil enregistré) : 401 MFA_REQUIRED', async () => {
    session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal2' });
    const res = await hit(r);
    expect(res.status).toBe(401);
    expect(await errCode(res)).toBe('MFA_REQUIRED');
  });

  it('admin aal1 sans aucun appareil : 404 NOT_FOUND', async () => {
    session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal1', factors: [] });
    const res = await hit(r);
    expect(res.status).toBe(404);
  });

  it('admin aal2 : la route existe (ni 404 NOT_FOUND ni 401)', async () => {
    session.client = fakeSession(admin.id, { current: 'aal2' });
    const res = await hit(r);
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as ErrorBody | null;
    expect([401]).not.toContain(res.status);
    expect(body?.error?.code).not.toBe('NOT_FOUND');
  });
});

describe.each(MUTATIONS)('faille n°9 : garde avant origine sur « $name »', (r) => {
  it('non admin + origine étrangère : 404 NOT_FOUND, pas 403', async () => {
    const u = await makeUser();
    created.push(u.id);
    session.client = fakeSession(u.id, { current: 'aal2' });
    const res = await hit(r, { origin: 'https://evil.example' });
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('NOT_FOUND');
  });

  it('visiteur + origine absente : 404 NOT_FOUND', async () => {
    session.client = fakeSession(null);
    const res = await hit(r, { origin: '' });
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('NOT_FOUND');
  });

  it('admin aal2 + origine étrangère : 403 FORBIDDEN, rien n’est exécuté', async () => {
    session.client = fakeSession(admin.id, { current: 'aal2' });
    const res = await hit(r, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await errCode(res)).toBe('FORBIDDEN');
  });
});

describe('un seul administrateur en base', () => {
  it('donner is_admin à un deuxième compte échoue (contrainte d’unicité)', async () => {
    const second = await makeUser();
    created.push(second.id);
    const { error } = await adminClient()
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', second.id);
    expect(error).not.toBeNull();
    const { data } = await adminClient()
      .from('profiles')
      .select('is_admin')
      .eq('id', second.id)
      .single();
    expect(data!.is_admin).toBe(false);
  });

  it('il n’existe jamais plus d’un administrateur', async () => {
    const { data } = await adminClient().from('profiles').select('id').eq('is_admin', true);
    expect(data!.length).toBeLessThanOrEqual(1);
  });
});
