import 'server-only';
import { ATTACHMENT_BUCKET } from './attachments';
import { consumeAction } from './upload-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';
import { apiError } from '@/server/http/api-error';
import { decodeCursor, encodeCursor, keysetFilter } from '@/server/orders/list-orders';
import { notifyOwner } from '@/server/providers/telegram';
import type {
  CreateTicketInput,
  ListTicketsQuery,
  TicketMessageInput,
} from '@/server/schemas/ticket';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 600;

export type TicketSummary = {
  id: string;
  subject: string;
  status: 'open' | 'answered' | 'closed';
  order_short_id: string | null;
  updated_at: string;
};

// Selon les types générés, la commande liée est un objet ou une liste d'un élément.
function orderShortId(
  orders: { short_id: string | number } | { short_id: string | number }[] | null,
) {
  const order = Array.isArray(orders) ? orders[0] : orders;
  return order ? String(order.short_id) : null;
}

/** Numéro court affiché au client et dans l'alerte : 8 premiers caractères de l'uuid. */
export function shortTicketId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** Alerte sans texte, email ni téléphone ; une alerte qui échoue ne bloque rien. */
async function alertOwner(id: string, subject: string, reply?: true): Promise<void> {
  try {
    await notifyOwner('new_ticket', {
      ticket: shortTicketId(id),
      subject,
      ...(reply ? { reply } : {}),
    });
  } catch {
    // Volontairement muet : le ticket est déjà enregistré.
  }
}

type FoundFile = { path: string; mime: string; size: number };

/** Retrouve les images du client (dossier `<userId>/`) non encore rattachées ; sinon NOT_FOUND. */
async function findAttachments(userId: string, ids: string[]): Promise<FoundFile[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const files: FoundFile[] = [];
  for (const id of ids) {
    const { data, error } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .list(userId, { search: id, limit: 5 });
    if (error) throw new Error(`pièce jointe: ${error.message}`);
    const hit = data.find((f) => f.name.startsWith(`${id}.`));
    const meta = (hit?.metadata ?? {}) as { size?: number; mimetype?: string };
    if (!hit || typeof meta.size !== 'number' || typeof meta.mimetype !== 'string') {
      return apiError('NOT_FOUND');
    }
    files.push({ path: `${userId}/${hit.name}`, mime: meta.mimetype, size: meta.size });
  }
  const { data: used, error } = await admin
    .from('ticket_attachments')
    .select('id')
    .in(
      'storage_path',
      files.map((f) => f.path),
    )
    .limit(1);
  if (error) throw new Error(`pièce jointe: ${error.message}`);
  if (used.length > 0) apiError('NOT_FOUND');
  return files;
}

async function insertMessage(
  ticketId: string,
  body: string,
  files: FoundFile[],
): Promise<{ id: string }> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('ticket_messages')
    .insert({ ticket_id: ticketId, body, from_admin: false })
    .select('id')
    .single();
  if (error) throw new Error(`ticket_messages: ${error.message}`);
  if (files.length > 0) {
    const { error: attError } = await supabase.from('ticket_attachments').insert(
      files.map((f) => ({
        message_id: data.id,
        storage_path: f.path,
        mime: f.mime,
        size_bytes: f.size,
      })),
    );
    if (attError) {
      // Index unique sur storage_path : la même image envoyée deux fois en parallèle.
      if (attError.code === '23505') apiError('NOT_FOUND');
      throw new Error(`ticket_attachments: ${attError.message}`);
    }
  }
  return { id: data.id };
}

export async function createTicket(
  userId: string,
  input: CreateTicketInput,
): Promise<{ id: string; short_id: string }> {
  await consumeAction(userId);
  const files = await findAttachments(userId, input.attachment_ids ?? []);
  const supabase = await createSessionClient();
  if (input.order_id) {
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('id', input.order_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) apiError('ORDER_NOT_FOUND');
  }
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({ user_id: userId, subject: input.subject, order_id: input.order_id ?? null })
    .select('id')
    .single();
  if (error) {
    if (error.message.includes('TICKET_LIMIT_REACHED')) {
      apiError('RATE_LIMITED', { reason: 'open_tickets' });
    }
    throw new Error(`tickets: ${error.message}`);
  }
  try {
    await insertMessage(ticket.id, input.body, files);
  } catch (e) {
    // Un ticket vide ne doit pas occuper une des 3 places du client.
    await createAdminClient().from('tickets').delete().eq('id', ticket.id).eq('user_id', userId);
    throw e;
  }
  await alertOwner(ticket.id, input.subject);
  return { id: ticket.id, short_id: shortTicketId(ticket.id) };
}

export async function listTickets(
  userId: string,
  q: Partial<Pick<ListTicketsQuery, 'cursor' | 'limit'>>,
): Promise<{ items: TicketSummary[]; next_cursor: string | null }> {
  const limit = q.limit ?? 20;
  const supabase = await createSessionClient();
  let query = supabase
    .from('tickets')
    .select('id, subject, status, updated_at, orders(short_id)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (q.cursor) {
    // Date et uuid déjà validés par decodeCursor : rien de libre n'entre dans le filtre.
    query = query.or(keysetFilter(decodeCursor(q.cursor), 'updated_at'));
  }
  const { data, error } = await query;
  if (error) throw new Error(`tickets: ${error.message}`);
  const page = data.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      order_short_id: orderShortId(t.orders),
      updated_at: t.updated_at,
    })),
    next_cursor:
      data.length > limit && last
        ? encodeCursor({ created_at: last.updated_at, id: last.id })
        : null,
  };
}

async function loadOwnTicket(userId: string, id: string) {
  if (!UUID.test(id)) apiError('NOT_FOUND');
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from('tickets')
    .select('id, subject, status, created_at, updated_at, orders(short_id)')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`tickets: ${error.message}`);
  if (!data) apiError('NOT_FOUND');
  return data;
}

function toDetail(t: Awaited<ReturnType<typeof loadOwnTicket>>) {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    order_short_id: orderShortId(t.orders),
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

export async function getTicket(userId: string, id: string) {
  const ticket = await loadOwnTicket(userId, id);
  const supabase = await createSessionClient();
  const { data: messages, error } = await supabase
    .from('ticket_messages')
    .select('id, from_admin, body, created_at')
    .eq('ticket_id', ticket.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) throw new Error(`ticket_messages: ${error.message}`);
  const ids = messages.map((m) => m.id);
  const byMessage = new Map<string, { id: string; url: string }[]>();
  if (ids.length > 0) {
    const { data: atts, error: attError } = await supabase
      .from('ticket_attachments')
      .select('id, message_id, storage_path')
      .in('message_id', ids)
      .order('created_at', { ascending: true });
    if (attError) {
      // Index unique sur storage_path : la même image envoyée deux fois en parallèle.
      if (attError.code === '23505') apiError('NOT_FOUND');
      throw new Error(`ticket_attachments: ${attError.message}`);
    }
    if (atts.length > 0) {
      // Liens signés de 10 min : le bucket reste privé, le chemin ne quitte jamais le serveur.
      const { data: signed, error: signError } = await createAdminClient()
        .storage.from(ATTACHMENT_BUCKET)
        .createSignedUrls(
          atts.map((a) => a.storage_path),
          SIGNED_URL_SECONDS,
        );
      if (signError) throw new Error(`pièce jointe: ${signError.message}`);
      atts.forEach((a, i) => {
        const url = signed[i]?.signedUrl;
        if (!url) return;
        byMessage.set(a.message_id, [...(byMessage.get(a.message_id) ?? []), { id: a.id, url }]);
      });
    }
  }
  return {
    ticket: toDetail(ticket),
    messages: messages.map((m) => ({
      id: m.id,
      from_admin: m.from_admin,
      body: m.body ?? '',
      attachments: byMessage.get(m.id) ?? [],
      created_at: m.created_at,
    })),
  };
}

export async function addMessage(
  userId: string,
  ticketId: string,
  input: TicketMessageInput,
): Promise<{ id: string }> {
  // La réouverture d'un ticket fermé n'est pas freinée par la limite de 3 : seul le plafond horaire joue.
  const ticket = await loadOwnTicket(userId, ticketId);
  await consumeAction(userId);
  const files = await findAttachments(userId, input.attachment_ids ?? []);
  const message = await insertMessage(ticket.id, input.body, files);
  await alertOwner(ticket.id, ticket.subject, true);
  return message;
}

/** Fermeture faite par le serveur (le client n'a pas le droit d'écrire sur tickets) ; idempotente. */
export async function closeTicket(userId: string, ticketId: string): Promise<void> {
  const ticket = await loadOwnTicket(userId, ticketId);
  if (ticket.status === 'closed') return;
  const { error } = await createAdminClient()
    .from('tickets')
    .update({ status: 'closed' })
    .eq('id', ticket.id)
    .eq('user_id', userId);
  if (error) throw new Error(`tickets: ${error.message}`);
}
