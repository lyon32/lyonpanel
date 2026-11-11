import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupUsers, makeFollowersService, makeFundedUser } from '../helpers/orders-db';
import { favoriteIdsOf, getReq, sendReq, type ErrorBody } from '../helpers/client-area-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { GET as list } from '@/app/api/v1/favorites/route';
import { DELETE as remove, PUT as add } from '@/app/api/v1/favorites/[service_id]/route';

/*
 * Routes attendues (API_SPEC §6.7) :
 *   src/app/api/v1/favorites/route.ts                   GET    -> 200 tableau de Service (forme du catalogue, camelCase,
 *        liste blanche : jamais coût, marge, fournisseur) ; seulement les favoris du client connecté
 *   src/app/api/v1/favorites/[service_id]/route.ts      PUT    -> 204 (ajout, idempotent : un doublon reste 204, une seule ligne)
 *                                                       DELETE -> 204 (retrait ; retirer un non-favori reste 204)
 *        service inconnu ou identifiant invalide : 404 NOT_FOUND ; non connecté : 401 UNAUTHENTICATED ;
 *        écritures : Origin = site (sinon 403 FORBIDDEN).
 *   Signature Next 15 : PUT(req, { params: Promise<{ service_id: string }> }).
 */

const created: string[] = [];
beforeEach(() => {
  session.client = null;
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});

async function login() {
  const u = await makeFundedUser(created, { balance: 0 });
  session.client = await userClient(u.id);
  return u;
}
const params = (id: string | number) => ({ params: Promise.resolve({ service_id: String(id) }) });
const put = (id: string | number, headers: Record<string, string> = {}) =>
  add(sendReq('PUT', `/api/v1/favorites/${id}`, undefined, headers), params(id));
const del = (id: string | number) =>
  remove(sendReq('DELETE', `/api/v1/favorites/${id}`), params(id));
const code = async (res: Response) => ((await res.json()) as ErrorBody).error.code;

describe('PUT /api/v1/favorites/{service_id}', () => {
  it('ajoute un service aux favoris (204)', async () => {
    const u = await login();
    const s = await makeFollowersService();
    const res = await put(s.id);
    expect(res.status).toBe(204);
    expect(await favoriteIdsOf(u.id)).toEqual([s.id]);
  });

  it('un doublon reste 204 et ne crée qu une seule ligne', async () => {
    const u = await login();
    const s = await makeFollowersService();
    expect((await put(s.id)).status).toBe(204);
    expect((await put(s.id)).status).toBe(204);
    expect(await favoriteIdsOf(u.id)).toEqual([s.id]);
  });

  it('service inconnu : 404 NOT_FOUND, rien n est ajouté', async () => {
    const u = await login();
    const res = await put(2_147_000_000);
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('NOT_FOUND');
    expect(await favoriteIdsOf(u.id)).toEqual([]);
  });

  it.each(['abc', '-1', '1.5', '0'])('identifiant invalide %j : 404 NOT_FOUND', async (id) => {
    await login();
    const res = await put(id);
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('NOT_FOUND');
  });

  it('refuse une requête venue d un autre site (403 FORBIDDEN)', async () => {
    const u = await login();
    const s = await makeFollowersService();
    const res = await put(s.id, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await favoriteIdsOf(u.id)).toEqual([]);
  });

  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const s = await makeFollowersService();
    const res = await put(s.id);
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('UNAUTHENTICATED');
  });
});

describe('DELETE /api/v1/favorites/{service_id}', () => {
  it('retire un favori (204)', async () => {
    const u = await login();
    const s = await makeFollowersService();
    await adminClient().from('favorites').insert({ user_id: u.id, service_id: s.id });
    const res = await del(s.id);
    expect(res.status).toBe(204);
    expect(await favoriteIdsOf(u.id)).toEqual([]);
  });

  it('retirer un service qui n est pas favori reste 204', async () => {
    await login();
    const s = await makeFollowersService();
    expect((await del(s.id)).status).toBe(204);
  });

  it("un client ne retire pas le favori d'un autre client", async () => {
    const other = await makeFundedUser(created, { balance: 0 });
    const s = await makeFollowersService();
    await adminClient().from('favorites').insert({ user_id: other.id, service_id: s.id });
    await login();
    await del(s.id);
    expect(await favoriteIdsOf(other.id)).toEqual([s.id]);
  });

  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const s = await makeFollowersService();
    const res = await del(s.id);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/favorites', () => {
  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const res = await list(getReq('/api/v1/favorites'));
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('UNAUTHENTICATED');
  });

  it('sans favori : 200 et tableau vide', async () => {
    await login();
    const res = await list(getReq('/api/v1/favorites'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("liste ses favoris et jamais ceux d'un autre client", async () => {
    const other = await makeFundedUser(created, { balance: 0 });
    const mine = await makeFollowersService();
    const theirs = await makeFollowersService();
    await adminClient()
      .from('favorites')
      .insert([{ user_id: other.id, service_id: theirs.id }]);
    const u = await login();
    await adminClient().from('favorites').insert({ user_id: u.id, service_id: mine.id });
    const res = await list(getReq('/api/v1/favorites'));
    const json = (await res.json()) as { id: number }[];
    expect(json.map((s) => s.id)).toEqual([mine.id]);
  });

  it('renvoie la forme Service du catalogue, sans coût, marge ni fournisseur', async () => {
    const u = await login();
    const s = await makeFollowersService();
    await adminClient().from('favorites').insert({ user_id: u.id, service_id: s.id });
    const json = (await (await list(getReq('/api/v1/favorites'))).json()) as Record<
      string,
      unknown
    >[];
    expect(Object.keys(json[0]!).sort()).toEqual(
      [
        'cancel',
        'displayMinOrder',
        'displayPrice1000',
        'dripfeed',
        'id',
        'maxQty',
        'minOrderXaf',
        'minQty',
        'name',
        'network',
        'priceXaf1000',
        'refill',
        'type',
      ].sort(),
    );
    const raw = JSON.stringify(json).toLowerCase();
    for (const word of ['cost', 'margin', 'marge', 'provider', 'fournisseur', 'multiplier']) {
      expect(raw).not.toContain(word);
    }
  });
});
