import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makePayment } from '../factories/payment';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];

async function user(o: Parameters<typeof makeUser>[0] = {}) {
  const u = await makeUser(o);
  created.push(u.id);
  return u;
}

// Nettoyage au mieux : les lignes de journal immuables bloquent la suppression, c'est voulu.
afterEach(async () => {
  while (created.length) await removeUser(created.pop()!);
});

beforeAll(async () => {
  await db.from('settings').upsert({ key: 'referral_pct', value: 5 });
});

type Pay = { id: string } & Record<string, unknown>;

/** Appelle credit_payment avec des valeurs cohérentes avec le paiement, modifiables. */
function credit(p: Pay, o: Record<string, unknown> = {}) {
  return db.rpc('credit_payment', {
    p_payment_id: p.id,
    p_saspay_transaction_id: `txn_${randomUUID()}`,
    p_net_amount_xaf: p.credited_xaf,
    p_fee_xaf: p.fee_xaf,
    p_total_paid: p.total_paid,
    p_network: 'MTN',
    p_raw: { test: true },
    ...o,
  });
}

async function wallet(userId: string) {
  const { data } = await db.from('wallets').select('*').eq('user_id', userId).single();
  return data as { balance_xaf: number; total_recharged_xaf: number };
}

async function txs(userId: string, type?: string) {
  let q = db.from('wallet_transactions').select('*').eq('user_id', userId);
  if (type) q = q.eq('type', type);
  const { data } = await q;
  return data ?? [];
}

async function referredPair() {
  const parrain = await user();
  const { data: pp } = await db
    .from('profiles')
    .select('referral_code')
    .eq('id', parrain.id)
    .single();
  const filleul = await user({ referral: pp?.referral_code });
  return { parrain, filleul };
}

describe('credit_payment — crédit normal', () => {
  it('crédite le solde, journalise la recharge et marque le paiement réussi', async () => {
    const u = await user();
    const p = await makePayment(u.id, { credited_xaf: 10000, fee_xaf: 300, total_paid: 10300 });
    const { data, error } = await credit(p, { p_saspay_transaction_id: `txn_${p.id}` });
    expect(error).toBeNull();
    expect(data).toEqual({ credited: true, balance_xaf: 10000, referral_bonus_xaf: 0 });

    const w = await wallet(u.id);
    expect(w.balance_xaf).toBe(10000);
    expect(w.total_recharged_xaf).toBe(10000);

    const t = await txs(u.id, 'recharge');
    expect(t).toHaveLength(1);
    expect(t[0].amount_xaf).toBe(10000);
    expect(t[0].balance_after_xaf).toBe(10000);
    expect(t[0].ref).toBe(`pay:${p.id}`);
    expect(t[0].payment_id).toBe(p.id);

    const { data: pay } = await db.from('payments').select('*').eq('id', p.id).single();
    expect(pay?.status).toBe('succeeded');
    expect(pay?.succeeded_at).not.toBeNull();
    expect(pay?.saspay_transaction_id).toBe(`txn_${p.id}`);
    expect(pay?.saspay_network).toBe('MTN');
  });
});

describe('credit_payment — doublons et parallélisme', () => {
  it('un même appel deux fois ne crédite qu une fois', async () => {
    const u = await user();
    const p = await makePayment(u.id, { credited_xaf: 5000, fee_xaf: 150, total_paid: 5150 });
    const txn = `txn_${randomUUID()}`;
    const a = await credit(p, { p_saspay_transaction_id: txn });
    const b = await credit(p, { p_saspay_transaction_id: txn });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data.credited).toBe(true);
    expect(b.data.credited).toBe(false);
    expect(b.data.balance_xaf).toBe(5000);
    expect((await wallet(u.id)).balance_xaf).toBe(5000);
    expect(await txs(u.id, 'recharge')).toHaveLength(1);
  });

  it('deux appels en parallèle ne créditent qu une fois', async () => {
    const u = await user();
    const p = await makePayment(u.id, { credited_xaf: 7000, fee_xaf: 210, total_paid: 7210 });
    const txn = `txn_${randomUUID()}`;
    const res = await Promise.all([
      credit(p, { p_saspay_transaction_id: txn }),
      credit(p, { p_saspay_transaction_id: txn }),
    ]);
    expect(res.map((r) => r.error)).toEqual([null, null]);
    expect(res.filter((r) => r.data.credited)).toHaveLength(1);
    expect((await wallet(u.id)).balance_xaf).toBe(7000);
    expect(await txs(u.id, 'recharge')).toHaveLength(1);
  });

  it('refuse un identifiant SasPay déjà utilisé par un autre paiement', async () => {
    const u = await user();
    const p1 = await makePayment(u.id, { credited_xaf: 3000, fee_xaf: 90, total_paid: 3090 });
    const p2 = await makePayment(u.id, { credited_xaf: 3000, fee_xaf: 90, total_paid: 3090 });
    const txn = `txn_${randomUUID()}`;
    expect((await credit(p1, { p_saspay_transaction_id: txn })).error).toBeNull();
    const second = await credit(p2, { p_saspay_transaction_id: txn });
    expect(second.error).not.toBeNull();
    expect((await wallet(u.id)).balance_xaf).toBe(3000);
    const { data: pay2 } = await db.from('payments').select('status').eq('id', p2.id).single();
    expect(pay2?.status).not.toBe('succeeded');
  });
});

describe('credit_payment — erreurs', () => {
  it('refuse un montant net différent du montant demandé (AMOUNT_MISMATCH)', async () => {
    const u = await user();
    const p = await makePayment(u.id, { credited_xaf: 10000, fee_xaf: 300, total_paid: 10300 });
    const { error } = await credit(p, { p_net_amount_xaf: 9000 });
    expect(error?.message).toContain('AMOUNT_MISMATCH');
    expect((await wallet(u.id)).balance_xaf).toBe(0);
    expect(await txs(u.id)).toHaveLength(0);
    const { data: pay } = await db.from('payments').select('status').eq('id', p.id).single();
    expect(pay?.status).not.toBe('succeeded');
  });

  it('refuse un paiement inconnu (PAYMENT_NOT_FOUND)', async () => {
    const { error } = await db.rpc('credit_payment', {
      p_payment_id: randomUUID(),
      p_saspay_transaction_id: `txn_${randomUUID()}`,
      p_net_amount_xaf: 3000,
      p_fee_xaf: 90,
      p_total_paid: 3090,
      p_network: 'MTN',
      p_raw: {},
    });
    expect(error?.message).toContain('PAYMENT_NOT_FOUND');
  });

  it('refuse l appel par un client connecté (droit refusé)', async () => {
    const u = await user();
    const p = await makePayment(u.id, { credited_xaf: 3000, fee_xaf: 90, total_paid: 3090 });
    const client = await userClient(u.id);
    const { error } = await client.rpc('credit_payment', {
      p_payment_id: p.id,
      p_saspay_transaction_id: `txn_${randomUUID()}`,
      p_net_amount_xaf: 3000,
      p_fee_xaf: 90,
      p_total_paid: 3090,
      p_network: 'MTN',
      p_raw: {},
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied/i);
    expect((await wallet(u.id)).balance_xaf).toBe(0);
  });
});

describe('credit_payment — parrainage', () => {
  it.each([
    [3000, 150],
    [10000, 500],
    [3001, 150], // 5 % de 3001 = 150,05 : arrondi à l'inférieur
  ])('1re recharge de %i XAF : bonus parrain de %i XAF', async (amount, bonus) => {
    const { parrain, filleul } = await referredPair();
    const p = await makePayment(filleul.id, {
      credited_xaf: amount,
      fee_xaf: 90,
      total_paid: amount + 90,
    });
    const { data, error } = await credit(p);
    expect(error).toBeNull();
    expect(data.referral_bonus_xaf).toBe(bonus);
    expect(data.balance_xaf).toBe(amount); // le filleul ne perd rien

    expect((await wallet(parrain.id)).balance_xaf).toBe(bonus);
    const bt = await txs(parrain.id, 'referral_bonus');
    expect(bt).toHaveLength(1);
    expect(bt[0].amount_xaf).toBe(bonus);

    const { data: rr } = await db.from('referral_rewards').select('*').eq('referee_id', filleul.id);
    expect(rr).toHaveLength(1);
    expect(rr?.[0].referrer_id).toBe(parrain.id);
    expect(rr?.[0].payment_id).toBe(p.id);
    expect(rr?.[0].amount_xaf).toBe(bonus);
    expect(bt[0].ref).toBe(`ref:${rr?.[0].id}`);
  });

  it('ne verse le bonus qu une seule fois (2e recharge : 0 bonus)', async () => {
    const { parrain, filleul } = await referredPair();
    const p1 = await makePayment(filleul.id, {
      credited_xaf: 10000,
      fee_xaf: 300,
      total_paid: 10300,
    });
    const p2 = await makePayment(filleul.id, {
      credited_xaf: 10000,
      fee_xaf: 300,
      total_paid: 10300,
    });
    expect((await credit(p1)).data.referral_bonus_xaf).toBe(500);
    const second = await credit(p2);
    expect(second.error).toBeNull();
    expect(second.data.credited).toBe(true);
    expect(second.data.referral_bonus_xaf).toBe(0);
    expect((await wallet(parrain.id)).balance_xaf).toBe(500);
    expect(await txs(parrain.id, 'referral_bonus')).toHaveLength(1);
  });

  it('ne verse aucun bonus à un client sans parrain', async () => {
    const u = await user();
    const p = await makePayment(u.id);
    expect((await credit(p)).data.referral_bonus_xaf).toBe(0);
    const { data: rr } = await db.from('referral_rewards').select('id').eq('referee_id', u.id);
    expect(rr).toHaveLength(0);
  });
});

describe('credit_payment — cumul et seuil de remise', () => {
  it('cumule total_recharged_xaf sur plusieurs recharges (seuil 50 000 franchi)', async () => {
    const u = await user();
    for (const amount of [30000, 15000, 10000]) {
      const p = await makePayment(u.id, { credited_xaf: amount, fee_xaf: 0, total_paid: amount });
      expect((await credit(p)).error).toBeNull();
    }
    const w = await wallet(u.id);
    expect(w.total_recharged_xaf).toBe(55000);
    expect(w.balance_xaf).toBe(55000);
    expect(await txs(u.id, 'recharge')).toHaveLength(3);
  });
});

describe('credit_payment — compte supprimé', () => {
  it('crédite quand même et écrit une ligne audit_log « à rembourser »', async () => {
    const u = await user();
    const p = await makePayment(u.id, { credited_xaf: 4000, fee_xaf: 120, total_paid: 4120 });
    const { error: upErr } = await db.from('profiles').update({ status: 'deleted' }).eq('id', u.id);
    expect(upErr).toBeNull();

    const { data, error } = await credit(p);
    expect(error).toBeNull();
    expect(data.credited).toBe(true);
    expect((await wallet(u.id)).balance_xaf).toBe(4000);

    const { data: logs } = await db
      .from('audit_log')
      .select('*')
      .eq('target_table', 'payments')
      .eq('target_id', p.id);
    expect(logs?.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(logs)).toMatch(/à rembourser/);
  });
});
