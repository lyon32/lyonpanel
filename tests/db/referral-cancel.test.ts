import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePayment } from '../factories/payment';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { ensureAdmin, fakeSession, load } from '../helpers/admin-db';
import { getReq, sendReq, type ErrorBody } from '../helpers/client-area-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Annulation d'un bonus de parrainage (phase 11, décision 4b). DÉCISION DU PROPRIÉTAIRE : si le parrain a
 * déjà dépensé le bonus, on retire quand même le montant ; son solde PEUT passer négatif (ex. -100 XAF) ;
 * il ne peut plus commander tant qu'il n'a pas rechargé ; la fiche client affiche la dette.
 *
 * Fonction SQL attendue (seul chemin autorisé, jamais d'update direct du solde) :
 *   cancel_referral_bonus(p_reward uuid, p_reason text, p_admin uuid) returns bigint   -- nouveau solde du parrain
 *   - NOT_ADMIN si p_admin n'est pas l'administrateur ; REWARD_NOT_FOUND ; ALREADY_CANCELLED ; NOTE_REQUIRED (motif vide)
 *   - écrit une ligne wallet_transactions : amount_xaf = -bonus, ref = 'referral_cancel:<reward_id>', note = motif, created_by = admin
 *   - balance_after_xaf peut être négatif (les contrôles >= 0 de wallets et wallet_transactions sont à assouplir par lp-db)
 *   - referral_rewards reçoit cancelled_at, cancelled_by, cancel_reason ; audit_log : action 'cancel_referral_bonus', target_id = reward_id
 * Route : POST /api/v1/admin/referrals/{rewardId}/cancel { reason } -> 200 { balance_xaf } ; 409 si déjà annulé.
 * Fiche client : referrals[] = { id (reward), referee_id, created_at, bonus_xaf, bonus_cancelled, same_ip } ; debt_xaf = max(0, -solde).
 * Signal (décision 4c) : profiles.signup_ip_hash (empreinte HMAC, jamais l'IP) ; same_ip = vrai si parrain et filleul
 * ont la même empreinte non nulle. Aucun blocage automatique : le bonus reste versé, le filleul reste actif.
 */

const db = adminClient();
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
type Handler = (req: Request, ctx?: unknown) => Promise<Response>;
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  admin = await ensureAdmin();
  await db.from('settings').upsert({ key: 'referral_pct', value: 5 });
});
afterAll(async () => {
  await admin.release();
});
beforeEach(() => {
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  while (created.length) await removeUser(created.pop()!);
});

async function user(o: Parameters<typeof makeUser>[0] = {}) {
  const u = await makeUser(o);
  created.push(u.id);
  return u;
}

/** Parrain + filleul + recharge réelle de 3 000 XAF : bonus de 150 XAF versé au parrain. */
async function pairWithBonus() {
  const parrain = await user();
  const { data: pp } = await db
    .from('profiles')
    .select('referral_code')
    .eq('id', parrain.id)
    .single();
  const filleul = await user({ referral: pp!.referral_code as string });
  const p = await makePayment(filleul.id, { credited_xaf: 3000, fee_xaf: 90, total_paid: 3090 });
  const { error } = await db.rpc('credit_payment', {
    p_payment_id: p.id,
    p_saspay_transaction_id: `txn_${randomUUID()}`,
    p_net_amount_xaf: 3000,
    p_fee_xaf: 90,
    p_total_paid: 3090,
    p_network: 'MTN',
    p_raw: { test: true },
  });
  expect(error).toBeNull();
  const { data: reward } = await db
    .from('referral_rewards')
    .select('*')
    .eq('referee_id', filleul.id)
    .single();
  expect(reward!.amount_xaf).toBe(150);
  return { parrain, filleul, reward: reward as { id: string; amount_xaf: number } };
}

const balanceOf = async (id: string) =>
  Number(
    (await db.from('wallets').select('balance_xaf').eq('user_id', id).single()).data!.balance_xaf,
  );
const setBalance = (id: string, v: number) =>
  db.from('wallets').update({ balance_xaf: v }).eq('user_id', id);
const cancel = (reward: string, reason: string | null = 'faux compte', by = admin.id) =>
  db.rpc('cancel_referral_bonus', { p_reward: reward, p_reason: reason, p_admin: by });
const cancelTxs = async (userId: string) =>
  (
    await db
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .like('ref', 'referral_cancel:%')
  ).data ?? [];

describe('cancel_referral_bonus : cas normal', () => {
  it('retire 150 XAF au parrain (150 -> 0), journalise, marque le bonus annulé et écrit l’audit', async () => {
    const { parrain, reward } = await pairWithBonus();
    expect(await balanceOf(parrain.id)).toBe(150);
    const { data, error } = await cancel(reward.id, 'faux compte');
    expect(error).toBeNull();
    expect(Number(data)).toBe(0);
    expect(await balanceOf(parrain.id)).toBe(0);

    const txs = await cancelTxs(parrain.id);
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({
      amount_xaf: -150,
      balance_after_xaf: 0,
      ref: `referral_cancel:${reward.id}`,
      created_by: admin.id,
    });
    expect(String(txs[0].note)).toContain('faux compte');

    const { data: r } = await db.from('referral_rewards').select('*').eq('id', reward.id).single();
    expect(r).toMatchObject({ cancelled_by: admin.id, cancel_reason: 'faux compte' });
    expect(r!.cancelled_at).not.toBeNull();

    const { data: audit } = await db
      .from('audit_log')
      .select('*')
      .eq('action', 'cancel_referral_bonus')
      .eq('target_id', reward.id);
    expect(audit).toHaveLength(1);
    expect(audit![0]).toMatchObject({ actor_id: admin.id });
  });

  it('le parrain a encore 1 000 XAF : il lui en reste 850', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 1000);
    const { data } = await cancel(reward.id);
    expect(Number(data)).toBe(850);
    expect(await balanceOf(parrain.id)).toBe(850);
  });

  it('ne touche ni au solde ni au total rechargé du filleul', async () => {
    const { filleul, reward } = await pairWithBonus();
    expect((await cancel(reward.id)).error).toBeNull();
    const { data } = await db.from('wallets').select('*').eq('user_id', filleul.id).single();
    expect([Number(data!.balance_xaf), Number(data!.total_recharged_xaf)]).toEqual([3000, 3000]);
  });
});

describe('cancel_referral_bonus : bonus déjà dépensé, solde négatif (décision du propriétaire)', () => {
  it('solde 50 XAF, bonus 150 XAF : le solde passe à -100 XAF, la ligne de journal le dit', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 50);
    const { data, error } = await cancel(reward.id);
    expect(error).toBeNull();
    expect(Number(data)).toBe(-100);
    expect(await balanceOf(parrain.id)).toBe(-100);
    expect((await cancelTxs(parrain.id))[0]).toMatchObject({
      amount_xaf: -150,
      balance_after_xaf: -100,
    });
  });

  it('solde déjà à zéro : -150 XAF', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 0);
    await cancel(reward.id);
    expect(await balanceOf(parrain.id)).toBe(-150);
  });

  it('avec un solde négatif, le parrain ne peut plus commander (INSUFFICIENT_BALANCE), son solde ne bouge pas', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 50);
    await cancel(reward.id);
    const s = await makeService({ price_xaf_1000: 1000, min_qty: 10, max_qty: 10000 });
    const { error } = await db.rpc('place_order', {
      p_user: parrain.id,
      p_service: s.id,
      p_link: 'https://www.tiktok.com/@client_test/video/7300000000000000000',
      p_qty: 10,
      p_comments: null,
      p_idem_key: randomUUID(),
    });
    expect(error?.message).toContain('INSUFFICIENT_BALANCE');
    expect(await balanceOf(parrain.id)).toBe(-100);
  });

  it('après une recharge qui efface la dette, il peut de nouveau commander', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 50);
    await cancel(reward.id);
    const p = await makePayment(parrain.id, { credited_xaf: 1000, fee_xaf: 30, total_paid: 1030 });
    await db.rpc('credit_payment', {
      p_payment_id: p.id,
      p_saspay_transaction_id: `txn_${randomUUID()}`,
      p_net_amount_xaf: 1000,
      p_fee_xaf: 30,
      p_total_paid: 1030,
      p_network: 'MTN',
      p_raw: { test: true },
    });
    expect(await balanceOf(parrain.id)).toBe(900); // -100 + 1000
    const s = await makeService({ price_xaf_1000: 1000, min_qty: 10, max_qty: 10000 });
    const { error } = await db.rpc('place_order', {
      p_user: parrain.id,
      p_service: s.id,
      p_link: 'https://www.tiktok.com/@client_test/video/7300000000000000000',
      p_qty: 100,
      p_comments: null,
      p_idem_key: randomUUID(),
    });
    expect(error).toBeNull();
  });

  it('le parrain voit son solde négatif (lecture de son propre portefeuille)', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 50);
    await cancel(reward.id);
    const { data } = await (
      await userClient(parrain.id)
    )
      .from('wallets')
      .select('balance_xaf')
      .single();
    expect(Number(data!.balance_xaf)).toBe(-100);
  });

  it('admin_adjust ne peut toujours pas, lui, descendre sous zéro', async () => {
    const u = await user();
    await setBalance(u.id, 100);
    const { error } = await db.rpc('admin_adjust', {
      p_user: u.id,
      p_amount: -500,
      p_note: 'test',
      p_admin: admin.id,
    });
    expect(error).not.toBeNull();
    expect(await balanceOf(u.id)).toBe(100);
  });
});

describe('cancel_referral_bonus : refus', () => {
  it('deuxième annulation : ALREADY_CANCELLED, un seul retrait au journal, solde inchangé', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 1000);
    expect((await cancel(reward.id)).error).toBeNull();
    const again = await cancel(reward.id);
    expect(again.error?.message).toContain('ALREADY_CANCELLED');
    expect(await balanceOf(parrain.id)).toBe(850);
    expect(await cancelTxs(parrain.id)).toHaveLength(1);
  });

  it('deux annulations simultanées : une seule réussit, un seul retrait', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 1000);
    const results = await Promise.all([cancel(reward.id), cancel(reward.id), cancel(reward.id)]);
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(await balanceOf(parrain.id)).toBe(850);
    expect(await cancelTxs(parrain.id)).toHaveLength(1);
  });

  it('refuse un appelant qui n’est pas l’administrateur (NOT_ADMIN) : rien ne change', async () => {
    const { parrain, filleul, reward } = await pairWithBonus();
    for (const by of [parrain.id, filleul.id, randomUUID()]) {
      expect((await cancel(reward.id, 'x', by)).error?.message).toContain('NOT_ADMIN');
    }
    expect(await balanceOf(parrain.id)).toBe(150);
    expect(await cancelTxs(parrain.id)).toHaveLength(0);
  });

  it('bonus inconnu : REWARD_NOT_FOUND', async () => {
    expect((await cancel(randomUUID())).error?.message).toContain('REWARD_NOT_FOUND');
  });

  it.each([[null], [''], ['   ']])(
    'motif absent (%j) : NOTE_REQUIRED, rien ne change',
    async (reason) => {
      const { parrain, reward } = await pairWithBonus();
      expect((await cancel(reward.id, reason)).error?.message).toContain('NOTE_REQUIRED');
      expect(await balanceOf(parrain.id)).toBe(150);
    },
  );

  it('un client connecté ne peut pas appeler la fonction (réservée à la clé de service)', async () => {
    const { parrain, reward } = await pairWithBonus();
    const c = await userClient(parrain.id);
    const { error } = await c.rpc('cancel_referral_bonus', {
      p_reward: reward.id,
      p_reason: 'x',
      p_admin: admin.id,
    });
    // 42501 = droit refusé (la fonction existe mais n'est pas appelable par un client) ; PGRST202 = fonction absente.
    expect(error?.code).toBe('42501');
    expect(await balanceOf(parrain.id)).toBe(150);
  });

  it('un bonus annulé ne revient pas : la recharge suivante du filleul ne crée pas de nouveau bonus', async () => {
    const { parrain, filleul, reward } = await pairWithBonus();
    await cancel(reward.id);
    const p = await makePayment(filleul.id, { credited_xaf: 3000, fee_xaf: 90, total_paid: 3090 });
    await db.rpc('credit_payment', {
      p_payment_id: p.id,
      p_saspay_transaction_id: `txn_${randomUUID()}`,
      p_net_amount_xaf: 3000,
      p_fee_xaf: 90,
      p_total_paid: 3090,
      p_network: 'MTN',
      p_raw: { test: true },
    });
    const { count } = await db
      .from('referral_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('referee_id', filleul.id);
    expect(count).toBe(1);
    expect(await balanceOf(parrain.id)).toBe(0);
  });
});

describe('POST /admin/referrals/{id}/cancel et fiche client', () => {
  const post = async (id: string, body: unknown) =>
    (await load<{ POST: Handler }>('@/app/api/v1/admin/referrals/[id]/cancel/route')).POST(
      sendReq('POST', `/api/v1/admin/referrals/${id}/cancel`, body),
      idCtx(id),
    );
  const detail = async (id: string) =>
    (await load<{ GET: Handler }>('@/app/api/v1/admin/users/[id]/route')).GET(
      getReq(`/api/v1/admin/users/${id}`),
      idCtx(id),
    );
  type Detail = {
    debt_xaf: number;
    wallet: { balance_xaf: number };
    referrals: {
      id: string;
      referee_id: string;
      bonus_xaf: number;
      bonus_cancelled: boolean;
      same_ip: boolean;
    }[];
  };

  it('annule, répond 200 avec le nouveau solde (négatif possible)', async () => {
    const { parrain, reward } = await pairWithBonus();
    await setBalance(parrain.id, 50);
    const res = await post(reward.id, { reason: 'faux compte' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { balance_xaf: number }).balance_xaf).toBe(-100);
  });

  it('la fiche du parrain montre le filleul, le bonus annulé et la dette de 100 XAF', async () => {
    const { parrain, filleul, reward } = await pairWithBonus();
    await setBalance(parrain.id, 50);
    await post(reward.id, { reason: 'faux compte' });
    const b = (await (await detail(parrain.id)).json()) as Detail;
    expect(b.wallet.balance_xaf).toBe(-100);
    expect(b.debt_xaf).toBe(100);
    expect(b.referrals).toHaveLength(1);
    expect(b.referrals[0]).toMatchObject({
      id: reward.id,
      referee_id: filleul.id,
      bonus_xaf: 150,
      bonus_cancelled: true,
    });
  });

  it('avant annulation : bonus_cancelled faux, pas de dette', async () => {
    const { parrain } = await pairWithBonus();
    const b = (await (await detail(parrain.id)).json()) as Detail;
    expect(b.referrals[0]).toMatchObject({ bonus_xaf: 150, bonus_cancelled: false });
    expect(b.debt_xaf).toBe(0);
  });

  it('deuxième annulation : 409', async () => {
    const { reward } = await pairWithBonus();
    await post(reward.id, { reason: 'x' });
    expect((await post(reward.id, { reason: 'x' })).status).toBe(409);
  });

  it.each([[{}], [{ reason: '' }], [{ reason: 'x'.repeat(501) }], [{ reason: 5 }]])(
    'motif invalide %j : 400',
    async (body) => {
      const { parrain, reward } = await pairWithBonus();
      const res = await post(reward.id, body);
      expect(res.status).toBe(400);
      expect(((await res.json()) as ErrorBody).error.code).toBe('VALIDATION_ERROR');
      expect(await balanceOf(parrain.id)).toBe(150);
    },
  );

  it('bonus inconnu ou identifiant invalide : 404', async () => {
    expect((await post(randomUUID(), { reason: 'x' })).status).toBe(404);
    expect((await post('pas-un-uuid', { reason: 'x' })).status).toBe(404);
  });

  it('client ordinaire ou visiteur : 404, rien n’est retiré', async () => {
    const { parrain, reward } = await pairWithBonus();
    session.client = fakeSession(parrain.id, { current: 'aal2' });
    expect((await post(reward.id, { reason: 'x' })).status).toBe(404);
    session.client = fakeSession(null);
    expect((await post(reward.id, { reason: 'x' })).status).toBe(404);
    expect(await balanceOf(parrain.id)).toBe(150);
  });

  it('admin sans code à 6 chiffres : 401 MFA_REQUIRED, rien n’est retiré', async () => {
    const { parrain, reward } = await pairWithBonus();
    session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal2' });
    const res = await post(reward.id, { reason: 'x' });
    expect(res.status).toBe(401);
    expect(await balanceOf(parrain.id)).toBe(150);
  });
});

describe('signal « même appareil / même réseau » entre parrain et filleul', () => {
  const detail = async (id: string) =>
    (await load<{ GET: Handler }>('@/app/api/v1/admin/users/[id]/route')).GET(
      getReq(`/api/v1/admin/users/${id}`),
      idCtx(id),
    );
  type Detail = { referrals: { same_ip: boolean }[] };
  const setHash = (id: string, h: string | null) =>
    db.from('profiles').update({ signup_ip_hash: h }).eq('id', id);
  const HASH = 'a'.repeat(64);

  it('même empreinte d’IP à l’inscription : same_ip vrai', async () => {
    const { parrain, filleul } = await pairWithBonus();
    await setHash(parrain.id, HASH);
    await setHash(filleul.id, HASH);
    expect(((await (await detail(parrain.id)).json()) as Detail).referrals[0]!.same_ip).toBe(true);
  });

  it('empreintes différentes : faux', async () => {
    const { parrain, filleul } = await pairWithBonus();
    await setHash(parrain.id, HASH);
    await setHash(filleul.id, 'b'.repeat(64));
    expect(((await (await detail(parrain.id)).json()) as Detail).referrals[0]!.same_ip).toBe(false);
  });

  it('empreintes inconnues des deux côtés (null = null) : faux, pas de faux signal', async () => {
    const { parrain } = await pairWithBonus();
    expect(((await (await detail(parrain.id)).json()) as Detail).referrals[0]!.same_ip).toBe(false);
  });

  it('une seule empreinte connue : faux', async () => {
    const { parrain, filleul } = await pairWithBonus();
    await setHash(filleul.id, HASH);
    expect(((await (await detail(parrain.id)).json()) as Detail).referrals[0]!.same_ip).toBe(false);
  });

  it('aucun blocage automatique : le bonus est quand même versé et le filleul reste actif', async () => {
    const parrain = await user();
    await setHash(parrain.id, HASH);
    const { data: pp } = await db
      .from('profiles')
      .select('referral_code')
      .eq('id', parrain.id)
      .single();
    const filleul = await user({ referral: pp!.referral_code as string });
    expect((await setHash(filleul.id, HASH)).error).toBeNull();
    const p = await makePayment(filleul.id, { credited_xaf: 3000, fee_xaf: 90, total_paid: 3090 });
    await db.rpc('credit_payment', {
      p_payment_id: p.id,
      p_saspay_transaction_id: `txn_${randomUUID()}`,
      p_net_amount_xaf: 3000,
      p_fee_xaf: 90,
      p_total_paid: 3090,
      p_network: 'MTN',
      p_raw: { test: true },
    });
    expect(await balanceOf(parrain.id)).toBe(150);
    const { data } = await db.from('profiles').select('status').in('id', [parrain.id, filleul.id]);
    expect(data!.map((r) => r.status)).toEqual(['active', 'active']);
  });

  it('la fiche ne renvoie jamais l’empreinte ni une IP, seulement le booléen', async () => {
    const { parrain, filleul } = await pairWithBonus();
    await setHash(parrain.id, HASH);
    await setHash(filleul.id, HASH);
    const text = JSON.stringify(await (await detail(parrain.id)).json());
    expect(text).not.toContain(HASH);
    expect(text).not.toMatch(/signup_ip|ip_hash/);
  });

  it('un client ne peut pas lire signup_ip_hash (colonne cachée)', async () => {
    const { parrain } = await pairWithBonus();
    expect(
      (await db.from('profiles').select('signup_ip_hash').eq('id', parrain.id)).error,
    ).toBeNull();
    const { error } = await (
      await userClient(parrain.id)
    )
      .from('profiles')
      .select('signup_ip_hash');
    expect(error?.code).toBe('42501');
  });
});
