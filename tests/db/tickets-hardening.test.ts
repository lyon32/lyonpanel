import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { ORIGIN, sendReq } from '../helpers/client-area-db';
import {
  cleanupTickets,
  imageFile,
  makeAttachment,
  makeTicket,
  makeTicketMessage,
  putObject,
  ticketsOf,
  uploadReq,
} from '../helpers/tickets-db';
import { userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { POST as createRoute } from '@/app/api/v1/tickets/route';
import { POST as uploadRoute } from '@/app/api/v1/tickets/attachments/route';

type Err = { error: { code: string; details?: { reason?: string } } };
const created: string[] = [];

beforeEach(() => {
  session.client = null;
});
afterEach(async () => {
  session.client = null;
  await cleanupTickets(created);
  await cleanupUsers(created);
});

async function login() {
  const u = await makeFundedUser(created);
  session.client = await userClient(u.id);
  return { u, real: session.client };
}

/** Enveloppe le client de session : `hook` peut remplacer l'insertion sur une table. */
function wrap(
  real: SupabaseClient,
  hook: (table: string, realInsert: () => PromiseLike<unknown>) => unknown,
) {
  session.client = new Proxy(real, {
    get(target, prop, recv) {
      if (prop !== 'from') return Reflect.get(target, prop, recv);
      return (table: string) => {
        const builder = target.from(table);
        return new Proxy(builder, {
          get(b, p, r) {
            if (p !== 'insert') return Reflect.get(b, p, r);
            return (...args: unknown[]) => {
              const realInsert = () =>
                (b.insert as (...a: unknown[]) => PromiseLike<unknown>)(...args);
              return hook(table, realInsert) ?? realInsert();
            };
          },
        });
      };
    },
  });
}

describe('POST /api/v1/tickets/attachments : limites', () => {
  it('le 21e envoi dans l’heure donne 429 RATE_LIMITED (reason upload)', async () => {
    await login();
    for (let i = 0; i < 20; i++)
      expect((await uploadRoute(uploadReq(imageFile()))).status).toBe(201);
    const res = await uploadRoute(uploadReq(imageFile()));
    expect(res.status).toBe(429);
    const body = (await res.json()) as Err;
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.details?.reason).toBe('upload');
  });

  it('refuse FILE_TOO_LARGE sur content-length > 2 Mo + 64 Ko sans lire le corps', async () => {
    await login();
    const req = new NextRequest(`${ORIGIN}/api/v1/tickets/attachments`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-length': String(2 * 1024 * 1024 + 64 * 1024 + 1) },
      body: new FormData(),
    });
    const spy = vi.spyOn(req, 'formData');
    const res = await uploadRoute(req);
    expect(res.status).toBe(422);
    expect(((await res.json()) as Err).error.code).toBe('FILE_TOO_LARGE');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('createTicket : échecs après création', () => {
  it('si l’insertion du message échoue, le ticket est supprimé et ne compte pas dans les 3', async () => {
    const { u, real } = await login();
    for (let i = 0; i < 2; i++) await makeTicket(u.id);
    const failed = { data: null, error: { message: 'boom' } };
    wrap(real, (t) =>
      t === 'ticket_messages' ? { select: () => ({ single: async () => failed }) } : null,
    );
    const res = await createRoute(
      sendReq('POST', '/api/v1/tickets', { subject: 'other', body: 'Salut' }),
    );
    expect(res.status).toBe(500);
    expect(await ticketsOf(u.id)).toHaveLength(2);
    session.client = real;
    const ok = await createRoute(
      sendReq('POST', '/api/v1/tickets', { subject: 'other', body: 'Salut' }),
    );
    expect(ok.status).toBe(201);
  });

  it('une image déjà rattachée (23505) donne une erreur au format commun, jamais 500', async () => {
    const { u, real } = await login();
    const path = await putObject(u.id);
    const id = path.split('/')[1]!.replace('.png', '');
    const other = await makeTicket(u.id);
    const msg = await makeTicketMessage(other.id);
    // Course simulée : l'image est prise par un autre message juste avant l'insertion.
    wrap(real, (t, realInsert) =>
      t === 'ticket_attachments'
        ? {
            then: (ok: never, ko: never) =>
              makeAttachment(msg.id, path)
                .then(async () => await realInsert())
                .then(ok, ko),
          }
        : null,
    );
    const res = await createRoute(
      sendReq('POST', '/api/v1/tickets', { subject: 'other', body: 'Salut', attachment_ids: [id] }),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as Err).error.code).toBe('NOT_FOUND');
    // Le ticket créé par la requête est supprimé : il ne reste que le ticket préexistant.
    expect(await ticketsOf(u.id)).toHaveLength(1);
  });
});
