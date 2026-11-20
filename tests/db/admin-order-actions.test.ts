import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import { ROUTES, auditRows, callRoute, failAuditFor, paidOrder } from '../helpers/admin-phase12';
import type { ErrorBody } from '../helpers/client-area-db';
import {
  balanceOf,
  cleanupUsers,
  makeFakeProvider,
  nextProviderOrderId,
  type FakeProvider,
} from '../helpers/orders-db';
import { reloadOrder } from '../helpers/sync-orders';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const h = vi.hoisted(() => ({ provider: null as unknown as FakeProvider }));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

import { recoverStuckOrders } from '@/server/orders/recover-stuck-orders';
import { syncOrderStatuses } from '@/server/orders/sync-order-statuses';

/*
 * Actions admin sur une commande : annuler une commande en cours, renvoyer, clôturer (phase 12, décisions 1, 1b, « Mes choix »).
 *   POST /admin/orders/{id}/cancel { reason }                      -> 200 { order_status: 'to_review' }
 *   POST /admin/orders/{id}/resend { confirm_verified: true, reason } -> 200 { order_status: 'in_progress' }
 *   POST /admin/orders/{id}/close  { reason }                      -> 200 { order_status: 'completed' }
 * Annuler : la demande part AUSSI au fournisseur (cancel(provider_order_id)) ; la commande passe en to_review,
 *   AUCUN remboursement automatique (l'admin rembourse ensuite la part non livrée avec /refund).
 * Renvoyer : seulement une commande to_review jamais renvoyée ; une seule fois (409 ALREADY_RESENT) ; provider.add
 *   appelé une seule fois même en double clic ; jamais appelé par la synchro ni par la reprise des envois bloqués.
 * Clôturer : to_review -> completed, motif obligatoire, aucun mouvement d'argent.
 * Chaque action écrit audit_log (cancel_order, resend_order, close_order) avec le motif, dans la même transaction que le changement.
 */
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const code = async (r: Response) => ((await r.json()) as ErrorBody).error.code;
const act = (route: string, name: string, id: string, body: unknown) =>
  callRoute(route, 'POST', `/api/v1/admin/orders/${id}/${name}`, { body, id });
const cancel = (id: string, body: unknown = { reason: 'Client bloqué, arrêt demandé' }) =>
  act(ROUTES.cancel, 'cancel', id, body);
const resend = (
  id: string,
  body: unknown = { confirm_verified: true, reason: 'Rien envoyé chez le fournisseur' },
) => act(ROUTES.resend, 'resend', id, body);
const close = (id: string, body: unknown = { reason: 'Livrée, vérifiée chez le fournisseur' }) =>
  act(ROUTES.close, 'close', id, body);

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => admin.release());
beforeEach(() => {
  h.provider = makeFakeProvider(100);
  (h.provider as unknown as { cancel: unknown }).cancel = vi.fn(async () => true);
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  await cleanupUsers(created);
});
const providerCancel = () => (h.provider as unknown as { cancel: ReturnType<typeof vi.fn> }).cancel;

describe('annulation d’une commande en cours par l’admin', () => {
  it('envoie l’annulation au fournisseur, passe en to_review, ne touche pas au solde', async () => {
    const o = await paidOrder(created, { status: 'in_progress' });
    const res = await cancel(o.id);
    expect(res.status).toBe(200);
    expect(providerCancel()).toHaveBeenCalledTimes(1);
    expect(providerCancel()).toHaveBeenCalledWith(o.providerOrderId);
    expect((await reloadOrder(o.id)).status).toBe('to_review');
    expect(await balanceOf(o.userId)).toBe(0);
    expect(await auditRows('cancel_order', o.id)).toHaveLength(1);
  });

  it('le fournisseur refuse : 409 ORDER_NOT_CANCELLABLE, commande inchangée', async () => {
    providerCancel().mockResolvedValue(false);
    const o = await paidOrder(created, { status: 'in_progress' });
    const res = await cancel(o.id);
    expect(res.status).toBe(409);
    expect(await code(res)).toBe('ORDER_NOT_CANCELLABLE');
    expect((await reloadOrder(o.id)).status).toBe('in_progress');
    expect(await auditRows('cancel_order', o.id)).toHaveLength(0);
  });

  it('fournisseur en panne : erreur 5xx, commande inchangée, aucun argent', async () => {
    providerCancel().mockRejectedValue(new Error('PROVIDER_TIMEOUT'));
    const o = await paidOrder(created, { status: 'in_progress' });
    const res = await cancel(o.id);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect((await reloadOrder(o.id)).status).toBe('in_progress');
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('double clic : l’annulation n’est envoyée qu’une fois au fournisseur', async () => {
    const o = await paidOrder(created, { status: 'in_progress' });
    await Promise.all([cancel(o.id), cancel(o.id)]);
    expect(providerCancel()).toHaveBeenCalledTimes(1);
  });

  it.each(['completed', 'refunded'])('commande « %s » : 409, rien n’est envoyé', async (status) => {
    const o = await paidOrder(created, { status });
    expect((await cancel(o.id)).status).toBe(409);
    expect(providerCancel()).not.toHaveBeenCalled();
  });

  it('motif obligatoire : 400, rien n’est envoyé', async () => {
    const o = await paidOrder(created, { status: 'in_progress' });
    expect((await cancel(o.id, {})).status).toBe(400);
    expect(providerCancel()).not.toHaveBeenCalled();
  });

  it('la synchro ne rembourse jamais seule après cette annulation (fournisseur « Canceled »)', async () => {
    const o = await paidOrder(created, { status: 'in_progress' });
    await cancel(o.id);
    h.provider.status.mockImplementation(async () => ({
      [o.providerOrderId]: { status: 'Canceled', start_count: 0, remains: 1000 },
    }));
    await syncOrderStatuses();
    expect((await reloadOrder(o.id)).status).toBe('to_review');
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('atomique : si la trace échoue, la commande reste en cours', async () => {
    const o = await paidOrder(created, { status: 'in_progress' });
    const restore = failAuditFor(['cancel_order']);
    try {
      const res = await cancel(o.id);
      expect(res.status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    expect((await reloadOrder(o.id)).status).toBe('in_progress');
  });
});

describe('renvoi manuel confirmé', () => {
  it('renvoie la commande une seule fois : add appelé avec service, lien, quantité ; nouvelle référence enregistrée', async () => {
    const o = await paidOrder(created);
    const newId = nextProviderOrderId();
    h.provider.add.mockResolvedValue({ order: newId });
    const res = await resend(o.id);
    expect(res.status).toBe(200);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(h.provider.add).toHaveBeenCalledWith(
      expect.objectContaining({ service: o.serviceId, quantity: 1000 }),
    );
    expect(await reloadOrder(o.id)).toMatchObject({
      status: 'in_progress',
      provider_order_id: newId,
    });
    expect(await balanceOf(o.userId)).toBe(0);
    expect(await auditRows('resend_order', o.id)).toHaveLength(1);
  });

  it.each([
    { confirm_verified: false, reason: 'Rien envoyé' },
    { reason: 'Rien envoyé' },
    { confirm_verified: true },
  ])('sans la case « j’ai vérifié » ou sans motif (%j) : 400, add jamais appelé', async (body) => {
    const o = await paidOrder(created);
    expect((await resend(o.id, body)).status).toBe(400);
    expect(h.provider.add).not.toHaveBeenCalled();
    expect((await reloadOrder(o.id)).status).toBe('to_review');
  });

  it('un deuxième renvoi est refusé : 409 ALREADY_RESENT, add n’est pas rappelé', async () => {
    const o = await paidOrder(created);
    await resend(o.id);
    // La commande échoue de nouveau chez le fournisseur et revient à examiner.
    await adminClient().from('orders').update({ status: 'to_review' }).eq('id', o.id);
    const second = await resend(o.id);
    expect(second.status).toBe(409);
    expect(await code(second)).toBe('ALREADY_RESENT');
    expect(h.provider.add).toHaveBeenCalledTimes(1);
  });

  it('double clic (deux requêtes simultanées) : add appelé une seule fois', async () => {
    const o = await paidOrder(created);
    const [a, b] = await Promise.all([resend(o.id), resend(o.id)]);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
  });

  it.each(['completed', 'refunded', 'in_progress', 'pending'])(
    'commande « %s » : refusée en 409, add jamais appelé',
    async (status) => {
      const o = await paidOrder(created, { status });
      expect((await resend(o.id)).status).toBe(409);
      expect(h.provider.add).not.toHaveBeenCalled();
    },
  );

  it('commande déjà partiellement remboursée : jamais renvoyée (le client serait servi deux fois)', async () => {
    const o = await paidOrder(created);
    await adminClient().rpc('refund_order', {
      p_order: o.id,
      p_amount: 300,
      p_admin: admin.id,
      p_reason: 'Partiel',
    });
    expect((await resend(o.id)).status).toBe(409);
    expect(h.provider.add).not.toHaveBeenCalled();
  });

  it('commande inconnue : 404 ORDER_NOT_FOUND', async () => {
    const res = await resend(randomUUID());
    expect(res.status).toBe(404);
    expect(await code(res)).toBe('ORDER_NOT_FOUND');
  });

  it('le fournisseur échoue pendant le renvoi : une seule tentative, aucune reprise automatique', async () => {
    h.provider.add.mockRejectedValue(new Error('PROVIDER_TIMEOUT'));
    const o = await paidOrder(created);
    const res = await resend(o.id);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(await balanceOf(o.userId)).toBe(0);
  });

  it('jamais automatique : synchro et reprise des envois bloqués n’appellent jamais add pour une commande to_review', async () => {
    const o = await paidOrder(created);
    h.provider.status.mockImplementation(async () => ({}));
    await syncOrderStatuses();
    await recoverStuckOrders();
    expect(h.provider.add).not.toHaveBeenCalled();
    expect((await reloadOrder(o.id)).status).toBe('to_review');
  });
});

describe('clôture to_review -> completed', () => {
  it('clôture avec motif : completed, aucun mouvement d’argent, trace écrite', async () => {
    const o = await paidOrder(created);
    const res = await close(o.id);
    expect(res.status).toBe(200);
    expect((await reloadOrder(o.id)).status).toBe('completed');
    expect(await balanceOf(o.userId)).toBe(0);
    const rows = await auditRows('close_order', o.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details).toMatchObject({ reason: 'Livrée, vérifiée chez le fournisseur' });
  });

  it.each([{}, { reason: '' }, { reason: '   ' }])(
    'motif manquant (%j) : 400, commande inchangée',
    async (body) => {
      const o = await paidOrder(created);
      expect((await close(o.id, body)).status).toBe(400);
      expect((await reloadOrder(o.id)).status).toBe('to_review');
    },
  );

  it.each(['completed', 'refunded', 'in_progress', 'pending', 'canceled'])(
    'commande « %s » : 409, rien ne change',
    async (status) => {
      const o = await paidOrder(created, { status });
      expect((await close(o.id)).status).toBe(409);
      expect((await reloadOrder(o.id)).status).toBe(status);
    },
  );

  it('double clic : une seule clôture réussit', async () => {
    const o = await paidOrder(created);
    const [a, b] = await Promise.all([close(o.id), close(o.id)]);
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    expect(await auditRows('close_order', o.id)).toHaveLength(1);
  });

  it('atomique : si la trace échoue, la commande reste à examiner', async () => {
    const o = await paidOrder(created);
    const restore = failAuditFor(['close_order']);
    try {
      expect((await close(o.id)).status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    expect((await reloadOrder(o.id)).status).toBe('to_review');
  });
});
