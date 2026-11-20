import 'server-only';
import type { z } from 'zod';
import type { listTicketsQuerySchema } from '@/server/schemas/admin-tickets';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { decodeCursor, encodeCursor, keysetFilter } from '@/server/orders/list-orders';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ATTACHMENT_BUCKET = 'ticket-attachments';
const SIGNED_URL_SECONDS = 600;
const COLUMNS = 'id, user_id, subject, status, order_id, created_at, updated_at';
type Query = z.infer<typeof listTicketsQuerySchema>;

export async function listAdminTickets(query: Query) {
  let req = createAdminClient()
    .from('tickets')
    .select(COLUMNS)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(query.limit + 1);
  if (query.status) req = req.eq('status', query.status);
  if (query.cursor) req = req.or(keysetFilter(decodeCursor(query.cursor), 'updated_at'));
  const { data, error } = await req;
  if (error) throw new Error('admin_tickets_list_failed');
  const page = data.slice(0, query.limit);
  const last = page[page.length - 1];
  return {
    items: page,
    next_cursor:
      data.length > query.limit && last
        ? encodeCursor({ created_at: last.updated_at, id: last.id })
        : null,
  };
}

/** Fiche : ticket, messages et pièces jointes (liens signés de 10 min, le bucket reste privé). */
export async function getAdminTicket(id: string) {
  if (!UUID.test(id)) return apiError('TICKET_NOT_FOUND');
  const db = createAdminClient();
  const { data: ticket, error } = await db
    .from('tickets')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('admin_ticket_failed');
  if (!ticket) return apiError('TICKET_NOT_FOUND');
  const { data: messages, error: mErr } = await db
    .from('ticket_messages')
    .select('id, from_admin, body, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (mErr) throw new Error('admin_ticket_messages_failed');
  const byMessage = new Map<string, { id: string; url: string }[]>();
  if (messages.length > 0) {
    const { data: atts, error: aErr } = await db
      .from('ticket_attachments')
      .select('id, message_id, storage_path')
      .in(
        'message_id',
        messages.map((m) => m.id),
      );
    if (aErr) throw new Error('admin_ticket_attachments_failed');
    if (atts.length > 0) {
      const { data: signed, error: sErr } = await db.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrls(
          atts.map((a) => a.storage_path),
          SIGNED_URL_SECONDS,
        );
      if (sErr) throw new Error('admin_ticket_sign_failed');
      atts.forEach((a, i) => {
        const url = signed[i]?.signedUrl;
        if (!url) return;
        byMessage.set(a.message_id, [...(byMessage.get(a.message_id) ?? []), { id: a.id, url }]);
      });
    }
  }
  return {
    ticket,
    messages: messages.map((m) => ({
      id: m.id,
      from_admin: m.from_admin,
      body: m.body ?? '',
      attachments: byMessage.get(m.id) ?? [],
      created_at: m.created_at,
    })),
  };
}

function mapTicketError(message: string): never {
  if (message.includes('TICKET_NOT_FOUND')) return apiError('TICKET_NOT_FOUND');
  if (message.includes('INVALID_BODY') || message.includes('INVALID_STATUS')) {
    return apiError('VALIDATION_ERROR');
  }
  if (message.includes('NOT_ADMIN')) return apiError('NOT_ADMIN');
  throw new Error('admin_ticket_action_failed');
}

/** Réponse, passage en « answered » et trace : une seule fonction SQL, donc atomique. */
export async function replyTicket(adminId: string, id: string, body: string) {
  if (!UUID.test(id)) return apiError('TICKET_NOT_FOUND');
  const { data, error } = await createAdminClient().rpc('reply_ticket', {
    p_ticket: id,
    p_body: body,
    p_admin: adminId,
  });
  if (error) return mapTicketError(error.message);
  return { id: data };
}

export async function setTicketStatus(adminId: string, id: string, status: 'open' | 'closed') {
  if (!UUID.test(id)) return apiError('TICKET_NOT_FOUND');
  const { data, error } = await createAdminClient().rpc('update_ticket', {
    p_ticket: id,
    p_status: status,
    p_admin: adminId,
  });
  if (error) return mapTicketError(error.message);
  return { ticket: data };
}
