import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import {
  balanceOf,
  cleanupUsers,
  makeFakeProvider,
  makeFollowersService,
  makeFundedUser,
  nextProviderOrderId,
  type FakeProvider,
} from '../helpers/orders-db';
import { inProgressOrder, reloadOrder, stuckOrder } from '../helpers/sync-orders';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ provider: null as unknown as FakeProvider }));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { recoverStuckOrders } from '@/server/orders/recover-stuck-orders';
import { syncOrderStatuses } from '@/server/orders/sync-order-statuses';
import { notifyOwner } from '@/server/providers/telegram';

/*
 * Signatures attendues (plan phase 7) :
 *   src/server/orders/sync-order-statuses.ts  : syncOrderStatuses(): Promise<unknown>
 *   src/server/orders/recover-stuck-orders.ts : recoverStuckOrders(): Promise<unknown>
 * Fournisseur : status(ids: number[]) -> { [id]: { status, start_count, remains, ... } }, un appel par lot de 100.
 * 'Pending' | 'In progress' -> in_progress ; 'Completed' -> completed ;
 * 'Partial' | 'Canceled' | inconnu -> to_review + UNE alerte 'order_failed' (orders.alerted_at), sans remboursement.
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
const askedIds = () => h.provider.status.mock.calls.flatMap((c: number[][]) => c[0]!);

beforeEach(() => {
  h.provider = makeFakeProvider(100);
  vi.mocked(notifyOwner).mockClear();
});
afterEach(async () => {
  // Non-pollution : les commandes de CES utilisateurs passent à un statut final (pas de suppression).
  if (created.length) {
    await adminClient()
      .from('orders')
      .update({ status: 'canceled' })
      .in('user_id', created)
      .in('status', ['pending', 'in_progress']);
  }
  await cleanupUsers(created);
});

describe('syncOrderStatuses', () => {
  it('passe une commande de in_progress à completed', async () => {
    const o = await inProgressOrder(created);
    answer({ [o.providerOrderId]: { status: 'Completed', start_count: 40, remains: 0 } });
    await syncOrderStatuses();
    expect(await reloadOrder(o.id)).toMatchObject({ status: 'completed', remains: 0 });
  });

  it('laisse en in_progress une commande « Pending » chez le fournisseur', async () => {
    const o = await inProgressOrder(created);
    answer({ [o.providerOrderId]: { status: 'Pending', start_count: 0, remains: 1000 } });
    await syncOrderStatuses();
    expect(await reloadOrder(o.id)).toMatchObject({ status: 'in_progress' });
  });

  it('met à jour start_count et remains pendant l exécution', async () => {
    const o = await inProgressOrder(created);
    answer({ [o.providerOrderId]: { status: 'In progress', start_count: 120, remains: 400 } });
    await syncOrderStatuses();
    expect(await reloadOrder(o.id)).toMatchObject({
      status: 'in_progress',
      start_count: 120,
      remains: 400,
    });
  });

  it.each(['Partial', 'Canceled'])(
    '%s : to_review, une alerte order_failed, aucun remboursement ni écriture de solde',
    async (providerStatus) => {
      const o = await inProgressOrder(created);
      const before = await balanceOf(o.userId);
      answer({ [o.providerOrderId]: { status: providerStatus, start_count: 10, remains: 300 } });
      await syncOrderStatuses();
      const row = await reloadOrder(o.id);
      expect(row).toMatchObject({ status: 'to_review' });
      expect(row.alerted_at).not.toBeNull();
      expect(alertsFor(o.id)).toHaveLength(1);
      expect(notifyOwner).toHaveBeenCalledWith(
        'order_failed',
        expect.objectContaining({ order_id: o.id }),
      );
      expect(await balanceOf(o.userId)).toBe(before);
      const { data: tx } = await adminClient()
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', o.userId);
      expect(tx).toHaveLength(0);
    },
  );

  it('statut inconnu : to_review et alerte (jamais ignoré)', async () => {
    const o = await inProgressOrder(created);
    answer({ [o.providerOrderId]: { status: 'Banane', remains: 1000 } });
    await syncOrderStatuses();
    expect(await reloadOrder(o.id)).toMatchObject({ status: 'to_review' });
    expect(alertsFor(o.id)).toHaveLength(1);
  });

  it('pas de 2e alerte au 2e passage (orders.alerted_at)', async () => {
    const o = await inProgressOrder(created);
    answer({ [o.providerOrderId]: { status: 'Partial', remains: 300 } });
    await syncOrderStatuses();
    await syncOrderStatuses();
    expect(alertsFor(o.id)).toHaveLength(1);
  });

  it('ne relit plus les commandes completed ni to_review', async () => {
    const done = await inProgressOrder(created, { status: 'completed', remains: 0 });
    const review = await inProgressOrder(created, { status: 'to_review' });
    answer({
      [done.providerOrderId]: { status: 'Pending', remains: 1000 },
      [review.providerOrderId]: { status: 'Completed', remains: 0 },
    });
    await syncOrderStatuses();
    expect(askedIds()).not.toContain(done.providerOrderId);
    expect(askedIds()).not.toContain(review.providerOrderId);
    expect(await reloadOrder(done.id)).toMatchObject({ status: 'completed' });
    expect(await reloadOrder(review.id)).toMatchObject({ status: 'to_review' });
  });

  it('rejouable : un 2e passage ne change rien de plus', async () => {
    const o = await inProgressOrder(created);
    answer({ [o.providerOrderId]: { status: 'Completed', start_count: 5, remains: 0 } });
    await syncOrderStatuses();
    const first = await reloadOrder(o.id);
    await syncOrderStatuses();
    expect(await reloadOrder(o.id)).toEqual(first);
    expect(alertsFor(o.id)).toHaveLength(0);
  });

  it('250 commandes : lots de 100 au plus, tous les in_progress couverts, ceil(total/100) appels', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 0 });
    const rows = Array.from({ length: 250 }, (_, i) => ({
      user_id: u.id,
      service_id: s.id,
      link: 'https://www.tiktok.com/@client_test',
      quantity: 100,
      price_xaf_1000: 1155,
      discount_pct: 0,
      charged_xaf: 116,
      cost_usd: 0.04,
      idem_key: `batch-${u.id}-${i}`,
      status: 'in_progress',
      provider_order_id: nextProviderOrderId(),
    }));
    const { error } = await adminClient().from('orders').insert(rows);
    expect(error).toBeNull();
    const { count } = await adminClient()
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'in_progress')
      .not('provider_order_id', 'is', null);
    const total = count ?? 0;
    expect(total).toBeGreaterThanOrEqual(250);
    answer({});
    await syncOrderStatuses();
    const sizes = h.provider.status.mock.calls.map((c: number[][]) => c[0]!.length);
    expect(sizes.every((n: number) => n >= 1 && n <= 100)).toBe(true);
    expect(sizes.reduce((a: number, n: number) => a + n, 0)).toBe(total);
    expect(sizes).toHaveLength(Math.ceil(total / 100));
    for (const r of rows) expect(askedIds()).toContain(r.provider_order_id);
  });

  it('ne touche pas une commande pending', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 0 });
    const p = await makeOrder(u.id, s.id, { status: 'pending' });
    answer({});
    await syncOrderStatuses();
    expect(await reloadOrder(p.id)).toMatchObject({ status: 'pending' });
  });
});

describe('recoverStuckOrders', () => {
  it('commande en envoi depuis plus de 5 min : to_review + une alerte, aucun provider.add', async () => {
    const o = await stuckOrder(created, 6);
    await recoverStuckOrders();
    const row = await reloadOrder(o.id);
    expect(row).toMatchObject({ status: 'to_review' });
    expect(row.alerted_at).not.toBeNull();
    expect(alertsFor(o.id)).toHaveLength(1);
    expect(notifyOwner).toHaveBeenCalledWith(
      'order_failed',
      expect.objectContaining({ order_id: o.id }),
    );
    expect(h.provider.add).toHaveBeenCalledTimes(0);
  });

  it('commande en envoi depuis moins de 5 min : intacte, aucune alerte', async () => {
    const o = await stuckOrder(created, 4);
    await recoverStuckOrders();
    expect(await reloadOrder(o.id)).toMatchObject({ status: 'pending', error: 'submitting' });
    expect(alertsFor(o.id)).toHaveLength(0);
    expect(h.provider.add).toHaveBeenCalledTimes(0);
  });

  it('une seule alerte même après plusieurs passages, et aucun solde touché', async () => {
    const o = await stuckOrder(created, 30);
    const before = await balanceOf(o.userId);
    await recoverStuckOrders();
    await recoverStuckOrders();
    expect(alertsFor(o.id)).toHaveLength(1);
    expect(h.provider.add).toHaveBeenCalledTimes(0);
    expect(await balanceOf(o.userId)).toBe(before);
  });

  it('ignore une commande pending sans marque « submitting »', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 0 });
    const at = new Date(Date.now() - 60 * 60_000).toISOString();
    const o = await makeOrder(u.id, s.id, { status: 'pending', created_at: at, updated_at: at });
    await recoverStuckOrders();
    expect(await reloadOrder(o.id)).toMatchObject({ status: 'pending' });
    expect(alertsFor(o.id)).toHaveLength(0);
  });
});
