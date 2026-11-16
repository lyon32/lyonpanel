import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { cleanupTickets, makeTicket, makeTicketMessage, messagesOf } from '../helpers/tickets-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
const notify = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: notify.fn }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

import { addMessage, createTicket } from '@/server/tickets/tickets';

/*
 * Limite des messages (phase 11, décision 4e) : un client ne peut pas envoyer plus de 3 messages d'AFFILÉE
 * sans réponse du propriétaire, dans un même ticket (le message qui ouvre le ticket compte pour 1).
 * Quand le propriétaire répond (from_admin = true), le client peut de nouveau écrire 3 messages.
 * Règle en base (déclencheur sur ticket_messages, valable pour tout chemin d'écriture) :
 *   le 4e message client d'affilée échoue avec le message « MESSAGE_LIMIT_REACHED ».
 * Service : addMessage lève ApiError RATE_LIMITED (429) avec details.reason = 'unanswered_messages' ; rien n'est écrit.
 * Alertes Telegram : une par message accepté (3 au plus d'affilée), aucune pour un message refusé.
 */

const created: string[] = [];
const db = adminClient();
beforeEach(() => {
  session.client = null;
  notify.fn.mockClear();
});
afterEach(async () => {
  session.client = null;
  await cleanupTickets(created);
  await cleanupUsers(created);
});

const clientMsg = (ticketId: string, c: SupabaseClient = db) =>
  c.from('ticket_messages').insert({ ticket_id: ticketId, from_admin: false, body: 'Bonjour' });
const adminMsg = (ticketId: string) =>
  db.from('ticket_messages').insert({ ticket_id: ticketId, from_admin: true, body: 'Réponse' });

describe('limite de 3 messages d’affilée (base)', () => {
  it('3 messages passent, le 4e est refusé (MESSAGE_LIMIT_REACHED)', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    for (let i = 0; i < 3; i++) expect((await clientMsg(t.id)).error).toBeNull();
    const { error } = await clientMsg(t.id);
    expect(error?.message).toMatch(/MESSAGE_LIMIT_REACHED/);
    expect(await messagesOf(t.id)).toHaveLength(3);
  });

  it('la règle vaut aussi pour le client connecté (chemin RLS)', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    const c = await userClient(u.id);
    for (let i = 0; i < 3; i++) expect((await clientMsg(t.id, c)).error).toBeNull();
    expect((await clientMsg(t.id, c)).error?.message).toMatch(/MESSAGE_LIMIT_REACHED/);
  });

  it('une réponse du propriétaire remet le compteur à zéro : 3 nouveaux messages possibles', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    for (let i = 0; i < 3; i++) await clientMsg(t.id);
    expect((await adminMsg(t.id)).error).toBeNull();
    for (let i = 0; i < 3; i++) expect((await clientMsg(t.id)).error).toBeNull();
    expect((await clientMsg(t.id)).error?.message).toMatch(/MESSAGE_LIMIT_REACHED/);
    expect(await messagesOf(t.id)).toHaveLength(7);
  });

  it('séquence client, propriétaire, client, client, client : accepté ; le suivant est refusé', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    await clientMsg(t.id);
    await adminMsg(t.id);
    for (let i = 0; i < 3; i++) expect((await clientMsg(t.id)).error).toBeNull();
    expect((await clientMsg(t.id)).error).not.toBeNull();
  });

  it('les messages du propriétaire ne sont jamais limités', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    for (let i = 0; i < 6; i++) expect((await adminMsg(t.id)).error).toBeNull();
  });

  it('la limite est propre à chaque ticket', async () => {
    const u = await makeFundedUser(created);
    const a = await makeTicket(u.id);
    const b = await makeTicket(u.id);
    for (let i = 0; i < 3; i++) await clientMsg(a.id);
    expect((await clientMsg(a.id)).error).not.toBeNull();
    expect((await clientMsg(b.id)).error).toBeNull();
  });

  it('la limite est propre à chaque client', async () => {
    const u1 = await makeFundedUser(created);
    const u2 = await makeFundedUser(created);
    const t1 = await makeTicket(u1.id);
    const t2 = await makeTicket(u2.id);
    for (let i = 0; i < 3; i++) await clientMsg(t1.id);
    expect((await clientMsg(t2.id)).error).toBeNull();
  });

  it('un ticket fermé puis rouvert garde son compteur (pas de contournement par la fermeture)', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    for (let i = 0; i < 3; i++) await clientMsg(t.id);
    await db.from('tickets').update({ status: 'closed' }).eq('id', t.id);
    expect((await clientMsg(t.id)).error?.message).toMatch(/MESSAGE_LIMIT_REACHED/);
  });

  it('en parallèle : 6 messages simultanés, exactement 3 acceptés', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    const results = await Promise.all(Array.from({ length: 6 }, () => clientMsg(t.id)));
    expect(results.filter((r) => r.error === null)).toHaveLength(3);
    expect(await messagesOf(t.id)).toHaveLength(3);
  });
});

describe('limite de 3 messages d’affilée (service)', () => {
  async function login() {
    const u = await makeFundedUser(created);
    session.client = await userClient(u.id);
    return u;
  }

  it('ticket (message 1) + 2 messages passent, le 3e message est refusé : RATE_LIMITED, raison unanswered_messages', async () => {
    const u = await login();
    const { id } = await createTicket(u.id, { subject: 'other', body: 'Premier' });
    await addMessage(u.id, id, { body: 'Deuxième' });
    await addMessage(u.id, id, { body: 'Troisième' });
    await expect(addMessage(u.id, id, { body: 'Quatrième' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      details: { reason: 'unanswered_messages' },
    });
    expect(await messagesOf(id)).toHaveLength(3);
  });

  it('une alerte Telegram par message accepté (3), aucune pour le message refusé', async () => {
    const u = await login();
    const { id } = await createTicket(u.id, { subject: 'other', body: 'Premier' });
    await addMessage(u.id, id, { body: 'Deuxième' });
    await addMessage(u.id, id, { body: 'Troisième' });
    await addMessage(u.id, id, { body: 'Quatrième' }).catch(() => {});
    expect(notify.fn).toHaveBeenCalledTimes(3);
    const text = JSON.stringify(notify.fn.mock.calls);
    expect(text).not.toMatch(/Premier|Deuxième|Troisième|Quatrième/);
  });

  it('après la réponse du propriétaire, le client peut de nouveau écrire', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    await makeTicketMessage(t.id);
    await addMessage(u.id, t.id, { body: 'b' });
    await addMessage(u.id, t.id, { body: 'c' });
    await expect(addMessage(u.id, t.id, { body: 'd' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await adminMsg(t.id);
    await expect(addMessage(u.id, t.id, { body: 'e' })).resolves.toHaveProperty('id');
  });

  it('le message refusé ne rouvre ni ne modifie le ticket', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    for (let i = 0; i < 3; i++) await clientMsg(t.id);
    await db.from('tickets').update({ status: 'answered' }).eq('id', t.id);
    await addMessage(u.id, t.id, { body: 'trop' }).catch(() => {});
    const { data } = await db.from('tickets').select('status').eq('id', t.id).single();
    expect(data!.status).toBe('answered');
  });
});
