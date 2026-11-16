import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession, load } from '../helpers/admin-db';
import { getReq, sendReq } from '../helpers/client-area-db';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import {
  BUCKET,
  cleanupTickets,
  makeAttachment,
  makeTicket,
  makeTicketMessage,
  putObject,
} from '../helpers/tickets-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Purge des fichiers orphelins de tickets (phase 11, décision 4f). Suppression DÉFINITIVE : jamais automatique,
 * toujours « liste d'abord, puis confirmation explicite ».
 * Module attendu : src/server/tickets/purge-orphans.ts
 *   listOrphanAttachments(opts?: { minAgeMinutes?: number }): Promise<{ path, size_bytes, created_at }[]>
 *       fichiers du bucket sans ligne dans ticket_attachments, plus anciens que minAgeMinutes (défaut 60 :
 *       un envoi en cours, pas encore rattaché à un message, n'est pas un orphelin). Ne supprime rien.
 *   purgeOrphanAttachments(input: { paths: string[]; confirm: boolean; minAgeMinutes?: number }, adminId: string):
 *       Promise<{ deleted: string[]; skipped: { path: string; reason: 'attached' | 'not_found' | 'too_recent' }[] }>
 *       confirm doit valoir exactement true ; chaque chemin est revérifié au moment de la purge.
 * Routes (admin aal2) :
 *   GET  /api/v1/admin/storage/orphans            -> 200 { items: [{ path, size_bytes, created_at }] }
 *   POST /api/v1/admin/storage/orphans/purge      { paths, confirm: true } -> 200 { deleted, skipped }
 * Audit : audit_log action « purge_orphan_attachments », actor = admin, details.count = nombre supprimé.
 */

const db = adminClient();
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
type Orphan = { path: string; size_bytes: number; created_at: string };
type Skip = { path: string; reason: string };
type Purge = { deleted: string[]; skipped: Skip[] };
type Mod = {
  listOrphanAttachments: (o?: { minAgeMinutes?: number }) => Promise<Orphan[]>;
  purgeOrphanAttachments: (
    i: { paths: string[]; confirm: unknown; minAgeMinutes?: number },
    adminId: string,
  ) => Promise<Purge>;
};
const mod = () => load<Mod>('@/server/tickets/purge-orphans');
const list = async (min = 0) => (await mod()).listOrphanAttachments({ minAgeMinutes: min });
const purge = async (paths: string[], confirm: unknown = true, min = 0) =>
  (await mod()).purgeOrphanAttachments({ paths, confirm, minAgeMinutes: min }, admin.id);

async function exists(path: string): Promise<boolean> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const name = path.slice(path.lastIndexOf('/') + 1);
  const { data } = await db.storage.from(BUCKET).list(dir, { search: name });
  return (data ?? []).some((f) => f.name === name);
}
async function attachedFile() {
  const u = await makeFundedUser(created);
  const t = await makeTicket(u.id);
  const m = await makeTicketMessage(t.id);
  const path = await putObject(u.id);
  await makeAttachment(m.id, path);
  return { u, path };
}

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  await admin.release();
});
beforeEach(() => {
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  await cleanupTickets(created);
  await cleanupUsers(created);
});

describe('listOrphanAttachments : la liste d’abord', () => {
  it('montre un fichier sans pièce jointe, avec sa taille et sa date', async () => {
    const u = await makeFundedUser(created);
    const path = await putObject(u.id);
    const item = (await list()).find((o) => o.path === path);
    expect(item).toBeDefined();
    expect(item!.size_bytes).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(item!.created_at))).toBe(false);
  });

  it('ne montre pas un fichier rattaché à un message', async () => {
    const { path } = await attachedFile();
    expect((await list()).map((o) => o.path)).not.toContain(path);
  });

  it('ne montre pas un envoi récent (délai de grâce de 60 minutes par défaut)', async () => {
    const u = await makeFundedUser(created);
    const path = await putObject(u.id);
    const items = await (await mod()).listOrphanAttachments();
    expect(items.map((o) => o.path)).not.toContain(path);
  });

  it('lister ne supprime jamais rien', async () => {
    const u = await makeFundedUser(created);
    const path = await putObject(u.id);
    await list();
    await list();
    expect(await exists(path)).toBe(true);
  });
});

describe('purgeOrphanAttachments : confirmation explicite', () => {
  it.each([[false], [undefined], ['true'], [1], ['oui'], [null]])(
    'confirm = %j : refusé (VALIDATION_ERROR), le fichier reste',
    async (confirm) => {
      const u = await makeFundedUser(created);
      const path = await putObject(u.id);
      await expect(purge([path], confirm)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(await exists(path)).toBe(true);
    },
  );

  it('liste de chemins vide : refusé', async () => {
    await expect(purge([])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it.each([
    ['remontée de dossier', (u: string) => `${u}/../autre.png`],
    ['hors format <uid>/<uuid>.ext', (u: string) => `${u}/nimporte-quoi.png`],
    ['générique', () => '*'],
    ['dossier seul', (u: string) => u],
  ])(
    'chemin invalide (%s) : toute la demande est refusée, rien n’est supprimé',
    async (_n, build) => {
      const u = await makeFundedUser(created);
      const good = await putObject(u.id);
      await expect(purge([good, build(u.id)])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(await exists(good)).toBe(true);
    },
  );

  it('supprime seulement les chemins demandés : un autre orphelin reste', async () => {
    const u = await makeFundedUser(created);
    const a = await putObject(u.id);
    const b = await putObject(u.id);
    const res = await purge([a]);
    expect(res.deleted).toEqual([a]);
    expect(res.skipped).toEqual([]);
    expect(await exists(a)).toBe(false);
    expect(await exists(b)).toBe(true);
  });

  it('refuse de supprimer un fichier devenu rattaché entre la liste et la purge', async () => {
    const { path } = await attachedFile();
    const res = await purge([path]);
    expect(res.deleted).toEqual([]);
    expect(res.skipped).toEqual([{ path, reason: 'attached' }]);
    expect(await exists(path)).toBe(true);
  });

  it('chemin inexistant : ignoré avec la raison not_found, pas d’erreur', async () => {
    const u = await makeFundedUser(created);
    const ghost = `${u.id}/${randomUUID()}.png`;
    const res = await purge([ghost]);
    expect(res).toEqual({ deleted: [], skipped: [{ path: ghost, reason: 'not_found' }] });
  });

  it('fichier récent : ignoré avec la raison too_recent quand le délai de grâce s’applique', async () => {
    const u = await makeFundedUser(created);
    const path = await putObject(u.id);
    const res = await purge([path], true, 60);
    expect(res.skipped).toEqual([{ path, reason: 'too_recent' }]);
    expect(await exists(path)).toBe(true);
  });

  it('mélange : supprime l’orphelin, protège le rattaché, dit pourquoi', async () => {
    const orphanOwner = await makeFundedUser(created);
    const orphan = await putObject(orphanOwner.id);
    const { path: attached } = await attachedFile();
    const res = await purge([orphan, attached]);
    expect(res.deleted).toEqual([orphan]);
    expect(res.skipped).toEqual([{ path: attached, reason: 'attached' }]);
    expect(await exists(attached)).toBe(true);
  });

  it('écrit une ligne d’audit avec le nombre de fichiers supprimés', async () => {
    const u = await makeFundedUser(created);
    const a = await putObject(u.id);
    const b = await putObject(u.id);
    await purge([a, b]);
    const { data } = await db
      .from('audit_log')
      .select('*')
      .eq('action', 'purge_orphan_attachments')
      .eq('actor_id', admin.id)
      .order('created_at', { ascending: false })
      .limit(1);
    expect(data![0]!.details).toMatchObject({ count: 2 });
  });

  it('une purge qui ne supprime rien (tout refusé) n’efface rien et ne plante pas', async () => {
    const { path } = await attachedFile();
    await expect(purge([path])).resolves.toMatchObject({ deleted: [] });
    expect(await exists(path)).toBe(true);
  });
});

describe('routes /admin/storage/orphans', () => {
  type Handler = (req: Request) => Promise<Response>;
  const getList = async () =>
    (await load<{ GET: Handler }>('@/app/api/v1/admin/storage/orphans/route')).GET(
      getReq('/api/v1/admin/storage/orphans'),
    );
  const post = async (body: unknown) =>
    (await load<{ POST: Handler }>('@/app/api/v1/admin/storage/orphans/purge/route')).POST(
      sendReq('POST', '/api/v1/admin/storage/orphans/purge', body),
    );

  it('GET : 200 avec la liste, réponse privée', async () => {
    const res = await getList();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/private/);
    expect(Array.isArray(((await res.json()) as { items: unknown[] }).items)).toBe(true);
  });

  it('POST sans confirm:true : 400 VALIDATION_ERROR, fichier intact', async () => {
    const u = await makeFundedUser(created);
    const path = await putObject(u.id);
    expect((await post({ paths: [path] })).status).toBe(400);
    expect((await post({ paths: [path], confirm: 'true' })).status).toBe(400);
    expect(await exists(path)).toBe(true);
  });

  it('POST avec un fichier récent : 200, rien de supprimé (délai de grâce), raison too_recent', async () => {
    const u = await makeFundedUser(created);
    const path = await putObject(u.id);
    const res = await post({ paths: [path], confirm: true });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Purge;
    expect(body.deleted).toEqual([]);
    expect(body.skipped).toEqual([{ path, reason: 'too_recent' }]);
    expect(await exists(path)).toBe(true);
  });

  it.each([['GET'], ['POST']])(
    '%s : visiteur et client ordinaire reçoivent 404, admin sans code 401',
    async (verb) => {
      const call = () => (verb === 'GET' ? getList() : post({ paths: [], confirm: true }));
      session.client = fakeSession(null);
      expect((await call()).status).toBe(404);
      const u = await makeFundedUser(created);
      session.client = fakeSession(u.id, { current: 'aal2' });
      expect((await call()).status).toBe(404);
      session.client = fakeSession(admin.id, { current: 'aal1', next: 'aal2' });
      expect((await call()).status).toBe(401);
    },
  );
});
