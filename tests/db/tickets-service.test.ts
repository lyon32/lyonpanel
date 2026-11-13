import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { must } from '../helpers/must';
import { makeOrder } from '../factories/order';
import { cleanupUsers, makeFollowersService, makeFundedUser } from '../helpers/orders-db';
import {
  cleanupTickets,
  imageFile,
  makeTicket,
  makeTicketMessage,
  messagesOf,
  ticketOf,
  ticketsOf,
} from '../helpers/tickets-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
const notify = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: notify.fn }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () => session.client,
}));

import { uploadAttachment } from '@/server/tickets/attachments';
import {
  addMessage,
  closeTicket,
  createTicket,
  getTicket,
  listTickets,
  shortTicketId,
} from '@/server/tickets/tickets';

/*
 * Service attendu (src/server/tickets/tickets.ts), userId = client connecté ; la RLS reste la dernière barrière :
 *   shortTicketId(id): string                                  8 premiers caractères de l'uuid, majuscules
 *   createTicket(userId, {subject, order_id?, body, attachment_ids?}): Promise<{id, short_id}>
 *   listTickets(userId, {cursor?, limit?}): Promise<{items: {id, subject, status, order_short_id, updated_at}[], next_cursor: string|null}>
 *        du plus récemment mis à jour au plus ancien ; limit défaut 20 ; curseur opaque
 *   getTicket(userId, id): Promise<{ticket: {id, subject, status, order_short_id, created_at, updated_at},
 *        messages: {id, from_admin, body, attachments: {id, url}[], created_at}[]}>   (URL signées 10 min ; autre client : 404 NOT_FOUND)
 *   addMessage(userId, ticketId, {body, attachment_ids?}): Promise<{id}>
 *   closeTicket(userId, ticketId): Promise<void>               (idempotent)
 * Erreurs : ApiError(code, status). Limites : 10 créations ou messages par heure (créer un ticket compte pour 1),
 *   3 tickets non fermés (open ou answered) : RATE_LIMITED (429), details.reason = 'rate' ou 'open_tickets'.
 * src/server/tickets/attachments.ts : uploadAttachment(userId, file: File): Promise<{id: string}>
 *   dépose le fichier dans le bucket sous `<userId>/<id>.<ext>` ; l'id sert d'attachment_ids.
 * Alerte : notifyOwner('new_ticket', { ticket: <n° court>, subject: <code du sujet>, reply?: true }) — rien d'autre.
 */

const created: string[] = [];
beforeEach(() => {
  session.client = null;
  notify.fn.mockClear();
});
afterEach(async () => {
  session.client = null;
  await cleanupTickets(created);
  await cleanupUsers(created);
});

async function login() {
  const u = await makeFundedUser(created);
  session.client = await userClient(u.id);
  return u;
}
const body = (text = 'Ma recharge n’apparaît pas') => ({ subject: 'other' as const, body: text });

describe('createTicket', () => {
  it('crée le ticket (ouvert, sujet = code) et son premier message', async () => {
    const u = await login();
    const { id, short_id } = await createTicket(u.id, { subject: 'recharge', body: 'Bonjour' });
    const t = await ticketOf(id);
    expect(t).toMatchObject({ user_id: u.id, subject: 'recharge', status: 'open', order_id: null });
    const msgs = await messagesOf(id);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ from_admin: false, body: 'Bonjour' });
    expect(short_id).toBe(shortTicketId(id));
    expect(short_id).toMatch(/^[0-9A-F]{8}$/);
  });

  it('garde le texte brut sans le modifier', async () => {
    const u = await login();
    const text = '<img src=x onerror=alert(1)> & "quotes"';
    const { id } = await createTicket(u.id, body(text));
    expect(must((await messagesOf(id))[0]).body).toBe(text);
  });

  it('lie le ticket à une commande du client', async () => {
    const u = await login();
    const order = await makeOrder(u.id, (await makeFollowersService()).id);
    const { id } = await createTicket(u.id, {
      subject: 'order',
      order_id: order.id,
      body: 'Rien reçu',
    });
    expect((await ticketOf(id)).order_id).toBe(order.id);
  });

  it('refuse la commande d’un autre client (ORDER_NOT_FOUND) et ne crée rien', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const order = await makeOrder(other.id, (await makeFollowersService()).id);
    await expect(
      createTicket(u.id, { subject: 'order', order_id: order.id, body: 'x' }),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', status: 404 });
    expect(await ticketsOf(u.id)).toHaveLength(0);
  });

  it('rattache les captures envoyées au premier message', async () => {
    const u = await login();
    const a = await uploadAttachment(u.id, imageFile({ name: 'a.png' }));
    const b = await uploadAttachment(u.id, imageFile({ name: 'b.png' }));
    const { id } = await createTicket(u.id, { ...body(), attachment_ids: [a.id, b.id] });
    const first = must((await messagesOf(id))[0]);
    const { data } = await adminClient()
      .from('ticket_attachments')
      .select('*')
      .eq('message_id', first.id as string);
    expect(data).toHaveLength(2);
    for (const row of data ?? []) {
      expect(row.storage_path).toMatch(new RegExp(`^${u.id}/.+\\.png$`));
      expect(row.mime).toBe('image/png');
      expect(row.size_bytes).toBeGreaterThan(0);
    }
  });

  it('refuse la capture d’un autre client (NOT_FOUND) : aucun ticket créé', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const theirs = await uploadAttachment(other.id, imageFile());
    await expect(
      createTicket(u.id, { ...body(), attachment_ids: [theirs.id] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(await ticketsOf(u.id)).toHaveLength(0);
  });

  it('refuse une capture déjà rattachée à un autre message', async () => {
    const u = await login();
    const a = await uploadAttachment(u.id, imageFile());
    await createTicket(u.id, { ...body(), attachment_ids: [a.id] });
    await expect(
      createTicket(u.id, { ...body('autre'), attachment_ids: [a.id] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuse un 4e ticket non fermé (RATE_LIMITED, raison open_tickets)', async () => {
    const u = await login();
    await createTicket(u.id, body('1'));
    await createTicket(u.id, body('2'));
    await createTicket(u.id, body('3'));
    await expect(createTicket(u.id, body('4'))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      details: { reason: 'open_tickets' },
    });
    expect(await ticketsOf(u.id)).toHaveLength(3);
  });

  it('un ticket fermé libère une place', async () => {
    const u = await login();
    const first = await createTicket(u.id, body('1'));
    await createTicket(u.id, body('2'));
    await createTicket(u.id, body('3'));
    await closeTicket(u.id, first.id);
    await expect(createTicket(u.id, body('4'))).resolves.toHaveProperty('id');
  });

  it('un ticket « answered » compte comme non fermé', async () => {
    const u = await login();
    await makeTicket(u.id, { status: 'answered' });
    await makeTicket(u.id, { status: 'answered' });
    await makeTicket(u.id, { status: 'open' });
    await expect(createTicket(u.id, body())).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('le plafond de 3 est propre à chaque client', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    for (let i = 0; i < 3; i++) await makeTicket(other.id);
    await expect(createTicket(u.id, body())).resolves.toHaveProperty('id');
  });

  it('plafonne à 10 actions par heure : 10 tickets créés puis fermés, le 11e est refusé', async () => {
    const u = await login();
    for (let i = 0; i < 10; i++) {
      const { id } = await createTicket(u.id, body(`n°${i}`));
      await closeTicket(u.id, id);
    }
    await expect(createTicket(u.id, body('onze'))).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      details: { reason: 'rate' },
    });
  });

  it('alerte Telegram : numéro court et sujet seulement, jamais le texte, l’email ni le téléphone', async () => {
    const u = await login();
    const secret = 'MOT-SECRET-DU-CLIENT-9876';
    const { id } = await createTicket(u.id, { subject: 'account', body: secret });
    expect(notify.fn).toHaveBeenCalledTimes(1);
    const [event, data] = notify.fn.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(event).toBe('new_ticket');
    expect(data).toEqual({ ticket: shortTicketId(id), subject: 'account' });
    const dump = JSON.stringify(notify.fn.mock.calls);
    for (const forbidden of [secret, u.email, u.phone, u.id]) expect(dump).not.toContain(forbidden);
  });

  it('une alerte qui échoue ne bloque pas la création', async () => {
    const u = await login();
    notify.fn.mockRejectedValueOnce(new Error('telegram down'));
    await expect(createTicket(u.id, body())).resolves.toHaveProperty('id');
    expect(await ticketsOf(u.id)).toHaveLength(1);
  });
});

describe('addMessage', () => {
  it('ajoute un message du client et le remet « ouvert » s’il était répondu', async () => {
    const u = await login();
    const t = await makeTicket(u.id, { status: 'answered' });
    await makeTicketMessage(t.id);
    const { id } = await addMessage(u.id, t.id, { body: 'Merci, mais toujours rien' });
    const msgs = await messagesOf(t.id);
    expect(msgs.find((m) => m.id === id)).toMatchObject({
      from_admin: false,
      body: 'Merci, mais toujours rien',
    });
    expect((await ticketOf(t.id)).status).toBe('open');
  });

  it('un message du client dans un ticket fermé le rouvre', async () => {
    const u = await login();
    const t = await makeTicket(u.id, { status: 'closed' });
    await makeTicketMessage(t.id);
    await addMessage(u.id, t.id, { body: 'Finalement, un autre souci' });
    expect((await ticketOf(t.id)).status).toBe('open');
  });

  it('refuse le ticket d’un autre client (NOT_FOUND) : rien n’est écrit', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const t = await makeTicket(other.id);
    await expect(addMessage(u.id, t.id, { body: 'intrus' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
    expect(await messagesOf(t.id)).toHaveLength(0);
  });

  it('ticket inexistant : NOT_FOUND', async () => {
    const u = await login();
    await expect(
      addMessage(u.id, '00000000-0000-4000-8000-000000000000', { body: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rattache jusqu’à 3 captures', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    const files = await Promise.all([1, 2, 3].map(() => uploadAttachment(u.id, imageFile())));
    const { id } = await addMessage(u.id, t.id, {
      body: 'trois captures',
      attachment_ids: files.map((f) => f.id),
    });
    const { data } = await adminClient()
      .from('ticket_attachments')
      .select('id')
      .eq('message_id', id);
    expect(data).toHaveLength(3);
  });

  it('alerte Telegram à chaque message du client, sans le texte', async () => {
    const u = await login();
    const t = await makeTicket(u.id, { subject: 'recharge' });
    await addMessage(u.id, t.id, { body: 'TEXTE-PRIVE-123' });
    expect(notify.fn).toHaveBeenCalledTimes(1);
    const [event, data] = notify.fn.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(event).toBe('new_ticket');
    expect(data).toEqual({ ticket: shortTicketId(t.id), subject: 'recharge', reply: true });
    expect(JSON.stringify(notify.fn.mock.calls)).not.toContain('TEXTE-PRIVE-123');
  });

  it('plafonne à 10 actions par heure : ticket (1) + 9 messages passent, le suivant est refusé', async () => {
    const u = await login();
    const { id } = await createTicket(u.id, body('premier'));
    for (let i = 0; i < 9; i++) await addMessage(u.id, id, { body: `m${i}` });
    await expect(addMessage(u.id, id, { body: 'trop' })).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      details: { reason: 'rate' },
    });
    expect(await messagesOf(id)).toHaveLength(10);
  });
});

describe('closeTicket', () => {
  it('ferme son ticket', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    await closeTicket(u.id, t.id);
    expect((await ticketOf(t.id)).status).toBe('closed');
  });

  it('est idempotent : fermer un ticket fermé ne fait pas d’erreur', async () => {
    const u = await login();
    const t = await makeTicket(u.id, { status: 'closed' });
    await expect(closeTicket(u.id, t.id)).resolves.toBeUndefined();
    expect((await ticketOf(t.id)).status).toBe('closed');
  });

  it('refuse le ticket d’un autre client (NOT_FOUND) : statut inchangé', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const t = await makeTicket(other.id);
    await expect(closeTicket(u.id, t.id)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect((await ticketOf(t.id)).status).toBe('open');
  });

  it('n’envoie aucune alerte Telegram', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    await closeTicket(u.id, t.id);
    expect(notify.fn).not.toHaveBeenCalled();
  });
});

describe('listTickets', () => {
  it('ne renvoie que les tickets du client, avec exactement les clés prévues', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const mine = await makeTicket(u.id, { subject: 'recharge' });
    await makeTicket(other.id);
    const { items, next_cursor } = await listTickets(u.id, {});
    expect(next_cursor).toBeNull();
    expect(items.map((i) => i.id)).toEqual([mine.id]);
    expect(Object.keys(must(items[0])).sort()).toEqual([
      'id',
      'order_short_id',
      'status',
      'subject',
      'updated_at',
    ]);
    expect(items[0]).toMatchObject({ subject: 'recharge', status: 'open', order_short_id: null });
  });

  it('donne le numéro court de la commande liée', async () => {
    const u = await login();
    const order = await makeOrder(u.id, (await makeFollowersService()).id);
    await makeTicket(u.id, { subject: 'order', order_id: order.id });
    const { items } = await listTickets(u.id, {});
    expect(String(must(items[0]).order_short_id)).toBe(String(order.short_id));
  });

  it('pagine par curseur : tout est vu une fois, du plus récent au plus ancien', async () => {
    const u = await login();
    const base = Date.parse('2026-11-01T10:00:00Z');
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const t = await makeTicket(u.id, {
        status: 'closed',
        created_at: new Date(base + i * 60_000).toISOString(),
        updated_at: new Date(base + i * 60_000).toISOString(),
      });
      ids.push(t.id);
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await listTickets(u.id, { limit: 2, ...(cursor ? { cursor } : {}) });
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((i) => i.id));
      cursor = page.next_cursor ?? undefined;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toEqual([...ids].reverse());
  });

  it('un curseur falsifié est refusé (VALIDATION_ERROR), jamais une erreur serveur', async () => {
    const u = await login();
    await expect(listTickets(u.id, { cursor: 'pas-un-curseur' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    });
  });
});

describe('getTicket', () => {
  it('renvoie le ticket et ses messages dans l’ordre, avec les captures en URL signées de 10 min', async () => {
    const u = await login();
    const { id } = await createTicket(u.id, {
      ...body('première'),
      attachment_ids: [(await uploadAttachment(u.id, imageFile())).id],
    });
    await makeTicketMessage(id, { from_admin: true, body: 'Réponse de l’équipe' });
    const res = await getTicket(u.id, id);
    expect(res.ticket).toMatchObject({ id, subject: 'other' });
    expect(res.messages.map((m) => [m.from_admin, m.body])).toEqual([
      [false, 'première'],
      [true, 'Réponse de l’équipe'],
    ]);
    expect(must(res.messages[0]).attachments).toHaveLength(1);
    const { id: attId, url } = must(must(res.messages[0]).attachments[0]);
    expect(attId).toBeTruthy();
    expect(url).toContain('ticket-attachments');
    const token = new URL(url).searchParams.get('token') ?? '';
    const claims = JSON.parse(Buffer.from(must(token.split('.')[1]), 'base64url').toString()) as {
      exp: number;
      iat?: number;
    };
    const ttl = claims.exp - (claims.iat ?? Math.floor(Date.now() / 1000));
    expect(ttl).toBeGreaterThanOrEqual(590);
    expect(ttl).toBeLessThanOrEqual(610);
  });

  it('l’URL signée donne vraiment l’image', async () => {
    const u = await login();
    const { id } = await createTicket(u.id, {
      ...body(),
      attachment_ids: [(await uploadAttachment(u.id, imageFile())).id],
    });
    const { url } = must(must((await getTicket(u.id, id)).messages[0]).attachments[0]);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/image\/png/);
  });

  it('n’expose ni chemin de stockage, ni user_id, ni clé interne', async () => {
    const u = await login();
    const { id } = await createTicket(u.id, {
      ...body(),
      attachment_ids: [(await uploadAttachment(u.id, imageFile())).id],
    });
    const dump = JSON.stringify(await getTicket(u.id, id));
    expect(dump).not.toContain('storage_path');
    expect(dump).not.toContain(`"user_id"`);
    expect(
      Object.keys(must(must((await getTicket(u.id, id)).messages[0]).attachments[0])).sort(),
    ).toEqual(['id', 'url']);
  });

  it('ticket d’un autre client ou inconnu : 404 NOT_FOUND', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const t = await makeTicket(other.id);
    await expect(getTicket(u.id, t.id)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
    await expect(getTicket(u.id, '00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
