import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { BUCKET, TINY_PNG, cleanupTickets, makeTicket, putObject } from '../helpers/tickets-db';
import { adminClient, userClient } from './helpers/client';

/*
 * Durcissement du support (migration 9.2ter, failles A, C, D du 2e passage sécurité) :
 * le client ne dépose plus rien en direct, le corps d'un message est borné en base,
 * et la lecture n'accepte qu'un chemin strict <uid>/<uuid>.(jpg|png|webp).
 */

const created: string[] = [];
afterEach(async () => {
  await cleanupTickets(created);
  await cleanupUsers(created);
});

const upload = (db: Awaited<ReturnType<typeof userClient>>, path: string) =>
  db.storage.from(BUCKET).upload(path, TINY_PNG, { contentType: 'image/png' });

describe('faille A : dépôt direct dans le bucket', () => {
  it('refuse le dépôt d’un client connecté, même dans son propre dossier', async () => {
    const u = await makeFundedUser(created);
    const res = await upload(await userClient(u.id), `${u.id}/${randomUUID()}.png`);
    expect(res.error).not.toBeNull();
  });

  it('refuse 3 dépôts directs de suite (pas de contournement de la limite serveur)', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    for (let i = 0; i < 3; i++) {
      expect((await upload(c, `${u.id}/${randomUUID()}.webp`)).error).not.toBeNull();
    }
  });

  it('accepte toujours le dépôt par le serveur (clé service)', async () => {
    const u = await makeFundedUser(created);
    const res = await upload(adminClient() as never, `${u.id}/${randomUUID()}.png`);
    expect(res.error).toBeNull();
  });
});

describe('faille C : taille du message bornée en base', () => {
  it('refuse 4001 caractères, même en direct par PostgREST avec le jeton du client', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    const c = await userClient(u.id);
    const { error } = await c
      .from('ticket_messages')
      .insert({ ticket_id: t.id, body: 'a'.repeat(4001), from_admin: false });
    expect(error).not.toBeNull();
  });

  it('refuse aussi 4001 caractères avec la clé service (contrainte de table)', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    const { error } = await adminClient()
      .from('ticket_messages')
      .insert({ ticket_id: t.id, body: 'a'.repeat(4001), from_admin: false });
    expect(error?.message).toMatch(/check|body|violates/i);
  });

  it('accepte 4000 caractères pile', async () => {
    const u = await makeFundedUser(created);
    const t = await makeTicket(u.id);
    const { error } = await adminClient()
      .from('ticket_messages')
      .insert({ ticket_id: t.id, body: 'a'.repeat(4000), from_admin: false });
    expect(error).toBeNull();
  });
});

describe('faille D : chemin strict <uid>/<uuid>.(jpg|png|webp)', () => {
  it('le client lit toujours une pièce de son dossier au chemin conforme', async () => {
    const u = await makeFundedUser(created);
    const path = await putObject(u.id);
    expect((await (await userClient(u.id)).storage.from(BUCKET).download(path)).error).toBeNull();
  });

  it('le client ne peut pas lire un objet de son dossier au nom non conforme', async () => {
    const u = await makeFundedUser(created);
    const path = `${u.id}/notes.png`;
    expect((await upload(adminClient() as never, path)).error).toBeNull();
    const res = await (await userClient(u.id)).storage.from(BUCKET).download(path);
    expect(res.error).not.toBeNull();
  });

  it('le client ne peut pas lire un objet à extension non autorisée dans son dossier', async () => {
    const u = await makeFundedUser(created);
    const path = `${u.id}/${randomUUID()}.png.exe`;
    await adminClient().storage.from(BUCKET).upload(path, TINY_PNG, { contentType: 'image/png' });
    const res = await (await userClient(u.id)).storage.from(BUCKET).download(path);
    expect(res.error).not.toBeNull();
  });

  it('refuse un dépôt au chemin avec « ../ » ou au nom non conforme', async () => {
    const u = await makeFundedUser(created);
    const c = await userClient(u.id);
    expect((await upload(c, `${u.id}/../${randomUUID()}/x.png`)).error).not.toBeNull();
    expect((await upload(c, `${u.id}/photo.png`)).error).not.toBeNull();
  });
});
