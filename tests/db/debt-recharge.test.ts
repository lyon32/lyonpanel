import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { ensureAdmin } from '../helpers/admin-db';
import { balanceXaf, makeDebtor, recharge } from '../helpers/debt-db';
import { makeFollowersService } from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));

/*
 * DETTE (décision du propriétaire, 11.1c) : un client en dette rembourse d'abord sa dette ; une recharge fait
 * simplement solde + recharge (-1000 + 500 = -500). Règle de la base (lp-db) :
 *   le solde ne peut BAISSER sous zéro que via cancel_referral_bonus ; toute AUGMENTATION est acceptée, même si le
 *   solde reste négatif : le paiement n'est JAMAIS perdu (credit_payment ne peut plus échouer sur ce CHECK).
 *   Piste : déclencheur BEFORE UPDATE sur wallets (refuser si nouveau < 0 ET nouveau < ancien, sauf cancel_referral_bonus)
 *   et wallet_transactions_balance_after_xaf_check assoupli pour recharge / bonus / refund / adjustment.
 * Inchangé : place_order, admin_adjust négatif, tout retrait sous zéro et tout update direct qui baisse sous 0 refusés.
 */

const db = adminClient();
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  await admin.release();
});
afterEach(async () => {
  while (created.length) await removeUser(created.pop()!);
});

const debtor = (debt: number) => makeDebtor(created, debt, admin.id);

describe('credit_payment : recharge d’un client en dette', () => {
  it('-1000 + recharge 500 : créditée, solde -500', async () => {
    const u = await debtor(1000);
    const { paymentId, error } = await recharge(u.id, 500);
    expect(error).toBeNull();
    expect(await balanceXaf(u.id)).toBe(-500);
    const { data: pay } = await db.from('payments').select('status').eq('id', paymentId).single();
    expect(pay!.status).toBe('succeeded');
    const { data: tx } = await db
      .from('wallet_transactions')
      .select('amount_xaf, balance_after_xaf, type')
      .eq('payment_id', paymentId)
      .single();
    expect(tx).toMatchObject({ type: 'recharge', amount_xaf: 500, balance_after_xaf: -500 });
  });

  it('-500 + recharge 2000 : solde 1500', async () => {
    const u = await debtor(500);
    const { error } = await recharge(u.id, 2000);
    expect(error).toBeNull();
    expect(await balanceXaf(u.id)).toBe(1500);
  });

  it('-1000 + recharge 1000 : solde 0', async () => {
    const u = await debtor(1000);
    expect((await recharge(u.id, 1000)).error).toBeNull();
    expect(await balanceXaf(u.id)).toBe(0);
  });

  it('un rejeu du même paiement ne crédite pas deux fois', async () => {
    const u = await debtor(1000);
    const { paymentId } = await recharge(u.id, 500);
    const again = await db.rpc('credit_payment', {
      p_payment_id: paymentId,
      p_saspay_transaction_id: `txn_${randomUUID()}`,
      p_net_amount_xaf: 500,
      p_fee_xaf: 15,
      p_total_paid: 515,
      p_network: 'MTN',
      p_raw: { test: true },
    });
    expect(again.error).toBeNull();
    expect(await balanceXaf(u.id)).toBe(-500);
  });

  it('recharge du FILLEUL dont le parrain est à -1000 : créditée ; bonus de 50 sur la dette (parrain -950)', async () => {
    const parrain = await debtor(1000);
    const { data: pp } = await db
      .from('profiles')
      .select('referral_code')
      .eq('id', parrain.id)
      .single();
    const filleul = await makeUser({ referral: pp!.referral_code as string });
    created.push(filleul.id);
    const { error } = await recharge(filleul.id, 1000);
    expect(error).toBeNull();
    expect(await balanceXaf(filleul.id)).toBe(1000);
    expect(await balanceXaf(parrain.id)).toBe(-950);
  });
});

describe('autres entrées d’argent sur un solde négatif : acceptées', () => {
  it('refund_order rembourse 150 sur un solde de -500 : -350', async () => {
    const u = await debtor(500);
    const s = await makeService();
    const o = await makeOrder(u.id, s.id, { charged_xaf: 150, status: 'canceled' });
    const tx = await db.from('wallet_transactions').insert({
      user_id: u.id,
      type: 'order',
      amount_xaf: -150,
      balance_after_xaf: 0,
      order_id: o.id,
      ref: `order:${o.id}`,
    });
    expect(tx.error).toBeNull();
    const { error } = await db.rpc('refund_order', {
      p_order: o.id,
      p_amount: 150,
      p_admin: admin.id,
    });
    expect(error).toBeNull();
    expect(await balanceXaf(u.id)).toBe(-350);
  });

  it('admin_adjust +300 sur -500 : -200', async () => {
    const u = await debtor(500);
    const { error } = await db.rpc('admin_adjust', {
      p_user: u.id,
      p_amount: 300,
      p_note: 'geste commercial',
      p_admin: admin.id,
    });
    expect(error).toBeNull();
    expect(await balanceXaf(u.id)).toBe(-200);
  });
});

describe('toute baisse sous zéro reste refusée, sans rien changer', () => {
  it('admin_adjust -100 sur un solde de -500 est refusé', async () => {
    const u = await debtor(500);
    const { error } = await db.rpc('admin_adjust', {
      p_user: u.id,
      p_amount: -100,
      p_note: 'correction',
      p_admin: admin.id,
    });
    expect(error).not.toBeNull();
    expect(await balanceXaf(u.id)).toBe(-500);
  });

  it('admin_adjust -1 sur un solde de 0 est refusé', async () => {
    const u = await debtor(500);
    await recharge(u.id, 500);
    expect(await balanceXaf(u.id)).toBe(0);
    const { error } = await db.rpc('admin_adjust', {
      p_user: u.id,
      p_amount: -1,
      p_note: 'correction',
      p_admin: admin.id,
    });
    expect(error).not.toBeNull();
    expect(await balanceXaf(u.id)).toBe(0);
  });

  it('un update direct qui baisse le solde de -500 à -600 est refusé (23514)', async () => {
    const u = await debtor(500);
    const { error } = await db.from('wallets').update({ balance_xaf: -600 }).eq('user_id', u.id);
    expect(error?.code).toBe('23514');
    expect(await balanceXaf(u.id)).toBe(-500);
  });

  it('un update direct de 0 à -1 est refusé (23514)', async () => {
    const u = await debtor(500);
    await recharge(u.id, 500);
    const { error } = await db.from('wallets').update({ balance_xaf: -1 }).eq('user_id', u.id);
    expect(error?.code).toBe('23514');
  });

  it('un client en dette ne peut pas commander : INSUFFICIENT_BALANCE', async () => {
    const u = await debtor(500);
    const s = await makeFollowersService();
    const { error } = await db.rpc('place_order', {
      p_user: u.id,
      p_service: s.id,
      p_link: 'https://www.tiktok.com/@client_test',
      p_qty: 10,
      p_comments: null,
      p_idem_key: randomUUID(),
    });
    expect(error?.message).toContain('INSUFFICIENT_BALANCE');
    expect(await balanceXaf(u.id)).toBe(-500);
  });
});
