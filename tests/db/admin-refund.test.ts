import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import {
  ROUTES,
  auditRows,
  callRoute,
  failAuditFor,
  paidOrder,
  refundsOf,
} from '../helpers/admin-phase12';
import type { ErrorBody } from '../helpers/client-area-db';
import { balanceOf, cleanupUsers } from '../helpers/orders-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Remboursement admin (phase 12, décision 2). Fonction SQL attendue (nouvelle signature, remplace celle de la phase 0) :
 *   refund_order(p_order uuid, p_amount bigint, p_admin uuid, p_reason text, p_idem_key text default null) returns orders
 * Règles appliquées EN BASE (jamais seulement dans le serveur) :
 *   - plafond = part non livrée = floor(charged_xaf * remains / quantity) (remains null = inconnu : l'admin saisit, plafonné au prix payé), moins ce qui est déjà rendu ;
 *   - plusieurs remboursements partiels possibles, somme cumulée plafonnée ; la commande passe `refunded` quand le plafond est atteint ;
 *   - seules les commandes `to_review` (ou déjà partiellement remboursées) sont remboursables ;
 *   - motif obligatoire (REASON_REQUIRED) ; erreurs : NOT_ADMIN, ORDER_NOT_FOUND, AMOUNT_TOO_HIGH, ALREADY_REFUNDED, ORDER_NOT_REFUNDABLE ;
 *   - p_idem_key identique rejoué : un seul crédit ;
 *   - le crédit, la ligne d'historique (type refund) et la trace audit_log (action refund_order) passent ensemble ou pas du tout.
 * Route : POST /api/v1/admin/orders/{id}/refund { amount_xaf, reason } -> 200 { refunded_xaf, total_refunded_xaf, order_status }.
 */
const db = adminClient();
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const NO_MONEY_TEXT = /mobile\s*money|momo|orange|mtn|saspay|wave/i;

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

const rpc = (
  order: string,
  amount: number,
  reason: string | null = 'Échec fournisseur',
  extra = {},
) =>
  db.rpc('refund_order', {
    p_order: order,
    p_amount: amount,
    p_admin: admin.id,
    p_reason: reason,
    ...extra,
  });
const orderRow = async (id: string) =>
  (await db.from('orders').select('*').eq('id', id).single()).data as Record<string, unknown>;

describe('refund_order (SQL) : montants', () => {
  it('rembourse partiellement puis totalement : solde, historique et statut corrects', async () => {
    const o = await paidOrder(created);
    expect((await rpc(o.id, 400)).error).toBeNull();
    expect(await balanceOf(o.userId)).toBe(400);
    expect((await orderRow(o.id)).status).not.toBe('refunded');
    expect((await rpc(o.id, 600)).error).toBeNull();
    expect(await balanceOf(o.userId)).toBe(1000);
    expect((await orderRow(o.id)).status).toBe('refunded');
    const lines = await refundsOf(o.id);
    expect(lines.map((l) => Number(l.amount_xaf)).sort((a, b) => a - b)).toEqual([400, 600]);
    expect(lines.every((l) => l.created_by === admin.id)).toBe(true);
  });

  it('refuse AMOUNT_TOO_HIGH quand la somme cumulée dépasse le payé, sans rien changer', async () => {
    const o = await paidOrder(created);
    expect((await rpc(o.id, 400)).error).toBeNull();
    const r = await rpc(o.id, 700);
    expect(r.error?.message).toContain('AMOUNT_TOO_HIGH');
    expect(await balanceOf(o.userId)).toBe(400);
    expect(await refundsOf(o.id)).toHaveLength(1);
  });

  it('refuse un montant supérieur au payé dès le premier remboursement', async () => {
    const o = await paidOrder(created);
    expect((await rpc(o.id, 1001)).error?.message).toContain('AMOUNT_TOO_HIGH');
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it.each([0, -50])('refuse le montant %i', async (amount) => {
    const o = await paidOrder(created);
    expect((await rpc(o.id, amount)).error?.message).toContain('AMOUNT_TOO_HIGH');
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('plafonne à la part non livrée : 600 livrés sur 1 000, plafond 400', async () => {
    const o = await paidOrder(created, { remains: 400 });
    expect((await rpc(o.id, 401)).error?.message).toContain('AMOUNT_TOO_HIGH');
    expect((await rpc(o.id, 400)).error).toBeNull();
    expect(await balanceOf(o.userId)).toBe(400);
    expect((await orderRow(o.id)).status).toBe('refunded');
  });

  it('arrondit la part non livrée vers le bas : 1 155 XAF, 333 restants = 384 au plus', async () => {
    const o = await paidOrder(created, { charged_xaf: 1155, remains: 333 });
    expect((await rpc(o.id, 385)).error?.message).toContain('AMOUNT_TOO_HIGH');
    expect((await rpc(o.id, 384)).error).toBeNull();
  });

  it('reste inconnu (null) : montant saisi accepté, plafonné au prix payé, clôture au plafond', async () => {
    const o = await paidOrder(created, { remains: null });
    expect((await rpc(o.id, 1001)).error?.message).toContain('AMOUNT_TOO_HIGH');
    expect((await rpc(o.id, 250)).error).toBeNull();
    expect((await orderRow(o.id)).status).not.toBe('refunded');
    expect((await rpc(o.id, 751)).error?.message).toContain('AMOUNT_TOO_HIGH');
    expect((await rpc(o.id, 750)).error).toBeNull();
    expect((await orderRow(o.id)).status).toBe('refunded');
    expect(await balanceOf(o.userId)).toBe(1000);
  });

  it('un partiel ne clôture pas : la commande reste remboursable (to_review) et peut recevoir un 2e partiel', async () => {
    const o = await paidOrder(created, { remains: 400 });
    expect((await rpc(o.id, 100)).error).toBeNull();
    expect((await orderRow(o.id)).status).toBe('to_review');
    expect((await rpc(o.id, 100)).error).toBeNull();
    expect((await orderRow(o.id)).status).toBe('to_review');
    expect(await balanceOf(o.userId)).toBe(200);
  });

  it('commande entièrement livrée (reste 0) : plafond 0, refusé', async () => {
    const o = await paidOrder(created, { remains: 0 });
    expect((await rpc(o.id, 1)).error?.message).toContain('AMOUNT_TOO_HIGH');
  });

  it('jamais deux fois : après le remboursement total, refuse ALREADY_REFUNDED', async () => {
    const o = await paidOrder(created);
    await rpc(o.id, 1000);
    expect((await rpc(o.id, 1)).error?.message).toContain('ALREADY_REFUNDED');
    expect(await balanceOf(o.userId)).toBe(1000);
  });

  it.each(['completed', 'in_progress', 'pending', 'canceled'])(
    'refuse une commande « %s » (seule to_review est remboursable)',
    async (status) => {
      const o = await paidOrder(created, { status });
      expect((await rpc(o.id, 100)).error?.message).toContain('ORDER_NOT_REFUNDABLE');
      expect(await balanceOf(o.userId)).toBe(0);
    },
  );

  it('refuse ORDER_NOT_FOUND pour une commande inexistante', async () => {
    expect((await rpc(randomUUID(), 100)).error?.message).toContain('ORDER_NOT_FOUND');
  });
});

describe('refund_order (SQL) : motif, droits, trace', () => {
  it.each([null, '', '   '])(
    'refuse le motif %j (REASON_REQUIRED), rien ne change',
    async (reason) => {
      const o = await paidOrder(created);
      expect((await rpc(o.id, 100, reason)).error?.message).toContain('REASON_REQUIRED');
      expect(await balanceOf(o.userId)).toBe(0);
      expect(await refundsOf(o.id)).toHaveLength(0);
    },
  );

  it("refuse NOT_ADMIN si l'appelant n'est pas l'administrateur", async () => {
    const o = await paidOrder(created);
    const r = await db.rpc('refund_order', {
      p_order: o.id,
      p_amount: 100,
      p_admin: o.userId,
      p_reason: 'test',
    });
    expect(r.error?.message).toContain('NOT_ADMIN');
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('un client connecté ne peut pas appeler la fonction (permission denied)', async () => {
    const o = await paidOrder(created);
    const c = await userClient(o.userId);
    const r = await c.rpc('refund_order', {
      p_order: o.id,
      p_amount: 100,
      p_admin: admin.id,
      p_reason: 'x',
    });
    expect(r.error?.message).toMatch(/permission denied/i);
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('écrit une trace audit_log avec acteur, montant, motif et cumul', async () => {
    const o = await paidOrder(created);
    await rpc(o.id, 300, 'Commande bloquée chez le fournisseur');
    const rows = await auditRows('refund_order', o.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: admin.id, target_table: 'orders' });
    expect(rows[0]!.details).toMatchObject({
      amount_xaf: 300,
      reason: 'Commande bloquée chez le fournisseur',
      total_refunded_xaf: 300,
    });
  });

  it('atomique : si la trace ne peut pas être écrite, aucun crédit ni ligne d’historique', async () => {
    const o = await paidOrder(created);
    const restore = failAuditFor(['refund_order']);
    try {
      expect((await rpc(o.id, 300)).error).not.toBeNull();
    } finally {
      restore();
    }
    expect(await balanceOf(o.userId)).toBe(0);
    expect(await refundsOf(o.id)).toHaveLength(0);
    expect((await orderRow(o.id)).status).toBe('to_review');
    // Témoin : le même appel réussit une fois la panne retirée (le refus venait bien de la trace).
    expect((await rpc(o.id, 300)).error).toBeNull();
    expect(await balanceOf(o.userId)).toBe(300);
  });

  it('la ligne d’historique du client ne parle ni de Mobile Money ni de paiement externe', async () => {
    const o = await paidOrder(created);
    await rpc(o.id, 300, 'Retour Mobile Money demandé par erreur');
    const [line] = await refundsOf(o.id);
    expect(line).toBeDefined();
    expect(String(line!.note ?? '')).not.toMatch(NO_MONEY_TEXT);
  });
});

describe('refund_order (SQL) : parallèle et rejeu', () => {
  it('deux remboursements totaux simultanés : un seul passe, crédité une fois', async () => {
    const o = await paidOrder(created);
    const [a, b] = await Promise.all([rpc(o.id, 1000), rpc(o.id, 1000)]);
    expect([a.error, b.error].filter((e) => e === null)).toHaveLength(1);
    expect(await balanceOf(o.userId)).toBe(1000);
    expect(await refundsOf(o.id)).toHaveLength(1);
  });

  it('deux remboursements de 600 simultanés (cumul > payé) : un seul passe', async () => {
    const o = await paidOrder(created);
    const [a, b] = await Promise.all([rpc(o.id, 600), rpc(o.id, 600)]);
    expect([a.error, b.error].filter((e) => e === null)).toHaveLength(1);
    expect(await balanceOf(o.userId)).toBe(600);
  });

  it('dix remboursements de 300 simultanés : au plus 3 passent, jamais plus que le payé', async () => {
    const o = await paidOrder(created);
    const results = await Promise.all(Array.from({ length: 10 }, () => rpc(o.id, 300)));
    const ok = results.filter((r) => r.error === null).length;
    expect(ok).toBe(3);
    expect(await balanceOf(o.userId)).toBe(900);
  });

  it('même clé d’idempotence rejouée (double clic sur un partiel) : un seul crédit', async () => {
    const o = await paidOrder(created);
    const key = randomUUID();
    await Promise.all([
      rpc(o.id, 300, 'x y z', { p_idem_key: key }),
      rpc(o.id, 300, 'x y z', { p_idem_key: key }),
    ]);
    await rpc(o.id, 300, 'x y z', { p_idem_key: key });
    expect(await balanceOf(o.userId)).toBe(300);
    expect(await refundsOf(o.id)).toHaveLength(1);
  });
});

describe('POST /admin/orders/{id}/refund', () => {
  const refund = (id: string, body: unknown, headers: Record<string, string> = {}) =>
    callRoute(ROUTES.refund, 'POST', `/api/v1/admin/orders/${id}/refund`, { body, id, headers });
  const code = async (r: Response) => ((await r.json()) as ErrorBody).error.code;

  it('rembourse la part non livrée : 200, solde du client corrigé, ligne d’historique', async () => {
    const o = await paidOrder(created, { remains: 400 });
    const res = await refund(o.id, { amount_xaf: 400, reason: 'Commande échouée' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      refunded_xaf: 400,
      total_refunded_xaf: 400,
      order_status: 'refunded',
    });
    expect(await balanceOf(o.userId)).toBe(400);
    expect(await refundsOf(o.id)).toHaveLength(1);
  });

  it('partiel puis total, puis refus au-delà (ALREADY_REFUNDED)', async () => {
    const o = await paidOrder(created, { remains: 400 });
    expect((await refund(o.id, { amount_xaf: 150, reason: 'Premier geste' })).status).toBe(200);
    const second = await refund(o.id, { amount_xaf: 250, reason: 'Solde du dû' });
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({
      total_refunded_xaf: 400,
      order_status: 'refunded',
    });
    const third = await refund(o.id, { amount_xaf: 1, reason: 'Encore un' });
    expect(third.status).toBe(409);
    expect(await code(third)).toBe('ALREADY_REFUNDED');
    expect(await balanceOf(o.userId)).toBe(400);
  });

  it('montant au-dessus de la part non livrée : 422 AMOUNT_TOO_HIGH, aucun changement', async () => {
    const o = await paidOrder(created, { remains: 400 });
    const res = await refund(o.id, { amount_xaf: 401, reason: 'Trop' });
    expect(res.status).toBe(422);
    expect(await code(res)).toBe('AMOUNT_TOO_HIGH');
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it.each([
    {},
    { amount_xaf: 100 },
    { amount_xaf: 100, reason: '  ' },
    { amount_xaf: 1.5, reason: 'x y z' },
    { amount_xaf: '100', reason: 'x y z' },
  ])('corps invalide %j : 400 VALIDATION_ERROR, aucun changement', async (body) => {
    const o = await paidOrder(created);
    const res = await refund(o.id, body);
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('double clic (deux requêtes simultanées pour le total) : un seul 200, crédité une fois', async () => {
    const o = await paidOrder(created);
    const body = { amount_xaf: 1000, reason: 'Double clic' };
    const [a, b] = await Promise.all([refund(o.id, body), refund(o.id, body)]);
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    expect([a.status, b.status].filter((s) => s === 409 || s === 422)).toHaveLength(1);
    expect(await balanceOf(o.userId)).toBe(1000);
  });

  it('même Idempotency-Key rejouée sur un partiel : un seul crédit', async () => {
    const o = await paidOrder(created);
    const headers = { 'idempotency-key': randomUUID() };
    await refund(o.id, { amount_xaf: 300, reason: 'Partiel unique' }, headers);
    await refund(o.id, { amount_xaf: 300, reason: 'Partiel unique' }, headers);
    expect(await balanceOf(o.userId)).toBe(300);
    expect(await refundsOf(o.id)).toHaveLength(1);
  });

  it('commande inconnue : 404 ORDER_NOT_FOUND', async () => {
    const id = randomUUID();
    const res = await refund(id, { amount_xaf: 100, reason: 'Inconnue' });
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('ORDER_NOT_FOUND');
  });

  it('commande terminée : refusée en 409, aucun changement', async () => {
    const o = await paidOrder(created, { status: 'completed' });
    const res = await refund(o.id, { amount_xaf: 100, reason: 'Terminée' });
    expect(res.status).toBe(409);
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('aucun texte de la réponse ne parle de Mobile Money', async () => {
    const o = await paidOrder(created);
    const ok = await refund(o.id, { amount_xaf: 100, reason: 'Texte neutre' });
    const bad = await refund(o.id, { amount_xaf: 99_999, reason: 'Trop' });
    for (const r of [ok, bad]) expect(JSON.stringify(await r.json())).not.toMatch(NO_MONEY_TEXT);
  });

  it('la trace audit_log est écrite avec le motif', async () => {
    const o = await paidOrder(created);
    await refund(o.id, { amount_xaf: 100, reason: 'Trace attendue' });
    const rows = await auditRows('refund_order', o.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details).toMatchObject({ amount_xaf: 100, reason: 'Trace attendue' });
  });
});
