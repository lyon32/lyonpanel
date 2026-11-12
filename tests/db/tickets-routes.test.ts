import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { getReq, sendReq, type ErrorBody } from '../helpers/client-area-db';
import {
  TINY_PNG,
  cleanupTickets,
  imageFile,
  makeTicket,
  makeTicketMessage,
  messagesOf,
  ticketOf,
  ticketsOf,
  uploadReq,
} from '../helpers/tickets-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
const notify = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: notify.fn }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { GET as listRoute, POST as createRoute } from '@/app/api/v1/tickets/route';
import { POST as uploadRoute } from '@/app/api/v1/tickets/attachments/route';
import { GET as detailRoute, PATCH as patchRoute } from '@/app/api/v1/tickets/[id]/route';
import { POST as messageRoute } from '@/app/api/v1/tickets/[id]/messages/route';

/*
 * Routes attendues (API_SPEC §6.8, format d'erreur §3), fichiers sous src/app/api/v1/tickets/ :
 *   route.ts                 GET  -> 200 {items, next_cursor} (?limit=&cursor=) ; POST {subject, order_id?, body, attachment_ids?} -> 201 {id, short_id}
 *   attachments/route.ts     POST multipart « file » -> 201 {id} ; 422 FILE_TOO_LARGE / FILE_TYPE_NOT_ALLOWED ; 400 VALIDATION_ERROR si champ absent
 *   [id]/route.ts            GET  -> 200 {ticket, messages} ; PATCH {status:'closed'} -> 200 {ticket}
 *   [id]/messages/route.ts   POST {body, attachment_ids?} -> 201 {id}
 * Écritures : Origin = site (sinon 403 FORBIDDEN) ; non connecté : 401 UNAUTHENTICATED ; ticket d'un autre : 404 NOT_FOUND.
 * Réponses privées : cache-control « private, no-store ».
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
const idp = (id: string) => ({ params: Promise.resolve({ id }) });
const create = (body: unknown, headers: Record<string, string> = {}) =>
  createRoute(sendReq('POST', '/api/v1/tickets', body, headers));
const reply = (id: string, body: unknown) =>
  messageRoute(sendReq('POST', `/api/v1/tickets/${id}/messages`, body), idp(id));
const close = (id: string, body: unknown = { status: 'closed' }) =>
  patchRoute(sendReq('PATCH', `/api/v1/tickets/${id}`, body), idp(id));
const code = async (res: Response) => ((await res.json()) as ErrorBody).error.code;
const VALID = { subject: 'other', body: 'Bonjour' };

describe('accès', () => {
  it('refuse un visiteur non connecté sur chaque route (401 UNAUTHENTICATED)', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const results = await Promise.all([
      listRoute(getReq('/api/v1/tickets')),
      create(VALID),
      uploadRoute(uploadReq(imageFile())),
      detailRoute(getReq(`/api/v1/tickets/${id}`), idp(id)),
      close(id),
      reply(id, { body: 'x' }),
    ]);
    for (const res of results) {
      expect(res.status).toBe(401);
      expect(await code(res)).toBe('UNAUTHENTICATED');
    }
  });

  it('refuse une écriture venue d’un autre site (403 FORBIDDEN) sans rien créer', async () => {
    const u = await login();
    const res = await create(VALID, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(await code(res)).toBe('FORBIDDEN');
    expect(await ticketsOf(u.id)).toHaveLength(0);
  });
});

describe('POST /api/v1/tickets', () => {
  it('crée un ticket (201 {id, short_id}) et alerte le propriétaire', async () => {
    const u = await login();
    const res = await create({ subject: 'recharge', body: 'Ma recharge' });
    expect(res.status).toBe(201);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const json = await res.json();
    expect(json.short_id).toMatch(/^[0-9A-F]{8}$/);
    expect((await ticketOf(json.id)).user_id).toBe(u.id);
    expect(notify.fn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sujet libre', { subject: 'Mon sujet', body: 'x' }],
    ['message vide', { subject: 'other', body: '' }],
    ['message de 4 001 caractères', { subject: 'other', body: 'a'.repeat(4001) }],
    ['commande manquante', { subject: 'order', body: 'x' }],
    ['4 images', { ...VALID, attachment_ids: Array.from({ length: 4 }, () => randomUUID()) }],
  ])('refuse %s (400 VALIDATION_ERROR)', async (_n, payload) => {
    const u = await login();
    const res = await create(payload);
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
    expect(await ticketsOf(u.id)).toHaveLength(0);
  });

  it('ignore user_id, status et from_admin envoyés par le navigateur', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const res = await create({ ...VALID, user_id: other.id, status: 'closed', from_admin: true });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(await ticketOf(id)).toMatchObject({ user_id: u.id, status: 'open' });
    expect((await messagesOf(id))[0].from_admin).toBe(false);
  });

  it('le 4e ticket non fermé donne 429 RATE_LIMITED au format d’erreur commun', async () => {
    await login();
    for (let i = 0; i < 3; i++) expect((await create(VALID)).status).toBe(201);
    const res = await create(VALID);
    expect(res.status).toBe(429);
    const { error } = (await res.json()) as ErrorBody;
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.message.length).toBeGreaterThan(5);
    expect(error.request_id).toBeTruthy();
  });

  it('répond dans la langue demandée (EN) pour une erreur', async () => {
    await login();
    const res = await create({ subject: 'x', body: '' }, { 'accept-language': 'en' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorBody).error.message).toMatch(/[a-z]/i);
  });
});

describe('POST /api/v1/tickets/attachments', () => {
  it('accepte une image PNG (201 {id}) et la range dans le dossier du client', async () => {
    const u = await login();
    const res = await uploadRoute(uploadReq(imageFile()));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const { data } = await adminClient().storage.from('ticket-attachments').list(u.id);
    expect((data ?? []).some((f) => f.name.startsWith(id))).toBe(true);
  });

  it('refuse plus de 2 Mo (422 FILE_TOO_LARGE)', async () => {
    await login();
    const res = await uploadRoute(uploadReq(imageFile({ size: 2 * 1024 * 1024 + 1 })));
    expect(res.status).toBe(422);
    expect(await code(res)).toBe('FILE_TOO_LARGE');
  });

  it.each([
    [
      'un PDF',
      imageFile({
        name: 'a.pdf',
        type: 'application/pdf',
        bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46]),
      }),
    ],
    [
      'un GIF',
      imageFile({
        name: 'a.gif',
        type: 'image/gif',
        bytes: Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
      }),
    ],
    [
      'un PDF déguisé en PNG',
      imageFile({ bytes: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]) }),
    ],
  ])('refuse %s (422 FILE_TYPE_NOT_ALLOWED)', async (_n, file) => {
    await login();
    const res = await uploadRoute(uploadReq(file));
    expect(res.status).toBe(422);
    expect(await code(res)).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('refuse une requête sans fichier (400 VALIDATION_ERROR)', async () => {
    await login();
    const res = await uploadRoute(uploadReq(null));
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
  });

  it('l’image envoyée garde ses octets (aucune modification côté serveur)', async () => {
    const u = await login();
    const { id } = await (await uploadRoute(uploadReq(imageFile()))).json();
    const { data } = await adminClient()
      .storage.from('ticket-attachments')
      .download(`${u.id}/${id}.png`);
    expect(new Uint8Array(await data!.arrayBuffer())).toEqual(TINY_PNG);
  });
});

describe('GET /api/v1/tickets et /api/v1/tickets/{id}', () => {
  it('liste seulement les tickets du client connecté', async () => {
    const u = await login();
    const other = await makeFundedUser(created);
    const mine = await makeTicket(u.id);
    await makeTicket(other.id);
    const res = await listRoute(getReq('/api/v1/tickets'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
    const json = await res.json();
    expect(json.items.map((i: { id: string }) => i.id)).toEqual([mine.id]);
    expect(json.next_cursor).toBeNull();
  });

  it('refuse limit hors 1 à 50 (400 VALIDATION_ERROR)', async () => {
    await login();
    const res = await listRoute(getReq('/api/v1/tickets?limit=500'));
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
  });

  it('renvoie le détail avec les messages', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    await makeTicketMessage(t.id, { body: 'Bonjour' });
    await makeTicketMessage(t.id, { body: 'Salut', from_admin: true });
    const res = await detailRoute(getReq(`/api/v1/tickets/${t.id}`), idp(t.id));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ticket.id).toBe(t.id);
    expect(json.messages.map((m: { body: string }) => m.body)).toEqual(['Bonjour', 'Salut']);
  });

  it('ticket d’un autre client : 404 NOT_FOUND (pas 403, on ne confirme pas son existence)', async () => {
    await login();
    const other = await makeFundedUser(created);
    const t = await makeTicket(other.id);
    const res = await detailRoute(getReq(`/api/v1/tickets/${t.id}`), idp(t.id));
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('NOT_FOUND');
  });

  it('identifiant qui n’est pas un uuid : 404 NOT_FOUND, jamais 500', async () => {
    await login();
    const res = await detailRoute(getReq('/api/v1/tickets/abc'), idp('abc'));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/tickets/{id}/messages', () => {
  it('ajoute un message (201 {id})', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    const res = await reply(t.id, { body: 'Une précision' });
    expect(res.status).toBe(201);
    expect((await messagesOf(t.id)).map((m) => m.body)).toEqual(['Une précision']);
  });

  it('refuse un message vide (400) et le ticket d’un autre (404)', async () => {
    const u = await login();
    const own = await makeTicket(u.id);
    expect((await reply(own.id, { body: '' })).status).toBe(400);
    const other = await makeFundedUser(created);
    const theirs = await makeTicket(other.id);
    expect((await reply(theirs.id, { body: 'intrus' })).status).toBe(404);
    expect(await messagesOf(theirs.id)).toHaveLength(0);
  });

  it('rouvre un ticket fermé', async () => {
    const u = await login();
    const t = await makeTicket(u.id, { status: 'closed' });
    expect((await reply(t.id, { body: 'encore moi' })).status).toBe(201);
    expect((await ticketOf(t.id)).status).toBe('open');
  });
});

describe('PATCH /api/v1/tickets/{id}', () => {
  it('ferme le ticket (200 {ticket} avec status closed)', async () => {
    const u = await login();
    const t = await makeTicket(u.id);
    const res = await close(t.id);
    expect(res.status).toBe(200);
    expect((await res.json()).ticket.status).toBe('closed');
    expect((await ticketOf(t.id)).status).toBe('closed');
  });

  it.each([{ status: 'open' }, { status: 'answered' }, { subject: 'autre' }, {}])(
    'refuse %j (400) : le client ne peut que fermer',
    async (payload) => {
      const u = await login();
      const t = await makeTicket(u.id, { status: 'answered' });
      const res = await close(t.id, payload);
      expect(res.status).toBe(400);
      expect((await ticketOf(t.id)).status).toBe('answered');
    },
  );

  it('ticket d’un autre client : 404, statut inchangé', async () => {
    await login();
    const other = await makeFundedUser(created);
    const t = await makeTicket(other.id);
    expect((await close(t.id)).status).toBe(404);
    expect((await ticketOf(t.id)).status).toBe('open');
  });
});
