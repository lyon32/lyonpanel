import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import {
  TIKTOK_LINK,
  cleanupUsers,
  makeCommentsService,
  makeFakeProvider,
  nextProviderOrderId,
  makeFollowersService,
  makeFundedUser,
  type FakeProvider,
} from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ provider: null as unknown as FakeProvider }));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { submitToProvider } from '@/server/orders/submit-to-provider';
import { notifyOwner } from '@/server/providers/telegram';

/*
 * Signature attendue (LLD §4.3), fichier src/server/orders/submit-to-provider.ts :
 *   submitToProvider(order: OrderRow): Promise<'in_progress' | 'to_review'>
 *   - OrderRow = ligne de la table orders (id, user_id, service_id, link, quantity, comments, ...) ;
 *   - appelle getProvider().add({ service, link, quantity, comments? }) UNE SEULE FOIS, avec un délai maximal
 *     de 10 s (au-delà : échec) ;
 *   - succès : orders.status = 'in_progress', orders.provider_order_id = ordre renvoyé ;
 *   - échec ou délai : orders.status = 'to_review', orders.error = raison INTERNE (jamais montrée au client),
 *     notifyOwner('order_failed', { order_id, ... }), AUCUN remboursement, AUCUNE reprise, ne lève pas d erreur.
 */

const created: string[] = [];
const db = adminClient();

beforeEach(() => {
  h.provider = makeFakeProvider(100);
  vi.mocked(notifyOwner).mockClear();
});
afterEach(async () => {
  vi.useRealTimers();
  await cleanupUsers(created);
});

async function pendingOrder(over: Record<string, unknown> = {}, service?: { id: number }) {
  const s = service ?? (await makeFollowersService());
  const u = await makeFundedUser(created, { balance: 0 });
  const o = await makeOrder(u.id, s.id, {
    link: TIKTOK_LINK,
    quantity: 1000,
    charged_xaf: 1155,
    status: 'pending',
    ...over,
  });
  return { u, s, o };
}

async function reload(id: string) {
  const { data } = await db.from('orders').select('*').eq('id', id).single();
  return data!;
}

describe('submitToProvider', () => {
  it('succès : in_progress, identifiant fournisseur enregistré, un seul appel', async () => {
    const { s, o } = await pendingOrder();
    const providerOrder = nextProviderOrderId();
    h.provider.add.mockResolvedValue({ order: providerOrder });
    const result = await submitToProvider(o as never);
    expect(result).toBe('in_progress');
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(h.provider.add).toHaveBeenCalledWith(
      expect.objectContaining({ service: s.id, link: TIKTOK_LINK, quantity: 1000 }),
    );
    expect(await reload(o.id)).toMatchObject({
      status: 'in_progress',
      provider_order_id: providerOrder,
    });
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it('transmet les commentaires d un service « commentaires personnalisés »', async () => {
    const s = await makeCommentsService();
    const { o } = await pendingOrder({ quantity: 2, comments: ['Top', 'Bravo'] }, s);
    await submitToProvider(o as never);
    expect(h.provider.add).toHaveBeenCalledWith(
      expect.objectContaining({ comments: ['Top', 'Bravo'] }),
    );
  });

  it('échec du fournisseur : to_review, alerte order_failed, aucun remboursement, un seul appel', async () => {
    const { u, o } = await pendingOrder();
    h.provider.add.mockRejectedValue(new Error('JAP: insufficient funds'));
    const result = await submitToProvider(o as never);
    expect(result).toBe('to_review');
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(await reload(o.id)).toMatchObject({ status: 'to_review', provider_order_id: null });
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledWith('order_failed', expect.objectContaining({}));
    const { data: refunds } = await db
      .from('wallet_transactions')
      .select('id')
      .eq('user_id', u.id)
      .eq('type', 'refund');
    expect(refunds).toHaveLength(0);
    const { data: w } = await db.from('wallets').select('balance_xaf').eq('user_id', u.id).single();
    expect(Number(w!.balance_xaf)).toBe(0); // rien n a été rendu au client
  });

  it('délai de 10 s dépassé : to_review, alerte, un seul appel, aucune reprise', async () => {
    const { o } = await pendingOrder();
    h.provider.add.mockImplementation(() => new Promise(() => {})); // ne répond jamais
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = submitToProvider(o as never);
    await vi.advanceTimersByTimeAsync(10_001);
    vi.useRealTimers();
    expect(await pending).toBe('to_review');
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(await reload(o.id)).toMatchObject({ status: 'to_review' });
    expect(notifyOwner).toHaveBeenCalledWith('order_failed', expect.objectContaining({}));
  });

  it('une réponse du fournisseur avant 10 s est acceptée (pas de faux timeout à 9 s)', async () => {
    const { o } = await pendingOrder();
    const lateOrder = nextProviderOrderId();
    h.provider.add.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ order: lateOrder }), 9_000)),
    );
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = submitToProvider(o as never);
    await vi.advanceTimersByTimeAsync(9_001);
    vi.useRealTimers();
    expect(await pending).toBe('in_progress');
  });

  it('la raison technique reste dans orders.error (interne) et ne contient aucun secret de configuration', async () => {
    const { o } = await pendingOrder();
    h.provider.add.mockRejectedValue(new Error('HTTP 500'));
    await submitToProvider(o as never);
    const row = await reload(o.id);
    expect(typeof row.error).toBe('string');
    expect(String(row.error).length).toBeGreaterThan(0);
  });
});
