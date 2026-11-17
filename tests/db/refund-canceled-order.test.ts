import { afterAll, describe, expect, it } from 'vitest';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await removeUser(id);
});

/** Commande de 150 XAF débitée, annulation demandée par le client : solde 0. */
async function cancelledOrder(overrides: Record<string, unknown> = {}) {
  const u = await makeUser();
  created.push(u.id);
  const s = await makeService();
  const o = await makeOrder(u.id, s.id, {
    charged_xaf: 150,
    status: 'in_progress',
    ...overrides,
  });
  await db.from('orders').update({ cancel_requested_at: new Date().toISOString() }).eq('id', o.id);
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

const wallet = async (id: string) =>
  (await db.from('wallets').select('balance_xaf').eq('user_id', id).single()).data!.balance_xaf;

describe('refund_canceled_order', () => {
  it('rembourse tout le montant débité, une seule fois, commande refunded', async () => {
    const { u, o } = await cancelledOrder();
    const first = await db.rpc('refund_canceled_order', { p_order: o.id });
    expect(first.error).toBeNull();
    expect(first.data.status).toBe('refunded');
    expect(await wallet(u.id)).toBe(150);
    const second = await db.rpc('refund_canceled_order', { p_order: o.id });
    expect(second.error?.message).toContain('ALREADY_REFUNDED');
    expect(await wallet(u.id)).toBe(150);
  });

  it('refuse une commande dont le client n a pas demandé l annulation', async () => {
    const { u, o } = await cancelledOrder();
    await db.from('orders').update({ cancel_requested_at: null }).eq('id', o.id);
    const { error } = await db.rpc('refund_canceled_order', { p_order: o.id });
    expect(error?.message).toContain('NOT_CANCELLABLE');
    expect(await wallet(u.id)).toBe(0);
  });

  it('refuse une commande déjà terminée', async () => {
    const { u, o } = await cancelledOrder({ status: 'completed' });
    const { error } = await db.rpc('refund_canceled_order', { p_order: o.id });
    expect(error?.message).toContain('NOT_CANCELLABLE');
    expect(await wallet(u.id)).toBe(0);
  });

  it('un client connecté ne peut pas appeler la fonction', async () => {
    const { u, o } = await cancelledOrder();
    const client = await userClient(u.id);
    const { error } = await client.rpc('refund_canceled_order', { p_order: o.id });
    expect(error).not.toBeNull();
    expect(await wallet(u.id)).toBe(0);
  });
});
