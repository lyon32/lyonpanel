import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { balanceOf, cleanupUsers, makeFakeProvider, type FakeProvider } from '../helpers/orders-db';
import { inProgressOrder, reloadOrder } from '../helpers/sync-orders';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ provider: null as unknown as FakeProvider }));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { syncOrderStatuses } from '@/server/orders/sync-order-statuses';
import { notifyOwner } from '@/server/providers/telegram';

/*
 * Synchro des statuts avec le fournisseur (phase 12, décisions 1b et 1c). Même signature :
 *   syncOrderStatuses(): Promise<{ checked, completed, flagged, refunded, failedBatches, missing }>
 * Nouveau : `missing` = nombre de commandes absentes de la réponse du fournisseur.
 * Règles :
 *   Pending -> état client « pending » (annulable) ; In progress -> « in_progress » (non annulable par le client) ;
 *   la synchro suit aussi les commandes « pending » qui ont un numéro fournisseur ;
 *   Completed -> completed ; Partial / Canceled / inconnu -> to_review (une alerte) ;
 *   commande absente de la réponse : alerte (jamais d'oubli silencieux), pas de déplacement d'argent.
 */

const created: string[] = [];
type St = { status: string; start_count?: number; remains?: number };
function answer(map: Record<number, St>) {
  h.provider.status.mockImplementation(async (ids: number[]) => {
    const out: Record<number, St> = {};
    for (const id of ids) if (map[id]) out[id] = { ...map[id] };
    return out;
  });
}
const alertsFor = (id: string) =>
  vi.mocked(notifyOwner).mock.calls.filter((c) => (c[1] as { order_id?: string })?.order_id === id);

beforeEach(() => {
  h.provider = makeFakeProvider(100);
  vi.mocked(notifyOwner).mockClear();
});
afterEach(async () => {
  if (created.length) {
    await adminClient()
      .from('orders')
      .update({ status: 'canceled' })
      .in('user_id', created)
      .in('status', ['pending', 'in_progress']);
  }
  await cleanupUsers(created);
});

describe('syncOrderStatuses : en attente / en cours', () => {
  it('fournisseur « Pending » : la commande devient « pending » chez le client (annulable)', async () => {
    const o = await inProgressOrder(created);
    answer({ [o.providerOrderId]: { status: 'Pending', start_count: 0, remains: 1000 } });
    await syncOrderStatuses();
    expect(await reloadOrder(o.id)).toMatchObject({ status: 'pending', remains: 1000 });
  });

  it('fournisseur « In progress » : la commande devient « in_progress »', async () => {
    const o = await inProgressOrder(created, { status: 'pending' });
    answer({ [o.providerOrderId]: { status: 'In progress', start_count: 5, remains: 900 } });
    await syncOrderStatuses();
    expect(await reloadOrder(o.id)).toMatchObject({
      status: 'in_progress',
      start_count: 5,
      remains: 900,
    });
  });

  it('suit aussi les commandes « pending » qui ont un numéro fournisseur : Completed -> completed', async () => {
    const o = await inProgressOrder(created, { status: 'pending' });
    answer({ [o.providerOrderId]: { status: 'Completed', start_count: 0, remains: 0 } });
    await syncOrderStatuses();
    expect((await reloadOrder(o.id)).status).toBe('completed');
  });

  it('commande « pending » SANS numéro fournisseur (envoi en cours) : jamais interrogée', async () => {
    const o = await inProgressOrder(created, { status: 'pending', provider_order_id: null });
    answer({});
    await syncOrderStatuses();
    const asked = h.provider.status.mock.calls.flatMap((c: number[][]) => c[0]!);
    expect(asked).not.toContain(o.providerOrderId);
    expect((await reloadOrder(o.id)).status).toBe('pending');
  });

  it('une commande « pending » qui passe « Partial » va en to_review avec une alerte, sans argent', async () => {
    const o = await inProgressOrder(created, { status: 'pending' });
    const before = await balanceOf(o.userId);
    answer({ [o.providerOrderId]: { status: 'Partial', start_count: 10, remains: 300 } });
    await syncOrderStatuses();
    expect((await reloadOrder(o.id)).status).toBe('to_review');
    expect(alertsFor(o.id)).toHaveLength(1);
    expect(await balanceOf(o.userId)).toBe(before);
  });

  it.each(['Canceled', 'Partial', 'Statut-inconnu'])(
    'fournisseur « %s » sur une commande en cours : to_review, une seule alerte même si la synchro repasse',
    async (status) => {
      const o = await inProgressOrder(created);
      answer({ [o.providerOrderId]: { status, start_count: 0, remains: 1000 } });
      await syncOrderStatuses();
      await syncOrderStatuses();
      expect((await reloadOrder(o.id)).status).toBe('to_review');
      expect(alertsFor(o.id)).toHaveLength(1);
    },
  );
});

describe('syncOrderStatuses : commande absente de la réponse du fournisseur', () => {
  it('alerte le propriétaire, compte la commande dans `missing`, ne déplace aucun argent', async () => {
    const o = await inProgressOrder(created);
    const before = await balanceOf(o.userId);
    answer({}); // le fournisseur ne connaît plus ce numéro
    const counters = (await syncOrderStatuses()) as unknown as { missing: number };
    expect(counters.missing).toBeGreaterThanOrEqual(1);
    expect(alertsFor(o.id).length).toBeGreaterThanOrEqual(1);
    const row = await reloadOrder(o.id);
    expect(['completed', 'refunded', 'canceled']).not.toContain(row.status);
    expect(await balanceOf(o.userId)).toBe(before);
  });

  it('une seule alerte par commande absente, même si la synchro repasse plusieurs fois', async () => {
    const o = await inProgressOrder(created);
    answer({});
    await syncOrderStatuses();
    await syncOrderStatuses();
    await syncOrderStatuses();
    expect(alertsFor(o.id)).toHaveLength(1);
  });

  it('les autres commandes du lot sont traitées normalement', async () => {
    const missing = await inProgressOrder(created);
    const fine = await inProgressOrder(created);
    answer({ [fine.providerOrderId]: { status: 'Completed', start_count: 0, remains: 0 } });
    await syncOrderStatuses();
    expect((await reloadOrder(fine.id)).status).toBe('completed');
    expect(alertsFor(missing.id).length).toBeGreaterThanOrEqual(1);
    expect(alertsFor(fine.id)).toHaveLength(0);
  });
});

describe('syncOrderStatuses : plusieurs clients dans un même lot', () => {
  it('chaque commande reçoit seulement son statut (rangement par numéro fournisseur)', async () => {
    const a = await inProgressOrder(created);
    const b = await inProgressOrder(created);
    const c = await inProgressOrder(created);
    const d = await inProgressOrder(created);
    const e = await inProgressOrder(created, { status: 'pending' });
    const f = await inProgressOrder(created);
    // Réponse volontairement dans un autre ordre que celui des commandes.
    answer({
      [f.providerOrderId]: { status: 'Canceled', start_count: 0, remains: 1000 },
      [d.providerOrderId]: { status: 'Pending', start_count: 0, remains: 1000 },
      [b.providerOrderId]: { status: 'In progress', start_count: 11, remains: 700 },
      [e.providerOrderId]: { status: 'In progress', start_count: 22, remains: 600 },
      [a.providerOrderId]: { status: 'Completed', start_count: 33, remains: 0 },
      [c.providerOrderId]: { status: 'Partial', start_count: 44, remains: 250 },
    });
    await syncOrderStatuses();
    expect(await reloadOrder(a.id)).toMatchObject({
      status: 'completed',
      start_count: 33,
      remains: 0,
    });
    expect(await reloadOrder(b.id)).toMatchObject({
      status: 'in_progress',
      start_count: 11,
      remains: 700,
    });
    expect(await reloadOrder(c.id)).toMatchObject({
      status: 'to_review',
      start_count: 44,
      remains: 250,
    });
    expect(await reloadOrder(d.id)).toMatchObject({
      status: 'pending',
      start_count: 0,
      remains: 1000,
    });
    expect(await reloadOrder(e.id)).toMatchObject({
      status: 'in_progress',
      start_count: 22,
      remains: 600,
    });
    expect(await reloadOrder(f.id)).toMatchObject({
      status: 'to_review',
      start_count: 0,
      remains: 1000,
    });
    // Les alertes ne touchent que les deux commandes en échec.
    expect(alertsFor(a.id)).toHaveLength(0);
    expect(alertsFor(b.id)).toHaveLength(0);
    expect(alertsFor(c.id)).toHaveLength(1);
    expect(alertsFor(f.id)).toHaveLength(1);
  });

  it('les soldes des clients ne changent pas pendant la synchro (aucune écriture d’argent)', async () => {
    const a = await inProgressOrder(created);
    const b = await inProgressOrder(created);
    const [balA, balB] = [await balanceOf(a.userId), await balanceOf(b.userId)];
    answer({
      [a.providerOrderId]: { status: 'Partial', start_count: 1, remains: 5 },
      [b.providerOrderId]: { status: 'Completed', start_count: 1, remains: 0 },
    });
    await syncOrderStatuses();
    expect(await balanceOf(a.userId)).toBe(balA);
    expect(await balanceOf(b.userId)).toBe(balB);
  });
});
