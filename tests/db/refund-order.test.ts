import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];
let adminId = '';
let adminCreated = false;

beforeAll(async () => {
  // Un seul administrateur possible : réutiliser l'existant, sinon en créer un.
  const { data: existing } = await db.from('profiles').select('id').eq('is_admin', true);
  const first = existing?.[0];
  if (first) {
    adminId = first.id;
  } else {
    const u = await makeUser();
    created.push(u.id);
    await db.from('profiles').update({ is_admin: true }).eq('id', u.id);
    adminId = u.id;
    adminCreated = true;
  }
});

afterAll(async () => {
  if (adminCreated) await db.from('profiles').update({ is_admin: false }).eq('id', adminId);
  for (const id of created) await removeUser(id);
});

async function wallet(userId: string) {
  const { data } = await db.from('wallets').select('*').eq('user_id', userId).single();
  return data!;
}

/** Commande de 150 XAF déjà débitée : solde 0, transaction de débit cohérente. */
async function paidOrder() {
  const u = await makeUser();
  created.push(u.id);
  const s = await makeService();
  const o = await makeOrder(u.id, s.id, { charged_xaf: 150, status: 'canceled' });
  const { error } = await db.from('wallet_transactions').insert({
    user_id: u.id,
    type: 'order',
    amount_xaf: -150,
    balance_after_xaf: 0,
    order_id: o.id,
    ref: `order:${o.id}`,
  });
  expect(error).toBeNull();
  return { u, o };
}

const refund = (order: string, amount: number, by = adminId) =>
  db.rpc('refund_order', { p_order: order, p_amount: amount, p_admin: by });

describe('refund_order : remboursement', () => {
  it('rembourse la totalité : solde crédité, commande refunded, transaction refund', async () => {
    const { u, o } = await paidOrder();
    const { data, error } = await refund(o.id, 150);
    expect(error).toBeNull();
    expect(data.status).toBe('refunded');
    expect((await wallet(u.id)).balance_xaf).toBe(150);
    const { data: t } = await db
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', u.id)
      .eq('type', 'refund');
    expect(t).toHaveLength(1);
    expect(t![0]).toMatchObject({
      amount_xaf: 150,
      balance_after_xaf: 150,
      order_id: o.id,
      ref: `refund:${o.id}`,
      created_by: adminId,
    });
  });

  it('rembourse partiellement : seul le montant demandé est crédité', async () => {
    const { u, o } = await paidOrder();
    const { data, error } = await refund(o.id, 50);
    expect(error).toBeNull();
    expect(data.status).toBe('refunded');
    expect((await wallet(u.id)).balance_xaf).toBe(50);
  });

  it('écrit une ligne audit_log (acteur, action, cible, montant)', async () => {
    const { o } = await paidOrder();
    await refund(o.id, 120);
    const { data } = await db
      .from('audit_log')
      .select('*')
      .eq('target_table', 'orders')
      .eq('target_id', o.id);
    expect(data).toHaveLength(1);
    expect(data![0].actor_id).toBe(adminId);
    expect(data![0].action).toBeTruthy();
    expect(data![0].details).toMatchObject({ amount_xaf: 120 });
  });
});

describe('refund_order : refus sans aucun changement', () => {
  it('refuse ALREADY_REFUNDED après un remboursement partiel', async () => {
    const { u, o } = await paidOrder();
    expect((await refund(o.id, 50)).error).toBeNull();
    const { error } = await refund(o.id, 50);
    expect(error?.message).toContain('ALREADY_REFUNDED');
    expect((await wallet(u.id)).balance_xaf).toBe(50);
  });

  it('refuse ALREADY_REFUNDED après un remboursement total', async () => {
    const { u, o } = await paidOrder();
    await refund(o.id, 150);
    const { error } = await refund(o.id, 150);
    expect(error?.message).toContain('ALREADY_REFUNDED');
    expect((await wallet(u.id)).balance_xaf).toBe(150);
  });

  it('refuse AMOUNT_TOO_HIGH si le montant dépasse le débit', async () => {
    const { u, o } = await paidOrder();
    const { error } = await refund(o.id, 151);
    expect(error?.message).toContain('AMOUNT_TOO_HIGH');
    expect((await wallet(u.id)).balance_xaf).toBe(0);
    const { data } = await db.from('orders').select('status').eq('id', o.id).single();
    expect(data!.status).toBe('canceled');
  });

  it("refuse NOT_ADMIN si l'appelant n'est pas administrateur", async () => {
    const { u, o } = await paidOrder();
    const { error } = await refund(o.id, 150, u.id);
    expect(error?.message).toContain('NOT_ADMIN');
    expect((await wallet(u.id)).balance_xaf).toBe(0);
    const { count } = await db
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', o.id);
    expect(count).toBe(0);
  });

  it('refuse ORDER_NOT_FOUND pour une commande inexistante', async () => {
    const { error } = await refund('00000000-0000-4000-8000-000000000000', 100);
    expect(error?.message).toContain('ORDER_NOT_FOUND');
  });
});

describe('refund_order : concurrence et droits', () => {
  it('deux remboursements en parallèle : un seul passe, crédité une fois', async () => {
    const { u, o } = await paidOrder();
    const [r1, r2] = await Promise.all([refund(o.id, 150), refund(o.id, 150)]);
    expect([r1.error, r2.error].filter((e) => e === null)).toHaveLength(1);
    expect((await wallet(u.id)).balance_xaf).toBe(150);
    const { count } = await db
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', u.id)
      .eq('type', 'refund');
    expect(count).toBe(1);
  });

  it('un client authentifié ne peut pas appeler refund_order (permission denied)', async () => {
    const { u, o } = await paidOrder();
    const c = await userClient(u.id);
    const { error } = await c.rpc('refund_order', {
      p_order: o.id,
      p_amount: 150,
      p_admin: adminId,
    });
    expect(error?.message).toMatch(/permission denied/i);
    expect((await wallet(u.id)).balance_xaf).toBe(0);
  });
});
