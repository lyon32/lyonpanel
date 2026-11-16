import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '../factories/user';
import { makePayment } from '../factories/payment';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { getReq, type ErrorBody } from '../helpers/client-area-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { GET as referralRoute } from '@/app/api/v1/referral/route';
import { getReferral } from '@/server/referral/referral';

/*
 * Fichiers attendus :
 *   src/server/referral/referral.ts
 *     getReferral(userId): Promise<{ code: string; link: string; referred_count: number;
 *                                    total_earned_xaf: number; pct: number }>
 *       code = profiles.referral_code ; link = buildReferralLink(NEXT_PUBLIC_SITE_URL, code) ;
 *       referred_count = nb de profils avec referred_by = userId (inscrits, même sans recharge) ;
 *       total_earned_xaf = somme des referral_rewards.amount_xaf du parrain ;
 *       pct = réglage referral_pct (5 par défaut).
 *   src/app/api/v1/referral/route.ts   GET -> 200 { code, link, referred_count, total_earned_xaf, pct }
 *       exactement ces 5 clés (aucun id, email, téléphone ni montant d un filleul), 401 UNAUTHENTICATED sinon.
 */
const db = adminClient();
const created: string[] = [];
beforeEach(() => {
  session.client = null;
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});

async function codeOf(id: string): Promise<string> {
  const { data } = await db.from('profiles').select('referral_code').eq('id', id).single();
  return data!.referral_code as string;
}
async function sponsor() {
  const u = await makeFundedUser(created, { balance: 0 });
  return { u, code: await codeOf(u.id) };
}
async function addReferee(code: string) {
  const f = await makeUser({ referral: code });
  created.push(f.id);
  return f;
}
async function reward(referrerId: string, refereeId: string, amount: number) {
  const p = await makePayment(refereeId);
  const { error } = await db.from('referral_rewards').insert({
    referrer_id: referrerId,
    referee_id: refereeId,
    payment_id: p.id,
    amount_xaf: amount,
  });
  expect(error).toBeNull();
}

describe('getReferral', () => {
  it('nouveau client : son code (8 caractères), un lien avec ce code, 0 filleul, 0 XAF, 5 %', async () => {
    const { u, code } = await sponsor();
    const r = await getReferral(u.id);
    expect(code).toHaveLength(8);
    expect(r).toMatchObject({ code, referred_count: 0, total_earned_xaf: 0, pct: 5 });
    expect(new URL(r.link).searchParams.get('ref')).toBe(code);
  });

  it('compte les filleuls inscrits même sans recharge, et additionne les bonus reçus', async () => {
    const { u, code } = await sponsor();
    const f1 = await addReferee(code);
    const f2 = await addReferee(code);
    await addReferee(code); // inscrit, n a jamais rechargé
    await reward(u.id, f1.id, 500);
    await reward(u.id, f2.id, 150);
    expect(await getReferral(u.id)).toMatchObject({ referred_count: 3, total_earned_xaf: 650 });
  });

  it('ne compte pas les filleuls d un autre parrain', async () => {
    const a = await sponsor();
    const b = await sponsor();
    const fb = await addReferee(b.code);
    await reward(b.u.id, fb.id, 500);
    expect(await getReferral(a.u.id)).toMatchObject({ referred_count: 0, total_earned_xaf: 0 });
  });

  it('suit le réglage referral_pct', async () => {
    const { data: old } = await db
      .from('settings')
      .select('value')
      .eq('key', 'referral_pct')
      .maybeSingle();
    await db.from('settings').upsert({ key: 'referral_pct', value: 3 });
    try {
      const { u } = await sponsor();
      expect((await getReferral(u.id)).pct).toBe(3);
    } finally {
      await db.from('settings').upsert({ key: 'referral_pct', value: old?.value ?? 5 });
    }
  });
});

describe('GET /api/v1/referral', () => {
  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const res = await referralRoute(getReq('/api/v1/referral'));
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('renvoie exactement code, link, referred_count, total_earned_xaf, pct (entiers XAF)', async () => {
    const { u, code } = await sponsor();
    const f = await addReferee(code);
    await reward(u.id, f.id, 500);
    session.client = await userClient(u.id);
    const res = await referralRoute(getReq('/api/v1/referral'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual([
      'code',
      'link',
      'pct',
      'referred_count',
      'total_earned_xaf',
    ]);
    expect(json).toMatchObject({ code, referred_count: 1, total_earned_xaf: 500, pct: 5 });
  });

  it('ne laisse fuiter aucune donnée de filleul (id, email, téléphone)', async () => {
    const { u, code } = await sponsor();
    const f = await addReferee(code);
    await reward(u.id, f.id, 500);
    session.client = await userClient(u.id);
    const text = await (await referralRoute(getReq('/api/v1/referral'))).text();
    expect(text).not.toContain(f.id);
    expect(text).not.toContain(f.email);
    expect(text).not.toContain(f.phone);
  });
});
