import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/* Annulation par le client : faux client Supabase en mémoire, faux fournisseur. */
const h = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  rpc: vi.fn(),
  updates: [] as unknown[],
  provider: { cancel: vi.fn(), status: vi.fn() },
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
  vi.mocked(notifyOwner).mockClear();
  h.updates.length = 0;
  h.rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  h.provider.cancel.mockReset().mockResolvedValue(true);
  h.provider.status
    .mockReset()
    .mockResolvedValue({ 555: { status: 'Pending', start_count: 0, remains: 10 } });
  h.tables = { orders: order(), services: { cancel: true } };
});

const patchWith = (key: string, value: unknown) =>
  h.updates.some((u) => (u as Record<string, unknown>)[key] === value);

describe('cancelOrder (aucun remboursement automatique, décision du 2026-11-27)', () => {
  it('fournisseur « Pending » : annulation acceptée, commande mise en examen, AUCUN mouvement d argent', async () => {
    await expect(cancelOrder('u1', ID)).resolves.toEqual({
      refunded: false,
      status: 'to_review',
    });
    expect(h.provider.cancel).toHaveBeenCalledWith(555);
    expect(patchWith('status', 'to_review')).toBe(true);
    expect(h.updates.some((u) => 'cancel_requested_at' in (u as object))).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('alerte le propriétaire : demande d annulation à examiner', async () => {
    await cancelOrder('u1', ID);
    expect(notifyOwner).toHaveBeenCalledWith(
      'order_cancel_requested',
      expect.objectContaining({ order_id: ID }),
    );
  });

  it('n expose plus de fonction de remboursement automatique', async () => {
    const mod = (await import('@/server/orders/cancel-order')) as Record<string, unknown>;
    expect(mod.refundCanceled).toBeUndefined();
  });

  it('commande déjà démarrée (reste < quantité) : refusée, aucun appel fournisseur, aucun mouvement', async () => {
    h.tables.orders = order({ remains: 6, start_count: 100 });
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('fournisseur « In progress » (même sans rien livré) : refusée, aucun appel cancel', async () => {
    h.provider.status.mockResolvedValue({ 555: { status: 'In progress', remains: 10 } });
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('service sans annulation : refusée', async () => {
    h.tables.services = { cancel: false };
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('le fournisseur refuse : ni examen ni alerte ni mouvement', async () => {
    h.provider.cancel.mockResolvedValue(false);
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(patchWith('status', 'to_review')).toBe(false);
    expect(notifyOwner).not.toHaveBeenCalled();
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

  it('demande déjà faite mais commande pas encore en examen : mise en examen sans rappeler le fournisseur ni rembourser', async () => {
    h.tables.orders = order({ cancel_requested_at: '2026-11-17T10:00:00Z' });
    await expect(cancelOrder('u1', ID)).resolves.toEqual({ refunded: false, status: 'to_review' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(patchWith('status', 'to_review')).toBe(true);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('double clic (déjà en examen avec demande) : succès idempotent, pas de 2e alerte, pas de mouvement', async () => {
    h.tables.orders = order({
      status: 'to_review',
      cancel_requested_at: '2026-11-17T10:00:00Z',
    });
    await expect(cancelOrder('u1', ID)).resolves.toEqual({ refunded: false, status: 'to_review' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(notifyOwner).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
