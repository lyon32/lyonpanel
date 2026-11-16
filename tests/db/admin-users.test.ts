import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';
import { makeUser } from '../factories/user';
import { ensureAdmin, fakeSession, load } from '../helpers/admin-db';
import { getReq, sendReq, type ErrorBody } from '../helpers/client-area-db';
import { cleanupUsers, makeFundedUser, setSetting } from '../helpers/orders-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Clients vus par l'admin (phase 11, décision 3). Routes attendues (API_SPEC §8) :
 *   GET   /api/v1/admin/users?q=&country=&status=&limit=&cursor=  -> 200 { items, next_cursor }
 *   GET   /api/v1/admin/users/{id}                                -> 200 { profile, wallet, orders, notes, referrals, debt_xaf }
 *   PATCH /api/v1/admin/users/{id}  { status?, blocked_reason?, custom_discount_pct?, daily_spend_limit_xaf? } -> 200 { profile }
 *   POST  /api/v1/admin/users/{id}/notes  { body } -> 201 { id }
 * Hors périmètre (phase 12) : ajustement de solde, remboursement. Aucune de ces routes ne change un solde.
 * Chaque modification écrit une ligne dans audit_log (action « update_user » ou « add_note », target_id = id du client).
 */

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;
const db = adminClient();
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });
const errCode = async (r: Response) => ((await r.json()) as ErrorBody).error.code;

const listRoute = async () => (await load<{ GET: Handler }>('@/app/api/v1/admin/users/route')).GET;
const oneRoute = () =>
  load<{ GET: Handler; PATCH: Handler }>('@/app/api/v1/admin/users/[id]/route');
const noteRoute = async () =>
  (await load<{ POST: Handler }>('@/app/api/v1/admin/users/[id]/notes/route')).POST;

const list = async (qs: string) => (await listRoute())(getReq(`/api/v1/admin/users${qs}`));
const detail = async (id: string) =>
  (await oneRoute()).GET(getReq(`/api/v1/admin/users/${id}`), idCtx(id));
const patch = async (id: string, body: unknown, headers: Record<string, string> = {}) =>
  (await oneRoute()).PATCH(sendReq('PATCH', `/api/v1/admin/users/${id}`, body, headers), idCtx(id));
const addNote = async (id: string, body: unknown) =>
  (await noteRoute())(sendReq('POST', `/api/v1/admin/users/${id}/notes`, body), idCtx(id));

const profileOf = async (id: string) =>
  (await db.from('profiles').select('*').eq('id', id).single()).data as Record<string, unknown>;
const auditOf = async (action: string, targetId: string) =>
  (await db.from('audit_log').select('*').eq('action', action).eq('target_id', targetId)).data ??
  [];

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  await admin.release();
});
beforeEach(() => {
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  await cleanupUsers(created);
});

/** Crée n clients dont l'email contient un mot unique : la recherche ne voit qu'eux. */
async function cohort(n: number, over: { country?: string } = {}) {
  const token = `lp11${randomUUID().slice(0, 8)}`;
  const users = [];
  for (let i = 0; i < n; i++) {
    const u = await makeUser({ email: `${token}-${i}@lyonpanel.test`, ...over });
    created.push(u.id);
    users.push(u);
  }
  return { token, users };
}

type Item = {
  id: string;
  email: string;
  phone: string;
  country: string;
  status: string;
  balance_xaf: number;
  created_at: string;
};
type List = { items: Item[]; next_cursor: string | null };

describe('GET /admin/users : recherche', () => {
  it('trouve un client par un morceau de son email', async () => {
    const { token, users } = await cohort(2);
    const body = (await (await list(`?q=${token}`)).json()) as List;
    expect(body.items.map((i) => i.id).sort()).toEqual(users.map((u) => u.id).sort());
  });

  it('trouve un client par son téléphone complet', async () => {
    const { users } = await cohort(1);
    const u = users[0]!;
    const body = (await (await list(`?q=${encodeURIComponent(u.phone)}`)).json()) as List;
    expect(body.items.map((i) => i.id)).toEqual([u.id]);
  });

  it('trouve un client par son code de parrainage', async () => {
    const { users } = await cohort(1);
    const u = users[0]!;
    const { data } = await db.from('profiles').select('referral_code').eq('id', u.id).single();
    const body = (await (await list(`?q=${data!.referral_code}`)).json()) as List;
    expect(body.items.map((i) => i.id)).toContain(u.id);
  });

  it('recherche sans résultat : liste vide, pas d’erreur', async () => {
    const res = await list(`?q=introuvable-${randomUUID()}`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as List).items).toEqual([]);
  });

  it.each(['%', '_', 'a,b', '),id.neq.0', "x'--", '\\', '*'])(
    'caractères spéciaux %j : traités comme du texte, jamais comme un filtre (aucun client renvoyé)',
    async (q) => {
      await cohort(1);
      const res = await list(`?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(((await res.json()) as List).items).toEqual([]);
    },
  );

  it('filtre par pays', async () => {
    const { token, users } = await cohort(1, { country: 'SN' });
    await cohort(1, { country: 'CM' });
    const body = (await (await list(`?country=SN&q=${token}`)).json()) as List;
    expect(body.items.map((i) => i.id)).toEqual([users[0]!.id]);
  });

  it('filtre par statut « blocked »', async () => {
    const { token, users } = await cohort(2);
    await db
      .from('profiles')
      .update({ status: 'blocked', blocked_reason: 'test' })
      .eq('id', users[0]!.id);
    const body = (await (await list(`?status=blocked&q=${token}`)).json()) as List;
    expect(body.items.map((i) => i.id)).toEqual([users[0]!.id]);
  });

  it.each([['status=nimporte'], ['country=cameroun'], ['limit=0'], ['limit=1000'], ['cursor=%%%']])(
    'paramètre invalide (%s) : 400 VALIDATION_ERROR',
    async (qs) => {
      const res = await list(`?${qs}`);
      expect(res.status).toBe(400);
      expect(await errCode(res)).toBe('VALIDATION_ERROR');
    },
  );

  it('chaque ligne contient le solde en entier XAF et aucun champ sensible', async () => {
    const u = await makeFundedUser(created, { balance: 1234 });
    const body = (await (await list(`?q=${encodeURIComponent(u.email)}`)).json()) as List;
    const item = body.items[0]!;
    expect(item.balance_xaf).toBe(1234);
    expect(Object.keys(item).sort()).toEqual([
      'balance_xaf',
      'country',
      'created_at',
      'email',
      'id',
      'phone',
      'status',
    ]);
  });

  it('pagine par curseur : chaque client est vu une seule fois', async () => {
    const { token, users } = await cohort(5);
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 5; i++) {
      const qs: string = `?q=${token}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = (await (await list(qs)).json()) as List;
      seen.push(...page.items.map((x) => x.id));
      cursor = page.next_cursor;
      if (!cursor) break;
    }
    expect([...seen].sort()).toEqual(users.map((u) => u.id).sort());
    expect(new Set(seen).size).toBe(5);
  });
});

describe('GET /admin/users/{id} : fiche client', () => {
  it('donne profil, solde, total rechargé, commandes avec bénéfice, notes et filleuls', async () => {
    await setSetting('usd_xaf_rate', 600);
    const u = await makeFundedUser(created, {
      balance: 4200,
      recharged: 9000,
      profile: { custom_discount_pct: 10 },
    });
    const service = await makeService();
    await makeOrder(u.id, service.id, { charged_xaf: 150, cost_usd: 0.15, status: 'completed' });
    await db.from('admin_notes').insert({ user_id: u.id, body: 'client sérieux' });
    const res = await detail(u.id);
    expect(res.status).toBe(200);
    const b = (await res.json()) as {
      profile: Record<string, unknown>;
      wallet: { balance_xaf: number; total_recharged_xaf: number };
      orders: { charged_xaf: number; cost_usd: number; profit_xaf: number; status: string }[];
      notes: { body: string }[];
      referrals: unknown[];
      debt_xaf: number;
    };
    expect(b.profile).toMatchObject({
      id: u.id,
      email: u.email,
      status: 'active',
      country: 'CM',
      custom_discount_pct: 10,
      daily_spend_limit_xaf: 500000,
    });
    expect(b.wallet).toEqual({ balance_xaf: 4200, total_recharged_xaf: 9000 });
    expect(b.orders).toHaveLength(1);
    expect(b.orders[0]).toMatchObject({ charged_xaf: 150, status: 'completed', profit_xaf: 60 });
    expect(b.notes.map((n) => n.body)).toEqual(['client sérieux']);
    expect(b.referrals).toEqual([]);
    expect(b.debt_xaf).toBe(0);
  });

  it('ne renvoie jamais is_admin ni de secret d’authentification', async () => {
    const u = await makeFundedUser(created);
    const text = JSON.stringify(await (await detail(u.id)).json());
    expect(text).not.toContain('is_admin');
    expect(text).not.toMatch(/password|encrypted|token/i);
  });

  it('les commandes sont les plus récentes d’abord, 20 au plus', async () => {
    const u = await makeFundedUser(created);
    const service = await makeService();
    for (let i = 0; i < 22; i++) {
      await makeOrder(u.id, service.id, {
        created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
      });
    }
    const b = (await (await detail(u.id)).json()) as { orders: { created_at: string }[] };
    expect(b.orders).toHaveLength(20);
    const dates = b.orders.map((o) => o.created_at);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('client inconnu : 404 USER_NOT_FOUND', async () => {
    const res = await detail(randomUUID());
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('USER_NOT_FOUND');
  });

  it('identifiant qui n’est pas un uuid : 404 USER_NOT_FOUND, jamais 500', async () => {
    const res = await detail('pas-un-uuid');
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('USER_NOT_FOUND');
  });
});

describe('PATCH /admin/users/{id} : blocage, remise, plafond', () => {
  it('bloque avec un motif : statut, motif et une ligne d’audit', async () => {
    const u = await makeFundedUser(created);
    const res = await patch(u.id, { status: 'blocked', blocked_reason: 'fraude au paiement' });
    expect(res.status).toBe(200);
    expect(await profileOf(u.id)).toMatchObject({
      status: 'blocked',
      blocked_reason: 'fraude au paiement',
    });
    const audit = await auditOf('update_user', u.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_id: admin.id });
  });

  it.each([[undefined], [''], ['   '], ['x'.repeat(501)]])(
    'blocage sans motif valide (%j) : 400, le client reste actif',
    async (reason) => {
      const u = await makeFundedUser(created);
      const res = await patch(u.id, { status: 'blocked', blocked_reason: reason });
      expect(res.status).toBe(400);
      expect(await errCode(res)).toBe('VALIDATION_ERROR');
      expect((await profileOf(u.id)).status).toBe('active');
    },
  );

  it('débloque : statut actif et motif effacé', async () => {
    const u = await makeFundedUser(created, {
      profile: { status: 'blocked', blocked_reason: 'test' },
    });
    expect((await patch(u.id, { status: 'active' })).status).toBe(200);
    expect(await profileOf(u.id)).toMatchObject({ status: 'active', blocked_reason: null });
  });

  it.each(['deleted', 'admin', 'BLOCKED', 42])('statut %j refusé : 400', async (status) => {
    const u = await makeFundedUser(created);
    expect((await patch(u.id, { status })).status).toBe(400);
    expect((await profileOf(u.id)).status).toBe('active');
  });

  it('refuse de bloquer le compte administrateur : 403 FORBIDDEN, rien ne change', async () => {
    const res = await patch(admin.id, { status: 'blocked', blocked_reason: 'test' });
    expect(res.status).toBe(403);
    expect(await errCode(res)).toBe('FORBIDDEN');
    expect((await profileOf(admin.id)).status).toBe('active');
  });

  it.each([[0], [15], [50], [12.5], [null]])('remise perso %j acceptée', async (pct) => {
    const u = await makeFundedUser(created);
    expect((await patch(u.id, { custom_discount_pct: pct })).status).toBe(200);
    expect(((await profileOf(u.id)).custom_discount_pct as number | null) ?? null).toBe(pct);
  });

  it.each([[-1], [50.01], [100], ['dix']])('remise perso %j refusée : 400', async (pct) => {
    const u = await makeFundedUser(created);
    expect((await patch(u.id, { custom_discount_pct: pct })).status).toBe(400);
    expect((await profileOf(u.id)).custom_discount_pct).toBeNull();
  });

  it.each([[0], [100000], [2000000]])('plafond journalier %j accepté (entier XAF)', async (v) => {
    const u = await makeFundedUser(created);
    expect((await patch(u.id, { daily_spend_limit_xaf: v })).status).toBe(200);
    expect(Number((await profileOf(u.id)).daily_spend_limit_xaf)).toBe(v);
  });

  it.each([[-1], [1.5], ['beaucoup'], [null]])('plafond journalier %j refusé : 400', async (v) => {
    const u = await makeFundedUser(created);
    expect((await patch(u.id, { daily_spend_limit_xaf: v })).status).toBe(400);
    expect(Number((await profileOf(u.id)).daily_spend_limit_xaf)).toBe(500000);
  });

  it.each([
    [{ is_admin: true }],
    [{ balance_xaf: 1000000 }],
    [{ referred_by: randomUUID() }],
    [{ email: 'autre@lyonpanel.test' }],
    [{ status: 'active', extra: 1 }],
    [{}],
  ])('champ inconnu ou corps vide %j : 400, rien ne change', async (body) => {
    const u = await makeFundedUser(created, { balance: 777 });
    const res = await patch(u.id, body);
    expect(res.status).toBe(400);
    const p = await profileOf(u.id);
    expect(p.is_admin).toBe(false);
    const { data } = await db.from('wallets').select('balance_xaf').eq('user_id', u.id).single();
    expect(Number(data!.balance_xaf)).toBe(777);
  });

  it('une modification de profil ne touche jamais au solde', async () => {
    const u = await makeFundedUser(created, { balance: 3000, recharged: 3000 });
    await patch(u.id, { status: 'blocked', blocked_reason: 'x' });
    await patch(u.id, { custom_discount_pct: 5, daily_spend_limit_xaf: 1000 });
    const { data } = await db.from('wallets').select('*').eq('user_id', u.id).single();
    expect([Number(data!.balance_xaf), Number(data!.total_recharged_xaf)]).toEqual([3000, 3000]);
    const { count } = await db
      .from('wallet_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id);
    expect(count).toBe(0);
  });

  it('client inconnu : 404 USER_NOT_FOUND', async () => {
    const res = await patch(randomUUID(), { custom_discount_pct: 5 });
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('USER_NOT_FOUND');
  });

  it('origine étrangère : 403 FORBIDDEN, rien ne change', async () => {
    const u = await makeFundedUser(created);
    const res = await patch(
      u.id,
      { status: 'blocked', blocked_reason: 'x' },
      { origin: 'https://evil.example' },
    );
    expect(res.status).toBe(403);
    expect((await profileOf(u.id)).status).toBe('active');
  });
});

describe('effets du blocage, de la remise et du plafond sur les commandes', () => {
  const LINK = 'https://www.tiktok.com/@client_test/video/7300000000000000000';
  const place = (userId: string, serviceId: number, qty: number) =>
    db.rpc('place_order', {
      p_user: userId,
      p_service: serviceId,
      p_link: LINK,
      p_qty: qty,
      p_comments: null,
      p_idem_key: randomUUID(),
    });
  const svc = () => makeService({ price_xaf_1000: 1000, min_qty: 10, max_qty: 10000 });

  it('un client bloqué par l’admin ne peut plus commander (ACCOUNT_BLOCKED), débloqué il le peut', async () => {
    const s = await svc();
    const u = await makeFundedUser(created, { balance: 5000 });
    await patch(u.id, { status: 'blocked', blocked_reason: 'test' });
    const refused = await place(u.id, s.id, 100);
    expect(refused.error?.message).toContain('ACCOUNT_BLOCKED');
    await patch(u.id, { status: 'active' });
    expect((await place(u.id, s.id, 100)).error).toBeNull();
  });

  it('un client bloqué garde son solde intact', async () => {
    const s = await svc();
    const u = await makeFundedUser(created, { balance: 5000 });
    await patch(u.id, { status: 'blocked', blocked_reason: 'test' });
    await place(u.id, s.id, 100);
    const { data } = await db.from('wallets').select('balance_xaf').eq('user_id', u.id).single();
    expect(Number(data!.balance_xaf)).toBe(5000);
  });

  it('remise perso de 20 % : 1000 XAF deviennent 800 XAF', async () => {
    const s = await svc();
    const u = await makeFundedUser(created, { balance: 5000 });
    await patch(u.id, { custom_discount_pct: 20 });
    const { data, error } = await place(u.id, s.id, 1000);
    expect(error).toBeNull();
    expect(data.charged_xaf).toBe(800);
  });

  it('plafond journalier abaissé à 500 XAF : une commande de 1000 XAF est refusée (DAILY_LIMIT_REACHED)', async () => {
    const s = await svc();
    const u = await makeFundedUser(created, { balance: 5000 });
    await patch(u.id, { daily_spend_limit_xaf: 500 });
    const { error } = await place(u.id, s.id, 1000);
    expect(error?.message).toContain('DAILY_LIMIT_REACHED');
  });
});

describe('POST /admin/users/{id}/notes : notes privées', () => {
  it('crée la note (201), la fiche la montre en premier, une ligne d’audit est écrite', async () => {
    const u = await makeFundedUser(created);
    const first = await addNote(u.id, { body: '  appel du 16/11  ' });
    expect(first.status).toBe(201);
    expect(((await first.json()) as { id: string }).id).toBeTruthy();
    await addNote(u.id, { body: 'deuxième note' });
    const b = (await (await detail(u.id)).json()) as { notes: { body: string }[] };
    expect(b.notes.map((n) => n.body)).toEqual(['deuxième note', 'appel du 16/11']);
    expect(await auditOf('add_note', u.id)).toHaveLength(2);
  });

  it.each([[''], ['   '], [undefined], [12], ['x'.repeat(2001)]])(
    'note invalide %j : 400, rien d’enregistré',
    async (body) => {
      const u = await makeFundedUser(created);
      const res = await addNote(u.id, { body });
      expect(res.status).toBe(400);
      const { count } = await db
        .from('admin_notes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', u.id);
      expect(count).toBe(0);
    },
  );

  it('client inconnu : 404 USER_NOT_FOUND', async () => {
    const res = await addNote(randomUUID(), { body: 'x' });
    expect(res.status).toBe(404);
    expect(await errCode(res)).toBe('USER_NOT_FOUND');
  });

  it('le client ne lit jamais ses notes (règles RLS)', async () => {
    const u = await makeFundedUser(created);
    await addNote(u.id, { body: 'note secrète' });
    const { data } = await (await userClient(u.id)).from('admin_notes').select('*');
    expect(data ?? []).toEqual([]);
  });
});
