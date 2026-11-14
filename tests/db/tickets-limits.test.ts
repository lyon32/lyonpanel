import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { cleanupTickets, makeTicket, makeTicketMessage, ticketOf } from '../helpers/tickets-db';
import { adminClient, userClient } from './helpers/client';

/*
 * Règles en base (migration 9.2, nouveau fichier supabase/migrations/20261112…_tickets_support.sql) :
 *  - 3 tickets non fermés (open ou answered) par client au plus : un 4e INSERT échoue avec le message « TICKET_LIMIT_REACHED » ;
 *  - un message du client (from_admin = false) dans un ticket « closed » ou « answered » remet le ticket à « open » ;
 *  - un message de l'équipe (from_admin = true) dans un ticket « open » le passe à « answered » ;
 *  - updated_at suit le dernier message (le tri de la liste en dépend).
 * Ces règles valent quel que soit le chemin d'écriture (client connecté ou clé de service).
 */

const created: string[] = [];
afterEach(async () => {
  await cleanupTickets(created);
  await cleanupUsers(created);
});

describe('limite de 3 tickets non fermés', () => {
  it('le 4e ticket d’un client est refusé par la base (TICKET_LIMIT_REACHED)', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    for (let i = 0; i < 3; i++) {
      expect(
        (await c.from('tickets').insert({ user_id: u.id, subject: 'other' })).error,
      ).toBeNull();
    }
    const { error } = await c.from('tickets').insert({ user_id: u.id, subject: 'other' });
    expect(error?.message).toMatch(/TICKET_LIMIT_REACHED/);
    const { count } = await adminClient()
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id);
    expect(count).toBe(3);
  });

  it('les tickets fermés ne comptent pas', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    for (let i = 0; i < 5; i++) await makeTicket(u.id, { status: 'closed' });
    await makeTicket(u.id);
    await makeTicket(u.id);
    expect((await c.from('tickets').insert({ user_id: u.id, subject: 'other' })).error).toBeNull();
  });

  it('les tickets « answered » comptent', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    await makeTicket(u.id, { status: 'answered' });
    await makeTicket(u.id, { status: 'answered' });
    await makeTicket(u.id, { status: 'answered' });
    const { error } = await c.from('tickets').insert({ user_id: u.id, subject: 'other' });
    expect(error?.message).toMatch(/TICKET_LIMIT_REACHED/);
  });

  it('le plafond d’un client n’empêche pas un autre client', async () => {
    const a = await makeFundedUser(created);
    const b = await makeFundedUser(created);
    for (let i = 0; i < 3; i++) await makeTicket(a.id);
    const cb = await userClient(b.id);
    expect((await cb.from('tickets').insert({ user_id: b.id, subject: 'other' })).error).toBeNull();
  });

  it('en parallèle : 6 créations simultanées ne dépassent jamais 3 tickets non fermés', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    await Promise.all(
      Array.from({ length: 6 }, () =>
        c.from('tickets').insert({ user_id: u.id, subject: 'other' }),
      ),
    );
    const { count } = await adminClient()
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.id)
      .neq('status', 'closed');
    expect(count).toBe(3);
  });
});

describe('statut selon l’auteur du message', () => {
  it('message de l’équipe : un ticket ouvert passe à « answered »', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    await makeTicketMessage(t.id, { from_admin: true, body: 'Nous regardons' });
    expect((await ticketOf(t.id)).status).toBe('answered');
  });

  it('message du client : un ticket « answered » repasse à « open »', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    const t = await makeTicket(u.id, { status: 'answered' });
    const { error } = await c.from('ticket_messages').insert({ ticket_id: t.id, body: 'Merci' });
    expect(error).toBeNull();
    expect((await ticketOf(t.id)).status).toBe('open');
  });

  it('message du client : un ticket fermé est rouvert', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    const t = await makeTicket(u.id, { status: 'closed' });
    const { error } = await c
      .from('ticket_messages')
      .insert({ ticket_id: t.id, body: 'Encore un souci' });
    expect(error).toBeNull();
    expect((await ticketOf(t.id)).status).toBe('open');
  });

  it('message du client : un ticket ouvert reste « open »', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    const t = await makeTicket(u.id);
    await c.from('ticket_messages').insert({ ticket_id: t.id, body: 'Précision' });
    expect((await ticketOf(t.id)).status).toBe('open');
  });

  it('un nouveau message met à jour updated_at du ticket', async () => {
    const u = await makeFundedUser(created);
    const old = '2026-01-01T00:00:00.000Z';
    const t = await makeTicket(u.id, { updated_at: old, created_at: old });
    await makeTicketMessage(t.id);
    const after = (await ticketOf(t.id)).updated_at as string;
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(old));
  });
});
