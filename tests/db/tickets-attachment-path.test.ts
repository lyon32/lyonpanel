import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { TINY_PNG, cleanupTickets, makeTicket } from '../helpers/tickets-db';
import { userClient } from './helpers/client';

/*
 * Défaut D (phase 9, reporté ; décision 4d) : la règle d'insertion de ticket_attachments n'exigeait que
 * « <uid>/% ». Elle doit exiger le chemin strict <uid>/<uuid>.(jpg|png|webp), comme la règle de lecture
 * du stockage. Chemin de test : client connecté, insertion directe (le service utilise le même chemin).
 */

const created: string[] = [];
afterEach(async () => {
  await cleanupTickets(created);
  await cleanupUsers(created);
});

async function setup() {
  const u = await makeFundedUser(created);
  const t = await makeTicket(u.id);
  const c = await userClient(u.id);
  const { data, error } = await c
    .from('ticket_messages')
    .insert({ ticket_id: t.id, from_admin: false, body: 'Voici la capture' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`message de test impossible : ${error?.message}`);
  const attach = (path: string, mime = 'image/png') =>
    c.from('ticket_attachments').insert({
      message_id: data.id,
      storage_path: path,
      mime,
      size_bytes: TINY_PNG.length,
    });
  return { u, attach };
}

describe('ticket_attachments : chemin strict à l’insertion', () => {
  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['webp', 'image/webp'],
  ])('accepte <uid>/<uuid>.%s', async (ext, mime) => {
    const { u, attach } = await setup();
    expect((await attach(`${u.id}/${randomUUID()}.${ext}`, mime)).error).toBeNull();
  });

  it.each([
    ['remontée de dossier', (u: string) => `${u}/../autre.png`],
    ['sous-dossier', (u: string) => `${u}/sous/${randomUUID()}.png`],
    ['nom qui n’est pas un uuid', (u: string) => `${u}/capture.png`],
    ['uuid sans extension', (u: string) => `${u}/${randomUUID()}`],
    ['extension non autorisée', (u: string) => `${u}/${randomUUID()}.exe`],
    ['double extension', (u: string) => `${u}/${randomUUID()}.png.php`],
    ['extension jpeg non produite par le serveur', (u: string) => `${u}/${randomUUID()}.jpeg`],
    ['majuscules', (u: string) => `${u}/${randomUUID().toUpperCase()}.PNG`],
    ['retour à la ligne', (u: string) => `${u}/${randomUUID()}.png\n`],
    ['espace final', (u: string) => `${u}/${randomUUID()}.png `],
    ['dossier vide', (u: string) => `${u}//${randomUUID()}.png`],
    ['sans dossier du client', () => `${randomUUID()}.png`],
  ])('refuse un chemin invalide : %s', async (_nom, build) => {
    const { u, attach } = await setup();
    expect((await attach(build(u.id))).error).not.toBeNull();
  });

  it('refuse le dossier d’un autre client, même avec un nom valide', async () => {
    const { attach } = await setup();
    expect((await attach(`${randomUUID()}/${randomUUID()}.png`)).error).not.toBeNull();
  });
});
