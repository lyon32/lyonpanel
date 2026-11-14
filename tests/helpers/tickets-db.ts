import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { adminClient } from '../db/helpers/client';
import { ORIGIN } from './client-area-db';

/* Aides communes des tests du support (phase 9) : vraie base locale, aucun réseau. */

export const BUCKET = 'ticket-attachments';

// PNG 1x1 valide (octets réels : la vérification du contenu, pas seulement du type annoncé).
export const TINY_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  ),
);

/** Faux fichier : `bytes` = contenu réel, `type` = type annoncé par le navigateur. */
export function imageFile(
  over: { name?: string; type?: string; bytes?: Uint8Array; size?: number } = {},
): File {
  const base = over.bytes ?? TINY_PNG;
  const bytes = over.size ? new Uint8Array(over.size).fill(0) : base;
  if (over.size) bytes.set(base.slice(0, Math.min(base.length, over.size)));
  return new File([new Uint8Array(bytes).buffer], over.name ?? 'capture.png', {
    type: over.type ?? 'image/png',
  });
}

export function uploadReq(file: File | null, field = 'file'): NextRequest {
  const form = new FormData();
  if (file) form.append(field, file);
  return new NextRequest(`${ORIGIN}/api/v1/tickets/attachments`, {
    method: 'POST',
    headers: { origin: ORIGIN },
    body: form,
  });
}

export async function makeTicket(
  userId: string,
  over: Record<string, unknown> = {},
): Promise<{ id: string; status: string; subject: string; user_id: string }> {
  const { data, error } = await adminClient()
    .from('tickets')
    .insert({ user_id: userId, subject: 'other', status: 'open', ...over })
    .select()
    .single();
  if (error || !data) throw new Error(`makeTicket a échoué : ${error?.message}`);
  return data as { id: string; status: string; subject: string; user_id: string };
}

export async function makeTicketMessage(
  ticketId: string,
  over: Record<string, unknown> = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient()
    .from('ticket_messages')
    .insert({ ticket_id: ticketId, body: 'Bonjour', from_admin: false, ...over })
    .select('id')
    .single();
  if (error || !data) throw new Error(`makeTicketMessage a échoué : ${error?.message}`);
  return data as { id: string };
}

/** Dépose un vrai fichier dans le bucket privé (comme le ferait le serveur) et renvoie son chemin. */
export async function putObject(userId: string, bytes: Uint8Array = TINY_PNG): Promise<string> {
  const path = `${userId}/${randomUUID()}.png`;
  const { error } = await adminClient()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: 'image/png' });
  if (error) throw new Error(`putObject a échoué : ${error.message}`);
  return path;
}

export async function makeAttachment(
  messageId: string,
  storagePath: string,
): Promise<{ id: string }> {
  const { data, error } = await adminClient()
    .from('ticket_attachments')
    .insert({
      message_id: messageId,
      storage_path: storagePath,
      mime: 'image/png',
      size_bytes: TINY_PNG.length,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`makeAttachment a échoué : ${error?.message}`);
  return data as { id: string };
}

export async function ticketOf(id: string): Promise<{ status: string } & Record<string, unknown>> {
  const { data } = await adminClient().from('tickets').select('*').eq('id', id).single();
  return data as { status: string } & Record<string, unknown>;
}

export async function ticketsOf(userId: string): Promise<Record<string, unknown>[]> {
  const { data } = await adminClient().from('tickets').select('*').eq('user_id', userId);
  return (data ?? []) as Record<string, unknown>[];
}

export async function messagesOf(ticketId: string): Promise<Record<string, unknown>[]> {
  const { data } = await adminClient()
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at');
  return (data ?? []) as Record<string, unknown>[];
}

/** Supprime tickets, messages, pièces jointes et fichiers des clients de test (avant removeUser). */
export async function cleanupTickets(userIds: string[]): Promise<void> {
  const db = adminClient();
  for (const userId of userIds) {
    const { data: tickets } = await db.from('tickets').select('id').eq('user_id', userId);
    const ids = (tickets ?? []).map((t) => t.id as string);
    if (ids.length) {
      const { data: msgs } = await db.from('ticket_messages').select('id').in('ticket_id', ids);
      const msgIds = (msgs ?? []).map((m) => m.id as string);
      if (msgIds.length) await db.from('ticket_attachments').delete().in('message_id', msgIds);
      await db.from('ticket_messages').delete().in('ticket_id', ids);
      await db.from('tickets').delete().in('id', ids);
    }
    const { data: files } = await db.storage.from(BUCKET).list(userId);
    if (files?.length) {
      await db.storage.from(BUCKET).remove(files.map((f) => `${userId}/${f.name}`));
    }
  }
}
