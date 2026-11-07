import { afterAll, describe, expect, it } from 'vitest';
import { makeOrder } from '../factories/order';
import { makePayment } from '../factories/payment';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await removeUser(id);
});

async function wallet(userId: string) {
  const { data } = await db.from('wallets').select('*').eq('user_id', userId).single();
  return data!;
}

/** Client complet : solde, commande, paiement, favori, ticket, message, pièce jointe. */
async function fullClient() {
  const u = await makeUser();
  created.push(u.id);
  await db.from('wallets').update({ balance_xaf: 1000 }).eq('user_id', u.id);
  const s = await makeService();
  const order = await makeOrder(u.id, s.id);
  const payment = await makePayment(u.id);
  await db.from('favorites').insert({ user_id: u.id, service_id: s.id });
  const { data: ticket } = await db
    .from('tickets')
    .insert({ user_id: u.id, subject: 'Aide', order_id: order.id })
    .select()
    .single();
  const { data: msg } = await db
    .from('ticket_messages')
    .insert({ ticket_id: ticket!.id, from_admin: false, body: 'mon numéro est secret' })
    .select()
    .single();
  const { error } = await db.from('ticket_attachments').insert({
    message_id: msg!.id,
    storage_path: `${u.id}/capture.png`,
    mime: 'image/png',
    size_bytes: 1000,
  });
  expect(error).toBeNull();
  return { u, order, payment, msg: msg! };
}

const anonymize = (id: string) => db.rpc('anonymize_user', { p_user: id });

describe('anonymize_user', () => {
  it('efface email, téléphone, messages ; status deleted ; deleted_at renseigné', async () => {
    const { u, msg } = await fullClient();
    const { error } = await anonymize(u.id);
    expect(error).toBeNull();
    const { data: p } = await db.from('profiles').select('*').eq('id', u.id).single();
    expect(p!.email).toBeNull();
    expect(p!.phone).toBeNull();
    expect(p!.status).toBe('deleted');
    expect(p!.deleted_at).not.toBeNull();
    const { data: m } = await db.from('ticket_messages').select('body').eq('id', msg.id).single();
    expect(m!.body).toBeNull();
  });

  it('supprime pièces jointes et favoris', async () => {
    const { u, msg } = await fullClient();
    await anonymize(u.id);
    const { count: att } = await db
      .from('ticket_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('message_id', msg.id);
    const { count: fav } = await db
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', u.id);
    expect(att).toBe(0);
    expect(fav).toBe(0);
  });

  it('garde commandes, paiements et portefeuille intacts', async () => {
    const { u, order, payment } = await fullClient();
    expect((await anonymize(u.id)).error).toBeNull();
    const { data: o } = await db.from('orders').select('*').eq('id', order.id).single();
    expect(o).toMatchObject({ charged_xaf: 150, status: 'pending', user_id: u.id });
    const { data: pay } = await db.from('payments').select('*').eq('id', payment.id).single();
    expect(pay).toMatchObject({ credited_xaf: 10000, user_id: u.id });
    expect((await wallet(u.id)).balance_xaf).toBe(1000);
  });

  it('un second appel est sans effet et sans erreur', async () => {
    const { u } = await fullClient();
    await anonymize(u.id);
    const { data: before } = await db.from('profiles').select('*').eq('id', u.id).single();
    const { error } = await anonymize(u.id);
    expect(error).toBeNull();
    const { data: after } = await db.from('profiles').select('*').eq('id', u.id).single();
    expect(after!.deleted_at).toBe(before!.deleted_at);
    expect(after!.status).toBe('deleted');
  });

  it('libère email et téléphone pour un nouveau compte', async () => {
    const { u } = await fullClient();
    await anonymize(u.id);
    const again = await makeUser({ email: u.email, phone: u.phone });
    created.push(again.id);
    const { data } = await db.from('profiles').select('email, phone').eq('id', again.id).single();
    expect(data).toMatchObject({ email: u.email, phone: u.phone });
  });

  it('un client authentifié ne peut pas appeler anonymize_user (permission denied)', async () => {
    const { u } = await fullClient();
    const c = await userClient(u.id);
    const { error } = await c.rpc('anonymize_user', { p_user: u.id });
    expect(error?.message).toMatch(/permission denied/i);
    const { data: p } = await db.from('profiles').select('status').eq('id', u.id).single();
    expect(p!.status).toBe('active');
  });
});
