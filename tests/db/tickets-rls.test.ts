import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it } from 'vitest';
import { must } from '../helpers/must';
import { makeOrder } from '../factories/order';
import { cleanupUsers, makeFollowersService, makeFundedUser } from '../helpers/orders-db';
import {
  BUCKET,
  TINY_PNG,
  cleanupTickets,
  makeAttachment,
  makeTicket,
  makeTicketMessage,
  messagesOf,
  putObject,
  ticketOf,
} from '../helpers/tickets-db';
import { adminClient, userClient } from './helpers/client';

/*
 * RLS et Storage du support (phase 9) : un client ne voit et n'écrit que ses propres lignes et fichiers.
 * Ces tests passent avec les politiques de la phase 1 ; ils verrouillent le comportement,
 * y compris après la migration 9.2 (qui ne doit rien ouvrir).
 */

const created: string[] = [];
afterEach(async () => {
  await cleanupTickets(created);
  await cleanupUsers(created);
});

async function pair() {
  const a = await makeFundedUser(created);
  const b = await makeFundedUser(created);
  return { a, b, ca: await userClient(a.id), cb: await userClient(b.id) };
}
const ownerOf = async (db: SupabaseClient, id: string) =>
  (await db.from('tickets').select('id').eq('id', id)).data ?? [];

describe('tickets : lecture', () => {
  it('chaque client ne voit que ses tickets, messages et pièces jointes', async () => {
    const { a, b, ca, cb } = await pair();
    const t = await makeTicket(a.id);
    const m = await makeTicketMessage(t.id);
    const att = await makeAttachment(m.id, await putObject(a.id));

    expect(await ownerOf(ca, t.id)).toHaveLength(1);
    expect((await ca.from('ticket_messages').select('id').eq('id', m.id)).data).toHaveLength(1);
    expect((await ca.from('ticket_attachments').select('id').eq('id', att.id)).data).toHaveLength(
      1,
    );

    expect(await ownerOf(cb, t.id)).toHaveLength(0);
    expect((await cb.from('ticket_messages').select('id').eq('id', m.id)).data).toHaveLength(0);
    expect((await cb.from('ticket_attachments').select('id').eq('id', att.id)).data).toHaveLength(
      0,
    );
    expect(b.id).not.toBe(a.id);
  });

  it('un visiteur anonyme ne lit rien', async () => {
    const { a } = await pair();
    const t = await makeTicket(a.id);
    const { createClient } = await import('@supabase/supabase-js');
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const res = await anon.from('tickets').select('id').eq('id', t.id);
    expect(res.data ?? []).toHaveLength(0);
  });
});

describe('tickets : écriture', () => {
  it('un client crée un ticket à son nom', async () => {
    const { a, ca } = await pair();
    const { error } = await ca.from('tickets').insert({ user_id: a.id, subject: 'other' });
    expect(error).toBeNull();
  });

  it('refuse de créer un ticket au nom d’un autre client', async () => {
    const { b, ca } = await pair();
    const { error } = await ca.from('tickets').insert({ user_id: b.id, subject: 'other' });
    expect(error).not.toBeNull();
  });

  it('refuse un ticket lié à la commande d’un autre client', async () => {
    const { a, b, ca } = await pair();
    const order = await makeOrder(b.id, (await makeFollowersService()).id);
    const { error } = await ca
      .from('tickets')
      .insert({ user_id: a.id, subject: 'order', order_id: order.id });
    expect(error).not.toBeNull();
  });

  it('accepte un ticket lié à sa propre commande', async () => {
    const { a, ca } = await pair();
    const order = await makeOrder(a.id, (await makeFollowersService()).id);
    const { error } = await ca
      .from('tickets')
      .insert({ user_id: a.id, subject: 'order', order_id: order.id });
    expect(error).toBeNull();
  });

  it('le client ne peut pas choisir le statut à la création (colonne non autorisée)', async () => {
    const { a, ca } = await pair();
    const { error } = await ca
      .from('tickets')
      .insert({ user_id: a.id, subject: 'other', status: 'answered' });
    expect(error).not.toBeNull();
  });

  it('le client ne peut ni mettre « answered » sur son ticket, ni toucher au ticket d’un autre', async () => {
    const { a, b, ca } = await pair();
    const own = await makeTicket(a.id);
    const theirs = await makeTicket(b.id);
    await ca.from('tickets').update({ status: 'answered' }).eq('id', own.id);
    await ca.from('tickets').update({ status: 'closed' }).eq('id', theirs.id);
    await ca.from('tickets').update({ user_id: b.id }).eq('id', own.id);
    expect(await ticketOf(own.id)).toMatchObject({ status: 'open', user_id: a.id });
    expect((await ticketOf(theirs.id)).status).toBe('open');
  });

  it('le client ne peut supprimer ni ticket, ni message', async () => {
    const { a, ca } = await pair();
    const t = await makeTicket(a.id);
    const m = await makeTicketMessage(t.id);
    await ca.from('ticket_messages').delete().eq('id', m.id);
    await ca.from('tickets').delete().eq('id', t.id);
    expect(await messagesOf(t.id)).toHaveLength(1);
    expect((await ticketOf(t.id)).status).toBe('open');
  });
});

describe('ticket_messages : écriture', () => {
  it('un client écrit dans son ticket (from_admin faux)', async () => {
    const { a, ca } = await pair();
    const t = await makeTicket(a.id);
    const { error } = await ca
      .from('ticket_messages')
      .insert({ ticket_id: t.id, body: 'Bonjour', from_admin: false });
    expect(error).toBeNull();
  });

  it('refuse from_admin = true côté client', async () => {
    const { a, ca } = await pair();
    const t = await makeTicket(a.id);
    const { error } = await ca
      .from('ticket_messages')
      .insert({ ticket_id: t.id, body: 'Je suis l’équipe', from_admin: true });
    expect(error).not.toBeNull();
    expect(await messagesOf(t.id)).toHaveLength(0);
  });

  it('refuse d’écrire dans le ticket d’un autre client', async () => {
    const { b, ca } = await pair();
    const t = await makeTicket(b.id);
    const { error } = await ca.from('ticket_messages').insert({ ticket_id: t.id, body: 'intrus' });
    expect(error).not.toBeNull();
    expect(await messagesOf(t.id)).toHaveLength(0);
  });

  it('le client ne peut pas modifier un message existant', async () => {
    const { a, ca } = await pair();
    const t = await makeTicket(a.id);
    const m = await makeTicketMessage(t.id, { body: 'original' });
    await ca.from('ticket_messages').update({ body: 'modifié' }).eq('id', m.id);
    expect(must((await messagesOf(t.id))[0]).body).toBe('original');
  });
});

describe('ticket_attachments : écriture', () => {
  it('accepte une pièce jointe sur son message, avec un chemin à son nom', async () => {
    const { a, ca } = await pair();
    const t = await makeTicket(a.id);
    const m = await makeTicketMessage(t.id);
    const { error } = await ca.from('ticket_attachments').insert({
      message_id: m.id,
      storage_path: `${a.id}/${randomUUID()}.png`,
      mime: 'image/png',
      size_bytes: 1000,
    });
    expect(error).toBeNull();
  });

  it('refuse un chemin qui pointe vers le dossier d’un autre client', async () => {
    const { a, b, ca } = await pair();
    const t = await makeTicket(a.id);
    const m = await makeTicketMessage(t.id);
    const { error } = await ca.from('ticket_attachments').insert({
      message_id: m.id,
      storage_path: `${b.id}/${randomUUID()}.png`,
      mime: 'image/png',
      size_bytes: 1000,
    });
    expect(error).not.toBeNull();
  });

  it('refuse une pièce jointe sur le message d’un autre client', async () => {
    const { a, b, ca } = await pair();
    const t = await makeTicket(b.id);
    const m = await makeTicketMessage(t.id);
    const { error } = await ca.from('ticket_attachments').insert({
      message_id: m.id,
      storage_path: `${a.id}/${randomUUID()}.png`,
      mime: 'image/png',
      size_bytes: 1000,
    });
    expect(error).not.toBeNull();
  });

  it.each([
    ['type gif', { mime: 'image/gif', size_bytes: 1000 }],
    ['plus de 2 Mo', { mime: 'image/png', size_bytes: 2_097_153 }],
    ['taille nulle', { mime: 'image/png', size_bytes: 0 }],
  ])('refuse une pièce jointe : %s', async (_n, extra) => {
    const { a, ca } = await pair();
    const t = await makeTicket(a.id);
    const m = await makeTicketMessage(t.id);
    const { error } = await ca
      .from('ticket_attachments')
      .insert({ message_id: m.id, storage_path: `${a.id}/${randomUUID()}.png`, ...extra });
    expect(error).not.toBeNull();
  });
});

describe('Storage : bucket privé ticket-attachments', () => {
  it('le bucket est privé, limité à 2 Mo et à jpeg/png/webp', async () => {
    const { data } = await adminClient().storage.getBucket(BUCKET);
    expect(data?.public).toBe(false);
    expect(data?.file_size_limit).toBe(2_097_152);
    expect([...(data?.allowed_mime_types ?? [])].sort()).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });

  it('un client lit son fichier, mais pas celui d’un autre', async () => {
    const { a, b, ca, cb } = await pair();
    const pathA = await putObject(a.id);
    const pathB = await putObject(b.id);
    expect((await ca.storage.from(BUCKET).download(pathA)).error).toBeNull();
    expect((await ca.storage.from(BUCKET).download(pathB)).error).not.toBeNull();
    expect((await cb.storage.from(BUCKET).download(pathA)).error).not.toBeNull();
  });

  it('un client ne peut pas fabriquer d’URL signée pour le fichier d’un autre', async () => {
    const { b, ca } = await pair();
    const pathB = await putObject(b.id);
    const { data, error } = await ca.storage.from(BUCKET).createSignedUrl(pathB, 600);
    expect(data?.signedUrl ?? null).toBeNull();
    expect(error).not.toBeNull();
  });

  it('un client ne peut plus déposer (ni chez lui, ni chez un autre) ; le dépôt serveur reste lisible', async () => {
    const { a, b, ca } = await pair();
    const own = await ca.storage
      .from(BUCKET)
      .upload(`${a.id}/${randomUUID()}.png`, TINY_PNG, { contentType: 'image/png' });
    expect(own.error).not.toBeNull();
    const theirs = await ca.storage
      .from(BUCKET)
      .upload(`${b.id}/${randomUUID()}.png`, TINY_PNG, { contentType: 'image/png' });
    expect(theirs.error).not.toBeNull();
    const serverPath = await putObject(a.id);
    expect((await ca.storage.from(BUCKET).download(serverPath)).error).toBeNull();
  });

  it('refuse un type de fichier non autorisé, même dans son propre dossier', async () => {
    const { a, ca } = await pair();
    const res = await ca.storage
      .from(BUCKET)
      .upload(`${a.id}/${randomUUID()}.gif`, Uint8Array.from([0x47, 0x49, 0x46]), {
        contentType: 'image/gif',
      });
    expect(res.error).not.toBeNull();
  });

  it('la liste du bucket ne montre jamais les fichiers d’un autre client', async () => {
    const { a, b, ca } = await pair();
    await putObject(a.id);
    await putObject(b.id);
    const { data } = await ca.storage.from(BUCKET).list(b.id);
    expect(data ?? []).toHaveLength(0);
  });
});
