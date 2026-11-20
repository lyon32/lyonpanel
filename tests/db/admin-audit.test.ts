import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import { ROUTES, auditRows, callRoute, failAuditFor } from '../helpers/admin-phase12';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Journal d'audit (phase 12, décision 4 et « Mes choix »).
 *   GET /admin/audit?action=&limit=&cursor= -> { items: [{ id, actor_id, action, target_table, target_id, details, created_at }], next_cursor }
 * Lecture seule, du plus récent au plus ancien, paginé, filtre par type d'action, aucune suppression possible.
 * Atomicité : TOUT changement admin (y compris ceux de la phase 11) et sa trace passent dans une seule fonction SQL.
 */
const db = adminClient();
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
type Item = { id: number; actor_id: string | null; action: string; target_id: string | null };
type Page = { items: Item[]; next_cursor: string | null };

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => admin.release());
beforeEach(() => {
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  await cleanupUsers(created);
});
const audit = (qs: string) => callRoute(ROUTES.audit, 'GET', `/api/v1/admin/audit${qs}`);

async function seed(action: string, n: number) {
  const rows = Array.from({ length: n }, (_, i) => ({
    actor_id: admin.id,
    action,
    target_table: 'orders',
    target_id: `t-${i}`,
    details: { i },
  }));
  const { error } = await db.from('audit_log').insert(rows);
  expect(error).toBeNull();
}

describe('GET /admin/audit', () => {
  it('filtre par action, du plus récent au plus ancien, avec les champs attendus', async () => {
    const action = `zz12_${randomUUID().slice(0, 8)}`;
    await seed(action, 3);
    const res = await audit(`?action=${action}&limit=10`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Page;
    expect(body.items).toHaveLength(3);
    expect(body.items.map((i) => i.id)).toEqual(
      [...body.items.map((i) => i.id)].sort((a, b) => b - a),
    );
    expect(Object.keys(body.items[0]!).sort()).toEqual(
      ['action', 'actor_id', 'created_at', 'details', 'id', 'target_id', 'target_table'].sort(),
    );
  });

  it('pagine par curseur : chaque ligne est vue une seule fois', async () => {
    const action = `zz12_${randomUUID().slice(0, 8)}`;
    await seed(action, 5);
    const seen: number[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 5; i++) {
      const qs: string = `?action=${action}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = (await (await audit(qs)).json()) as Page;
      seen.push(...page.items.map((x) => x.id));
      cursor = page.next_cursor;
      if (!cursor) break;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it.each(['limit=0', 'limit=1000', 'limit=abc', 'cursor=%%%', 'action=%27%3Bdrop'])(
    'paramètre invalide (%s) : 400 VALIDATION_ERROR',
    async (qs) => {
      expect((await audit(`?${qs}`)).status).toBe(400);
    },
  );
});

describe('journal en lecture seule', () => {
  it('le module de la route n’expose que GET', async () => {
    const mod = (await import(/* @vite-ignore */ ROUTES.audit)) as Record<string, unknown>;
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(mod[m], m).toBeUndefined();
  });

  it('une ligne ne peut ni être modifiée ni supprimée, même avec la clé de service', async () => {
    const action = `zz12_${randomUUID().slice(0, 8)}`;
    await seed(action, 1);
    const [row] = await auditRows(action);
    expect(
      (await db.from('audit_log').update({ action: 'x' }).eq('id', row!.id)).error,
    ).not.toBeNull();
    expect((await db.from('audit_log').delete().eq('id', row!.id)).error).not.toBeNull();
    expect(await auditRows(action)).toHaveLength(1);
  });
});

describe('atomicité des changements de la phase 11 (client et note)', () => {
  it('blocage d’un client : si la trace échoue, le client n’est pas bloqué', async () => {
    const u = await makeFundedUser(created);
    const restore = failAuditFor(['update_user']);
    try {
      const res = await callRoute(
        '@/app/api/v1/admin/users/[id]/route',
        'PATCH',
        `/api/v1/admin/users/${u.id}`,
        { id: u.id, body: { status: 'blocked', blocked_reason: 'test atomique' } },
      );
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    const { data } = await db
      .from('profiles')
      .select('status, blocked_reason')
      .eq('id', u.id)
      .single();
    expect(data).toMatchObject({ status: 'active', blocked_reason: null });
  });

  it('note privée : si la trace échoue, la note n’est pas enregistrée', async () => {
    const u = await makeFundedUser(created);
    const restore = failAuditFor(['add_note']);
    try {
      const res = await callRoute(
        '@/app/api/v1/admin/users/[id]/notes/route',
        'POST',
        `/api/v1/admin/users/${u.id}/notes`,
        { id: u.id, body: { body: 'note atomique' } },
      );
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    const { data } = await db.from('admin_notes').select('id').eq('user_id', u.id);
    expect(data).toEqual([]);
  });
});
