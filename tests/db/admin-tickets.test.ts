import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import { ROUTES, auditRows, callRoute, failAuditFor } from '../helpers/admin-phase12';
import type { ErrorBody } from '../helpers/client-area-db';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import {
  cleanupTickets,
  makeTicket,
  makeTicketMessage,
  messagesOf,
  ticketOf,
} from '../helpers/tickets-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Tickets côté admin (phase 12, « Mes choix »).
 *   GET   /admin/tickets?status=            -> { items, next_cursor }
 *   POST  /admin/tickets/{id}/messages { body } -> 201 ; message from_admin = true, ticket « answered »
 *   PATCH /admin/tickets/{id} { status: 'open' | 'closed' } -> 200 (fermeture / réouverture)
 * La réponse remet à zéro la limite de 3 messages d'affilée du client (règle de base, phase 11).
 * Audit : `reply_ticket` (target_id = id du ticket) et `update_ticket`, atomiques avec le changement.
 */
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const code = async (r: Response) => ((await r.json()) as ErrorBody).error.code;
const reply = (id: string, body: unknown) =>
  callRoute(ROUTES.ticketMessages, 'POST', `/api/v1/admin/tickets/${id}/messages`, { body, id });
const setStatus = (id: string, body: unknown) =>
  callRoute(ROUTES.ticket, 'PATCH', `/api/v1/admin/tickets/${id}`, { body, id });

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => admin.release());
beforeEach(() => {
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  await cleanupTickets(created);
  await cleanupUsers(created);
});

async function openTicket() {
  const u = await makeFundedUser(created);
  const t = await makeTicket(u.id);
  await makeTicketMessage(t.id);
  return { u, t };
}

describe('GET /admin/tickets', () => {
  it('liste les tickets et filtre par statut', async () => {
    const { t } = await openTicket();
    const res = await callRoute(
      ROUTES.tickets,
      'GET',
      '/api/v1/admin/tickets?status=open&limit=100',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { id: string; status: string }[] };
    expect(body.items.some((i) => i.id === t.id)).toBe(true);
    expect(body.items.every((i) => i.status === 'open')).toBe(true);
  });

  it('statut inconnu : 400', async () => {
    expect(
      (await callRoute(ROUTES.tickets, 'GET', '/api/v1/admin/tickets?status=nimporte')).status,
    ).toBe(400);
  });
});

describe('POST /admin/tickets/{id}/messages : réponse du propriétaire', () => {
  it('enregistre la réponse (from_admin), passe le ticket en « answered », trace écrite', async () => {
    const { t } = await openTicket();
    const res = await reply(t.id, { body: 'Bonjour, votre commande est remboursée.' });
    expect(res.status).toBe(201);
    const msgs = await messagesOf(t.id);
    expect(msgs[msgs.length - 1]).toMatchObject({
      from_admin: true,
      body: 'Bonjour, votre commande est remboursée.',
    });
    expect((await ticketOf(t.id)).status).toBe('answered');
    expect(await auditRows('reply_ticket', t.id)).toHaveLength(1);
  });

  it('la réponse remet à zéro la limite de 3 messages d’affilée du client', async () => {
    const { u, t } = await openTicket(); // 1 message client
    await makeTicketMessage(t.id);
    await makeTicketMessage(t.id); // 3 messages d'affilée
    const blocked = await adminClient()
      .from('ticket_messages')
      .insert({ ticket_id: t.id, from_admin: false, body: 'Quatrième' });
    expect(blocked.error?.message).toContain('MESSAGE_LIMIT_REACHED');
    expect((await reply(t.id, { body: 'Je regarde, merci.' })).status).toBe(201);
    const after = await adminClient()
      .from('ticket_messages')
      .insert({ ticket_id: t.id, from_admin: false, body: 'Merci' });
    expect(after.error).toBeNull();
    expect(u.id).toBeTruthy();
  });

  it.each([{}, { body: '' }, { body: '   ' }, { body: 'x'.repeat(5001) }])(
    'corps invalide %j : 400 VALIDATION_ERROR, aucun message écrit',
    async (body) => {
      const { t } = await openTicket();
      const res = await reply(t.id, body);
      expect(res.status).toBe(400);
      expect(await code(res)).toBe('VALIDATION_ERROR');
      expect(await messagesOf(t.id)).toHaveLength(1);
    },
  );

  it('ticket inconnu : 404', async () => {
    expect((await reply(randomUUID(), { body: 'Bonjour' })).status).toBe(404);
  });

  it('atomique : si la trace échoue, aucun message n’est enregistré', async () => {
    const { t } = await openTicket();
    const restore = failAuditFor(['reply_ticket']);
    try {
      expect((await reply(t.id, { body: 'Bonjour' })).status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    expect(await messagesOf(t.id)).toHaveLength(1);
    expect((await ticketOf(t.id)).status).toBe('open');
  });
});

describe('PATCH /admin/tickets/{id} : fermer et rouvrir', () => {
  it('ferme puis rouvre un ticket, une trace par changement', async () => {
    const { t } = await openTicket();
    expect((await setStatus(t.id, { status: 'closed' })).status).toBe(200);
    expect((await ticketOf(t.id)).status).toBe('closed');
    expect((await setStatus(t.id, { status: 'open' })).status).toBe(200);
    expect((await ticketOf(t.id)).status).toBe('open');
    const rows = await auditRows('update_ticket', t.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.details).toMatchObject({ old: 'open', new: 'closed' });
  });

  it.each(['answered', 'deleted', '', null])('statut %j refusé : 400', async (status) => {
    const { t } = await openTicket();
    expect((await setStatus(t.id, { status })).status).toBe(400);
    expect((await ticketOf(t.id)).status).toBe('open');
  });

  it('ticket inconnu : 404', async () => {
    expect((await setStatus(randomUUID(), { status: 'closed' })).status).toBe(404);
  });

  it('atomique : si la trace échoue, le statut ne change pas', async () => {
    const { t } = await openTicket();
    const restore = failAuditFor(['update_ticket']);
    try {
      expect((await setStatus(t.id, { status: 'closed' })).status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    expect((await ticketOf(t.id)).status).toBe('open');
  });
});
