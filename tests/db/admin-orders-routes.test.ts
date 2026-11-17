import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import { ROUTES, callRoute, paidOrder } from '../helpers/admin-phase12';
import { getReq } from '../helpers/client-area-db';
import { cleanupUsers, makeFakeProvider, type FakeProvider } from '../helpers/orders-db';
import { userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const h = vi.hoisted(() => ({ provider: null as unknown as FakeProvider }));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

import { GET as clientOrder } from '@/app/api/v1/orders/[id]/route';
import { GET as clientOrders } from '@/app/api/v1/orders/route';

/*
 * Décision 1d : la liste et la fiche d'une commande côté admin affichent `provider_order_id` (numéro chez le
 * fournisseur) ; il n'apparaît JAMAIS dans une réponse client. Routes : voir tests/helpers/admin-phase12.ts.
 */
const created: string[] = [];
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
type Item = { id: string; status: string; provider_order_id: number | null };

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => admin.release());
beforeEach(() => {
  h.provider = makeFakeProvider(100);
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  await cleanupUsers(created);
});

describe('GET /admin/orders : liste', () => {
  it('chaque ligne affiche le numéro de commande chez le fournisseur', async () => {
    const o = await paidOrder(created);
    const res = await callRoute(
      ROUTES.orders,
      'GET',
      '/api/v1/admin/orders?status=to_review&limit=100',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Item[] };
    const row = body.items.find((i) => i.id === o.id);
    expect(row).toBeDefined();
    expect(row!.provider_order_id).toBe(o.providerOrderId);
  });

  it('le filtre status=to_review ne renvoie que des commandes à examiner', async () => {
    await paidOrder(created);
    await paidOrder(created, { status: 'completed' });
    const res = await callRoute(
      ROUTES.orders,
      'GET',
      '/api/v1/admin/orders?status=to_review&limit=100',
    );
    const body = (await res.json()) as { items: Item[] };
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items.every((i) => i.status === 'to_review')).toBe(true);
  });

  it('refuse un statut inconnu : 400 VALIDATION_ERROR', async () => {
    const res = await callRoute(ROUTES.orders, 'GET', '/api/v1/admin/orders?status=nimporte');
    expect(res.status).toBe(400);
  });
});

describe('GET /admin/orders/{id} : fiche', () => {
  it('affiche numéro fournisseur, coût, montant payé, déjà remboursé et le client', async () => {
    const o = await paidOrder(created, { cost_usd: 0.4, charged_xaf: 1000 });
    const res = await callRoute(ROUTES.order, 'GET', `/api/v1/admin/orders/${o.id}`, { id: o.id });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: Record<string, unknown> };
    expect(body.order).toMatchObject({
      id: o.id,
      provider_order_id: o.providerOrderId,
      charged_xaf: 1000,
      refunded_xaf: 0,
    });
    expect(Number(body.order.cost_usd)).toBe(0.4);
  });

  it('commande inconnue : 404 ORDER_NOT_FOUND', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    const res = await callRoute(ROUTES.order, 'GET', `/api/v1/admin/orders/${id}`, { id });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('ORDER_NOT_FOUND');
  });

  it('identifiant mal formé : 404 ORDER_NOT_FOUND, pas d’erreur serveur', async () => {
    const res = await callRoute(ROUTES.order, 'GET', '/api/v1/admin/orders/abc', { id: 'abc' });
    expect(res.status).toBe(404);
  });
});

describe('le numéro fournisseur ne sort jamais côté client', () => {
  it('ni dans la liste ni dans la fiche d’une commande du client', async () => {
    const o = await paidOrder(created);
    // Vraie session du client (la sécurité par ligne reste réelle).
    session.client = await userClient(o.userId);
    const list = await clientOrders(getReq('/api/v1/orders'));
    expect(list.status).toBe(200);
    const listText = JSON.stringify(await list.json());
    const one = await clientOrder(getReq(`/api/v1/orders/${o.id}`), {
      params: Promise.resolve({ id: o.id }),
    });
    expect(one.status).toBe(200);
    const oneText = JSON.stringify(await one.json());
    for (const text of [listText, oneText]) {
      expect(text).not.toContain('provider_order_id');
      expect(text).not.toContain(String(o.providerOrderId));
    }
  });
});
