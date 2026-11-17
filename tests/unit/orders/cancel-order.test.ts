import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/* Annulation par le client : faux client Supabase en mémoire, faux fournisseur. */
const h = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  rpc: vi.fn(),
  updates: [] as unknown[],
  provider: { cancel: vi.fn() },
}));

function chain(table: string, op: { update: boolean }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is']) c[m] = () => c;
  c.update = (patch: unknown) => {
    h.updates.push(patch);
    return chain(table, { update: true });
  };
  const result = () => ({ data: op.update ? null : (h.tables[table] ?? null), error: null });
  c.maybeSingle = async () => result();
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
  return c;
}
vi.mock('@/server/db/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (t: string) => chain(t, { update: false }),
    rpc: h.rpc,
  }),
}));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { cancelOrder } from '@/server/orders/cancel-order';
import { notifyOwner } from '@/server/providers/telegram';

const ID = '11111111-1111-4111-8111-111111111111';
const order = (o: Record<string, unknown> = {}) => ({
  id: ID,
  short_id: '1',
  user_id: 'u1',
  service_id: 7,
  quantity: 10,
  charged_xaf: 90,
  status: 'in_progress',
  start_count: 0,
  remains: 10,
  provider_order_id: 555,
  cancel_requested_at: null,
  ...o,
});

beforeEach(() => {
  h.updates.length = 0;
  h.rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  h.provider.cancel.mockReset().mockResolvedValue(true);
  h.tables = { orders: order(), services: { cancel: true } };
});

describe('cancelOrder', () => {
  it('commande pas démarrée : le fournisseur accepte, remboursement intégral', async () => {
    await expect(cancelOrder('u1', ID)).resolves.toEqual({ refunded: true });
    expect(h.provider.cancel).toHaveBeenCalledWith(555);
    expect(h.rpc).toHaveBeenCalledWith('refund_canceled_order', { p_order: ID });
  });

  it('commande déjà démarrée (reste < quantité) : refusée, aucun appel fournisseur, aucun remboursement', async () => {
    h.tables.orders = order({ remains: 6, start_count: 100 });
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('service sans annulation : refusée', async () => {
    h.tables.services = { cancel: false };
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('le fournisseur refuse : aucun remboursement', async () => {
    h.provider.cancel.mockResolvedValue(false);
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('commande d un autre client ou inconnue : introuvable', async () => {
    h.tables.orders = null;
    await expect(cancelOrder('u2', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' });
    await expect(cancelOrder('u1', 'pas-un-uuid')).rejects.toMatchObject({
      code: 'ORDER_NOT_FOUND',
    });
  });

  it('déjà remboursée : 409, rien n est rejoué', async () => {
    h.tables.orders = order({ status: 'refunded' });
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ALREADY_REFUNDED' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
  });

  it('demande déjà faite mais remboursement manqué : on retente le remboursement sans rappeler le fournisseur', async () => {
    h.tables.orders = order({ cancel_requested_at: '2026-11-17T10:00:00Z' });
    await expect(cancelOrder('u1', ID)).resolves.toEqual({ refunded: true });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it('remboursement qui échoue après accord du fournisseur : refunded false, alerte, pas d erreur client', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(cancelOrder('u1', ID)).resolves.toEqual({ refunded: false });
    expect(notifyOwner).toHaveBeenCalledWith(
      'internal_error',
      expect.objectContaining({ order_id: ID }),
    );
  });
});
