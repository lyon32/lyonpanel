import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import { cleanupUsers, makeFollowersService, makeFundedUser } from '../helpers/orders-db';
import { getReq, type ErrorBody } from '../helpers/client-area-db';
import { adminClient, userClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () =>
    session.client ?? { auth: { getUser: async () => ({ data: { user: null }, error: null }) } },
}));

import { GET as suggestion } from '@/app/api/v1/orders/suggestion/route';

/*
 * Route attendue (phase 8, tâche 8.3a), calculée côté serveur depuis `orders` du client connecté :
 *   src/app/api/v1/orders/suggestion/route.ts   GET /api/v1/orders/suggestion
 *     -> 200 { suggestion: null }  (aucune commande)
 *     -> 200 { suggestion: { service: {id, name, platform}, quantity } }
 *   service = le plus commandé ; en cas d'égalité, le plus récemment commandé.
 *   quantity = la quantité la plus fréquente pour CE service ; en cas d'égalité, la plus récente.
 *   Si profiles.suggestions_enabled = false : toujours {suggestion:null}, même avec des commandes.
 *   Toutes les commandes comptent, quel que soit leur statut.
 *   Non connecté : 401 UNAUTHENTICATED. Seules ses propres commandes comptent.
 *   Réponse = exactement ces clés (liste blanche) : jamais de coût, marge, fournisseur, prix unitaire.
 */

const created: string[] = [];
beforeEach(() => {
  session.client = null;
});
afterEach(async () => {
  session.client = null;
  await cleanupUsers(created);
});

async function login() {
  const u = await makeFundedUser(created, { balance: 5000 });
  session.client = await userClient(u.id);
  return u;
}
const call = async () => {
  const res = await suggestion(getReq('/api/v1/orders/suggestion'));
  return { res, json: await res.json() };
};
const day = (n: number) => new Date(Date.UTC(2026, 10, n)).toISOString();

describe('GET /api/v1/orders/suggestion', () => {
  it('refuse un visiteur non connecté (401 UNAUTHENTICATED)', async () => {
    const { res, json } = await call();
    expect(res.status).toBe(401);
    expect((json as ErrorBody).error.code).toBe('UNAUTHENTICATED');
  });

  it('client sans aucune commande : 200 et aucune suggestion', async () => {
    await login();
    const { res, json } = await call();
    expect(res.status).toBe(200);
    expect(json).toEqual({ suggestion: null });
  });

  it('propose le service le plus commandé avec sa quantité habituelle', async () => {
    const u = await login();
    const a = await makeFollowersService();
    const b = await makeFollowersService();
    await makeOrder(u.id, a.id, { quantity: 500 });
    await makeOrder(u.id, a.id, { quantity: 500 });
    await makeOrder(u.id, a.id, { quantity: 100 });
    await makeOrder(u.id, b.id, { quantity: 2000 });
    const { json } = await call();
    expect(json.suggestion.service.id).toBe(a.id);
    expect(json.suggestion.quantity).toBe(500);
  });

  it('un seul service commandé une fois : propose ce service et cette quantité', async () => {
    const u = await login();
    const a = await makeFollowersService();
    await makeOrder(u.id, a.id, { quantity: 250 });
    const { json } = await call();
    expect(json.suggestion).toMatchObject({ service: { id: a.id }, quantity: 250 });
  });

  it('égalité entre deux services : prend le plus récemment commandé', async () => {
    const u = await login();
    const a = await makeFollowersService();
    const b = await makeFollowersService();
    await makeOrder(u.id, a.id, { quantity: 100, created_at: day(1) });
    await makeOrder(u.id, b.id, { quantity: 300, created_at: day(2) });
    const { json } = await call();
    expect(json.suggestion).toMatchObject({ service: { id: b.id }, quantity: 300 });
  });

  it('égalité entre deux quantités : prend la plus récente', async () => {
    const u = await login();
    const a = await makeFollowersService();
    await makeOrder(u.id, a.id, { quantity: 100, created_at: day(1) });
    await makeOrder(u.id, a.id, { quantity: 700, created_at: day(2) });
    const { json } = await call();
    expect(json.suggestion.quantity).toBe(700);
  });

  it("ne compte que les commandes du client connecté, jamais celles d'un autre", async () => {
    const other = await makeFundedUser(created, { balance: 5000 });
    const s = await makeFollowersService();
    await makeOrder(other.id, s.id, { quantity: 900 });
    await makeOrder(other.id, s.id, { quantity: 900 });
    await login();
    const { json } = await call();
    expect(json).toEqual({ suggestion: null });
  });

  it('ne renvoie que service {id, name, platform} et quantity : aucun champ fournisseur, coût ou marge', async () => {
    const u = await login();
    const s = await makeFollowersService();
    await makeOrder(u.id, s.id, { quantity: 100, cost_usd: 0.4, price_xaf_1000: 1155 });
    const { json } = await call();
    expect(Object.keys(json)).toEqual(['suggestion']);
    expect(Object.keys(json.suggestion).sort()).toEqual(['quantity', 'service']);
    expect(Object.keys(json.suggestion.service).sort()).toEqual(['id', 'name', 'platform']);
    const raw = JSON.stringify(json).toLowerCase();
    for (const word of [
      'cost',
      'margin',
      'marge',
      'provider',
      'fournisseur',
      'multiplier',
      'idem',
    ]) {
      expect(raw).not.toContain(word);
    }
  });

  it('suggestions désactivées (suggestions_enabled=false) : aucune suggestion malgré les commandes', async () => {
    const u = await login();
    const s = await makeFollowersService();
    await makeOrder(u.id, s.id, { quantity: 500 });
    await adminClient().from('profiles').update({ suggestions_enabled: false }).eq('id', u.id);
    const { res, json } = await call();
    expect(res.status).toBe(200);
    expect(json).toEqual({ suggestion: null });
  });

  it('réactivées : la suggestion revient', async () => {
    const u = await login();
    const s = await makeFollowersService();
    await makeOrder(u.id, s.id, { quantity: 500 });
    await adminClient().from('profiles').update({ suggestions_enabled: false }).eq('id', u.id);
    await adminClient().from('profiles').update({ suggestions_enabled: true }).eq('id', u.id);
    const { json } = await call();
    expect(json.suggestion.service.id).toBe(s.id);
  });

  it('toutes les commandes comptent, même annulées ou en revue', async () => {
    const u = await login();
    const a = await makeFollowersService();
    const b = await makeFollowersService();
    await makeOrder(u.id, a.id, { quantity: 100, status: 'canceled' });
    await makeOrder(u.id, a.id, { quantity: 100, status: 'to_review' });
    await makeOrder(u.id, b.id, { quantity: 900, status: 'completed' });
    const { json } = await call();
    expect(json.suggestion).toMatchObject({ service: { id: a.id }, quantity: 100 });
  });
});
