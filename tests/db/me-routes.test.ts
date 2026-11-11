import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import {
  balanceOf,
  cleanupUsers,
  makeFollowersService,
  makeFundedUser,
  ordersOf,
} from '../helpers/orders-db';
import { getReq, profileOf, sendReq, type ErrorBody } from '../helpers/client-area-db';
import { TEST_PASSWORD, adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { DELETE, GET, PATCH } from '@/app/api/v1/me/route';

/*
 * Routes attendues (API_SPEC §6.2), fichier src/app/api/v1/me/route.ts :
 *   GET    /api/v1/me  -> 200 {id, email, phone, country, display_currency, language, referral_code, discount_pct, created_at}
 *   PATCH  /api/v1/me  {display_currency?: XAF|XOF|USD, language?: fr|en, phone?: E.164}
 *            -> 200 {user} (mêmes clés que GET) ; devise/langue/téléphone invalides : 400 VALIDATION_ERROR ;
 *               téléphone déjà pris : 409 PHONE_TAKEN ; corps vide : 400 ; autres champs (solde, remise...) : jamais modifiés.
 *   DELETE /api/v1/me  {password} -> 204, appelle anonymize_user ; mauvais mot de passe : 401 INVALID_CREDENTIALS ;
 *            mot de passe absent : 400 VALIDATION_ERROR. Le solde n'est JAMAIS modifié, les commandes restent.
 *   Écritures : Origin = site (sinon 403 FORBIDDEN) ; non connecté : 401 UNAUTHENTICATED.
 *   Le mot de passe de test est TEST_PASSWORD (tests/db/helpers/client.ts).
 */

const created: string[] = [];
beforeEach(() => {
  session.client = null;
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});

async function login(opts: Parameters<typeof makeFundedUser>[1] = { balance: 7000 }) {
  const u = await makeFundedUser(created, opts);
  session.client = await userClient(u.id);
  return u;
}
const patch = (body: unknown) => PATCH(sendReq('PATCH', '/api/v1/me', body));
const del = (body: unknown) => DELETE(sendReq('DELETE', '/api/v1/me', body));
const code = async (res: Response) => ((await res.json()) as ErrorBody).error.code;

describe('GET /api/v1/me', () => {
  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const res = await GET(getReq('/api/v1/me'));
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('UNAUTHENTICATED');
  });

  it('renvoie le profil du client, avec exactement les clés prévues', async () => {
    const u = await login();
    const res = await GET(getReq('/api/v1/me'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(
      [
        'country',
        'created_at',
        'discount_pct',
        'display_currency',
        'email',
        'id',
        'language',
        'phone',
        'referral_code',
        'suggestions_enabled',
      ].sort(),
    );
    expect(json).toMatchObject({ id: u.id, email: u.email, phone: u.phone });
  });
});

describe('PATCH /api/v1/me', () => {
  it.each(['XAF', 'XOF', 'USD'])('accepte la devise %s', async (currency) => {
    const u = await login();
    const res = await patch({ display_currency: currency });
    expect(res.status).toBe(200);
    expect((await profileOf(u.id)).display_currency).toBe(currency);
  });

  it.each(['EUR', 'xaf', '', 12])(
    'refuse la devise %j (400 VALIDATION_ERROR)',
    async (currency) => {
      const u = await login();
      const before = (await profileOf(u.id)).display_currency;
      const res = await patch({ display_currency: currency });
      expect(res.status).toBe(400);
      expect(await code(res)).toBe('VALIDATION_ERROR');
      expect((await profileOf(u.id)).display_currency).toBe(before);
    },
  );

  it.each(['fr', 'en'])('accepte la langue %s', async (language) => {
    const u = await login();
    const res = await patch({ language });
    expect(res.status).toBe(200);
    expect((await res.json()).user.language).toBe(language);
    expect((await profileOf(u.id)).language).toBe(language);
  });

  it('refuse une langue inconnue (400 VALIDATION_ERROR)', async () => {
    await login();
    const res = await patch({ language: 'de' });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
  });

  it('change le téléphone vers un numéro E.164 valide', async () => {
    const u = await login();
    const phone = `+22570${String(Date.now()).slice(-8)}`;
    const res = await patch({ phone });
    expect(res.status).toBe(200);
    expect((await profileOf(u.id)).phone).toBe(phone);
  });

  it.each(['abc', '0612345678', '+0123456', '+12', '+1234567890123456', ''])(
    'refuse le téléphone invalide %j (400 VALIDATION_ERROR)',
    async (phone) => {
      const u = await login();
      const res = await patch({ phone });
      expect(res.status).toBe(400);
      expect(await code(res)).toBe('VALIDATION_ERROR');
      expect((await profileOf(u.id)).phone).toBe(u.phone);
    },
  );

  it('refuse un téléphone déjà pris par un autre client (409 PHONE_TAKEN) sans rien changer', async () => {
    const other = await makeFundedUser(created, { balance: 0 });
    const u = await login();
    const res = await patch({ phone: other.phone });
    expect(res.status).toBe(409);
    expect(await code(res)).toBe('PHONE_TAKEN');
    expect((await profileOf(u.id)).phone).toBe(u.phone);
    expect((await profileOf(other.id)).phone).toBe(other.phone);
  });

  it('refuse un corps vide (400 VALIDATION_ERROR)', async () => {
    await login();
    const res = await patch({});
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
  });

  it('ne modifie ni solde, ni remise, ni email, ni statut même si on les envoie', async () => {
    const u = await login({ balance: 7000 });
    const before = await profileOf(u.id);
    const res = await patch({
      language: 'en',
      balance_xaf: 999999,
      custom_discount_pct: 50,
      email: 'pirate@lyonpanel.test',
      status: 'active',
      role: 'admin',
    });
    expect([200, 400]).toContain(res.status);
    const after = await profileOf(u.id);
    expect(await balanceOf(u.id)).toBe(7000);
    expect(after.custom_discount_pct).toEqual(before.custom_discount_pct);
    expect(after.email).toBe(before.email);
    expect(after.role).toEqual(before.role);
  });

  it('refuse une requête venue d un autre site (403 FORBIDDEN)', async () => {
    await login();
    const res = await PATCH(
      sendReq('PATCH', '/api/v1/me', { language: 'en' }, { origin: 'https://evil.example' }),
    );
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('FORBIDDEN');
  });

  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const res = await patch({ language: 'en' });
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('UNAUTHENTICATED');
  });
});

describe('PATCH /api/v1/me : suggestions_enabled', () => {
  it.each([false, true])('accepte suggestions_enabled=%s et le garde en base', async (value) => {
    const u = await login();
    await adminClient().from('profiles').update({ suggestions_enabled: !value }).eq('id', u.id);
    const res = await patch({ suggestions_enabled: value });
    expect(res.status).toBe(200);
    expect((await res.json()).user.suggestions_enabled).toBe(value);
    expect((await profileOf(u.id)).suggestions_enabled).toBe(value);
    const me = await (await GET(getReq('/api/v1/me'))).json();
    expect(me.suggestions_enabled).toBe(value);
  });

  it.each(['false', 0, 1, null, 'oui'])(
    'refuse suggestions_enabled=%j non booléen (400 VALIDATION_ERROR)',
    async (value) => {
      const u = await login();
      const res = await patch({ suggestions_enabled: value });
      expect(res.status).toBe(400);
      expect(await code(res)).toBe('VALIDATION_ERROR');
      expect((await profileOf(u.id)).suggestions_enabled).toBe(true);
    },
  );
});

describe('DELETE /api/v1/me', () => {
  it('refuse un mauvais mot de passe (401 INVALID_CREDENTIALS) : compte intact', async () => {
    const u = await login();
    const res = await del({ password: 'Mauvais-mot-de-passe-1' });
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('INVALID_CREDENTIALS');
    const p = await profileOf(u.id);
    expect(p.status).toBe('active');
    expect(p.email).toBe(u.email);
  });

  it('refuse un mot de passe absent (400 VALIDATION_ERROR)', async () => {
    const u = await login();
    const res = await del({});
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
    expect((await profileOf(u.id)).status).toBe('active');
  });

  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const res = await del({ password: TEST_PASSWORD });
    expect(res.status).toBe(401);
    expect(await code(res)).toBe('UNAUTHENTICATED');
  });

  it('refuse une requête venue d un autre site (403 FORBIDDEN) : compte intact', async () => {
    const u = await login();
    const res = await DELETE(
      sendReq(
        'DELETE',
        '/api/v1/me',
        { password: TEST_PASSWORD },
        { origin: 'https://evil.example' },
      ),
    );
    expect(res.status).toBe(403);
    expect((await profileOf(u.id)).status).toBe('active');
  });

  it('bon mot de passe : 204, compte anonymisé, solde et commandes conservés', async () => {
    const u = await login({ balance: 7000 });
    const s = await makeFollowersService();
    await makeOrder(u.id, s.id);
    await adminClient().from('favorites').insert({ user_id: u.id, service_id: s.id });

    const res = await del({ password: TEST_PASSWORD });
    expect(res.status).toBe(204);

    const p = await profileOf(u.id);
    expect(p.status).toBe('deleted');
    expect(p.email).toBeNull();
    expect(p.phone).toBeNull();
    expect(await balanceOf(u.id)).toBe(7000);
    expect(await ordersOf(u.id)).toHaveLength(1);
    const { data: favs } = await adminClient().from('favorites').select('*').eq('user_id', u.id);
    expect(favs).toHaveLength(0);
  });

  it("ne touche pas au compte d'un autre client", async () => {
    const other = await makeFundedUser(created, { balance: 1234 });
    const u = await login();
    const res = await del({ password: TEST_PASSWORD });
    expect(res.status).toBe(204);
    expect((await profileOf(other.id)).status).toBe('active');
    expect(await balanceOf(other.id)).toBe(1234);
    expect(u.id).not.toBe(other.id);
  });
});
