import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession, load } from '../helpers/admin-db';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { cleanupTickets, putObject } from '../helpers/tickets-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Faille 10 : la purge est définitive, l'audit garde donc CE qui a été supprimé.
 * audit_log (action purge_orphan_attachments) : details = { count, paths: string[] } avec les chemins réellement supprimés
 * (pas ceux refusés). purgeOrphanAttachments(input, adminId) : signature inchangée.
 */

const db = adminClient();
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
type Mod = {
  purgeOrphanAttachments: (
    i: { paths: string[]; confirm: boolean; minAgeMinutes?: number },
    adminId: string,
  ) => Promise<{ deleted: string[] }>;
};

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

const lastAudit = async () => {
  const { data } = await db
    .from('audit_log')
    .select('details')
    .eq('action', 'purge_orphan_attachments')
    .eq('actor_id', admin.id)
    .order('created_at', { ascending: false })
    .limit(1);
  return data![0]!.details as { count: number; paths?: string[] };
};

describe('purge des orphelins : audit des chemins', () => {
  it('enregistre les chemins supprimés dans audit_log.details.paths', async () => {
    const u = await makeFundedUser(created);
    const a = await putObject(u.id);
    const b = await putObject(u.id);
    const { purgeOrphanAttachments } = await load<Mod>('@/server/tickets/purge-orphans');
    const res = await purgeOrphanAttachments(
      { paths: [a, b], confirm: true, minAgeMinutes: 0 },
      admin.id,
    );
    expect(res.deleted.sort()).toEqual([a, b].sort());
    const details = await lastAudit();
    expect(details.count).toBe(2);
    expect([...(details.paths ?? [])].sort()).toEqual([a, b].sort());
  });

  it('ne garde pas dans paths un chemin refusé (fichier absent)', async () => {
    const u = await makeFundedUser(created);
    const a = await putObject(u.id);
    const missing = `${u.id}/00000000-0000-4000-8000-000000000000.png`;
    const { purgeOrphanAttachments } = await load<Mod>('@/server/tickets/purge-orphans');
    await purgeOrphanAttachments(
      { paths: [a, missing], confirm: true, minAgeMinutes: 0 },
      admin.id,
    );
    const details = await lastAudit();
    expect(details.paths).toEqual([a]);
  });
});
