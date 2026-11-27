import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * Annulation par le client décidée sur le STATUT FOURNISSEUR (phase 12, décisions 1b et 1c-b) :
 *   - fournisseur « Pending » (en attente) : le client peut annuler et récupère la somme payée ;
 *   - fournisseur « In progress » (en cours) : annulation refusée, même si rien n'est encore livré ;
 *   - le statut est relu chez le fournisseur au moment du clic (la synchro peut avoir du retard) ;
 *   - fournisseur injoignable : refus prudent, ni annulation ni remboursement.
 * Signature inchangée : cancelOrder(userId, orderId): Promise<{ refunded: boolean }>.
 * Faux client Supabase en mémoire, faux fournisseur (status + cancel).
 */
const h = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  rpc: vi.fn(),
  provider: { cancel: vi.fn(), status: vi.fn() },
}));

function chain(table: string, op: { update: boolean }) {
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is']) c[m] = () => c;
  c.update = () => chain(table, { update: true });
  const result = () => ({ data: op.update ? null : (h.tables[table] ?? null), error: null });
  c.maybeSingle = async () => result();
  c.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
  return c;
}
vi.mock('@/server/db/supabase-admin', () => ({
  createAdminClient: () => ({ from: (t: string) => chain(t, { update: false }), rpc: h.rpc }),
}));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { cancelOrder } from '@/server/orders/cancel-order';

const ID = '11111111-1111-4111-8111-111111111111';
const order = (o: Record<string, unknown> = {}) => ({
  id: ID,
  short_id: '1',
  user_id: 'u1',
  service_id: 7,
  quantity: 10,
  charged_xaf: 90,
  status: 'pending',
  start_count: 0,
  remains: 10,
  provider_order_id: 555,
  cancel_requested_at: null,
  ...o,
});
const providerSays = (status: string) =>
  h.provider.status.mockResolvedValue({ 555: { status, start_count: 0, remains: 10 } });

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({ data: {}, error: null });
  h.provider.cancel.mockReset().mockResolvedValue(true);
  h.provider.status.mockReset();
  h.tables = { orders: order(), services: { cancel: true } };
});

describe('cancelOrder : règle lue sur le statut fournisseur', () => {
  it('en attente chez le fournisseur : annulation acceptée, mise en examen, aucun remboursement', async () => {
    providerSays('Pending');
    await expect(cancelOrder('u1', ID)).resolves.toEqual({ refunded: false, status: 'to_review' });
    expect(h.provider.cancel).toHaveBeenCalledWith(555);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('en cours chez le fournisseur (état local in_progress, rien livré) : refusée, aucun appel d’annulation', async () => {
    h.tables.orders = order({ status: 'in_progress' });
    providerSays('In progress');
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('état local encore « en attente » mais le fournisseur est déjà « en cours » : refusée', async () => {
    providerSays('In progress');
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('fournisseur injoignable : refus prudent, ni annulation ni remboursement', async () => {
    h.provider.status.mockRejectedValue(new Error('PROVIDER_TIMEOUT'));
    await expect(cancelOrder('u1', ID)).rejects.toBeDefined();
    expect(h.provider.cancel).not.toHaveBeenCalled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('commande en attente sans numéro fournisseur (envoi en cours) : refusée sans appel fournisseur', async () => {
    h.tables.orders = order({ provider_order_id: null });
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.provider.status).not.toHaveBeenCalled();
    expect(h.provider.cancel).not.toHaveBeenCalled();
  });

  it('le fournisseur refuse l’annulation d’une commande en attente : aucun remboursement', async () => {
    providerSays('Pending');
    h.provider.cancel.mockResolvedValue(false);
    await expect(cancelOrder('u1', ID)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' });
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
