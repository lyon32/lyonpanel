import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FORBIDDEN_ORDER_KEYS,
  TIKTOK_LINK,
  balanceOf,
  cleanupUsers,
  debitsOf,
  makeCommentsService,
  makeFakeProvider,
  makeFollowersService,
  makeFundedUser,
  newKey,
  ordersOf,
  resetOrderSettings,
  restoreOrderSettingsAfterAll,
  setSetting,
  type FakeProvider,
} from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
const h = vi.hoisted(() => ({ provider: null as unknown as FakeProvider }));
vi.mock('@/server/providers', () => ({ getProvider: () => h.provider }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));

import { placeOrder } from '@/server/orders/place-order';
import { notifyOwner } from '@/server/providers/telegram';

/*
 * Signature attendue (LLD §4.3), fichier src/server/orders/place-order.ts :
 *   placeOrder(userId: string, input: CreateOrderInput, idempotencyKey: string): Promise<Order>
 *   - CreateOrderInput = { service_id, link, quantity, comments?, expected_total_xaf } (schemas/order.ts)
 *   - Order (forme publique de API_SPEC §6.5, snake_case) :
 *       { id, short_id, service: { id, name, platform }, link, quantity, charged_xaf, status,
 *         start_count, remains, created_at, updated_at }
 *     status = 'in_progress' (envoi réussi) ou 'to_review' (envoi échoué). Jamais d'exception pour to_review.
 *   - Ordre des contrôles : lien -> commentaires -> service/quantité -> PRICE_CHANGED -> solde fournisseur
 *     (getProvider().balance(), USD) -> rpc('place_order') -> submitToProvider.
 *   - Erreurs = ApiError ({ code, status, details }) ; erreurs SQL (message = code) converties :
 *       INSUFFICIENT_BALANCE { missing_xaf }, DAILY_LIMIT_REACHED { limit_xaf }, QUANTITY_OUT_OF_RANGE { min, max },
 *       PRICE_CHANGED { new_total_xaf }, SERVICE_UNAVAILABLE, ACCOUNT_BLOCKED.
 *   - Même Idempotency-Key + contenu différent (service, lien, quantité, commentaires) -> IDEMPOTENCY_CONFLICT (409).
 *   - Le fournisseur est joint par getProvider() de '@/server/providers' (injecté ici) ; notifyOwner de
 *     '@/server/providers/telegram'. provider.add : UN seul appel par commande, jamais de reprise.
 */

const created: string[] = [];
const db = adminClient();
restoreOrderSettingsAfterAll();

beforeEach(async () => {
  await resetOrderSettings();
  h.provider = makeFakeProvider(100);
  vi.mocked(notifyOwner).mockClear();
});
afterEach(async () => {
  vi.useRealTimers();
  await cleanupUsers(created);
});

const input = (serviceId: number, over: Record<string, unknown> = {}) => ({
  service_id: serviceId,
  link: TIKTOK_LINK,
  quantity: 1000,
  expected_total_xaf: 1155,
  ...over,
});

describe('placeOrder : commande normale', () => {
  it('1 000 abonnés à 1 155 XAF : solde 5 000 -> 3 845, une commande in_progress, un débit', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const order = await placeOrder(u.id, input(s.id), newKey());

    expect(order).toMatchObject({
      quantity: 1000,
      charged_xaf: 1155,
      status: 'in_progress',
      link: TIKTOK_LINK,
      service: { id: s.id, platform: 'tiktok' },
    });
    expect(await balanceOf(u.id)).toBe(3845);
    expect(await ordersOf(u.id)).toHaveLength(1);
    const debits = await debitsOf(u.id);
    expect(debits).toHaveLength(1);
    expect(debits[0]).toMatchObject({ amount_xaf: -1155, balance_after_xaf: 3845 });
  });

  it('applique la remise automatique (10 % dès 50 000 XAF rechargés) : 1 155 -> 1 040 (arrondi supérieur)', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000, recharged: 60_000 });
    const order = await placeOrder(u.id, input(s.id, { expected_total_xaf: 1040 }), newKey());
    expect(order.charged_xaf).toBe(1040);
    expect(await balanceOf(u.id)).toBe(3960);
  });

  it('applique la remise personnalisée (15 %) quand elle est plus forte : 1 000 -> 850', async () => {
    const s = await makeFollowersService({ price_xaf_1000: 1000 });
    const u = await makeFundedUser(created, {
      balance: 5000,
      profile: { custom_discount_pct: 15 },
    });
    const order = await placeOrder(u.id, input(s.id, { expected_total_xaf: 850 }), newKey());
    expect(order.charged_xaf).toBe(850);
  });

  it('la réponse ne contient ni coût, ni erreur, ni identifiant fournisseur, ni clé, ni nom du fournisseur', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const order = await placeOrder(u.id, input(s.id), newKey());
    for (const key of FORBIDDEN_ORDER_KEYS) expect(order).not.toHaveProperty(key);
    expect(JSON.stringify(order)).not.toMatch(/provider|fournisseur|jap/i);
  });

  it('envoie au fournisseur le bon service, le bon lien et la bonne quantité', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await placeOrder(u.id, input(s.id), newKey());
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(h.provider.add).toHaveBeenCalledWith(
      expect.objectContaining({ service: s.id, link: TIKTOK_LINK, quantity: 1000 }),
    );
  });
});

describe('placeOrder : prix', () => {
  it('total attendu différent du total recalculé : PRICE_CHANGED avec le nouveau total, aucun débit, aucune commande', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(
      placeOrder(u.id, input(s.id, { expected_total_xaf: 1000 }), newKey()),
    ).rejects.toMatchObject({
      code: 'PRICE_CHANGED',
      status: 422,
      details: { new_total_xaf: 1155 },
    });
    expect(await balanceOf(u.id)).toBe(5000);
    expect(await ordersOf(u.id)).toHaveLength(0);
    expect(h.provider.add).not.toHaveBeenCalled();
  });

  it('le prix a bougé depuis le devis (le service a changé de tarif) : PRICE_CHANGED', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await db.from('services').update({ price_xaf_1000: 1500 }).eq('id', s.id);
    await expect(placeOrder(u.id, input(s.id), newKey())).rejects.toMatchObject({
      code: 'PRICE_CHANGED',
      details: { new_total_xaf: 1500 },
    });
    expect(await balanceOf(u.id)).toBe(5000);
  });
});

describe('placeOrder : solde', () => {
  it('total 1 155, solde 1 000 : INSUFFICIENT_BALANCE avec missing_xaf = 155, solde inchangé, aucune commande', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 1000 });
    await expect(placeOrder(u.id, input(s.id), newKey())).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      status: 422,
      details: { missing_xaf: 155 },
    });
    expect(await balanceOf(u.id)).toBe(1000);
    expect(await ordersOf(u.id)).toHaveLength(0);
    expect(await debitsOf(u.id)).toHaveLength(0);
    expect(h.provider.add).not.toHaveBeenCalled();
  });

  it('solde exactement égal au total : la commande passe, solde à 0', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 1155 });
    await placeOrder(u.id, input(s.id), newKey());
    expect(await balanceOf(u.id)).toBe(0);
  });
});

describe('placeOrder : quantité, lien, commentaires, service', () => {
  it.each([
    ['sous le minimum', 9],
    ['au-dessus du maximum', 10_001],
    ['nulle', 0],
  ])('quantité %s : QUANTITY_OUT_OF_RANGE avec min et max, aucun débit', async (_l, qty) => {
    const s = await makeFollowersService({ min_qty: 10, max_qty: 10_000 });
    const u = await makeFundedUser(created, { balance: 50_000 });
    await expect(
      placeOrder(u.id, input(s.id, { quantity: qty, expected_total_xaf: 5 }), newKey()),
    ).rejects.toMatchObject({
      code: 'QUANTITY_OUT_OF_RANGE',
      status: 422,
      details: { min: 10, max: 10_000 },
    });
    expect(await balanceOf(u.id)).toBe(50_000);
    expect(await ordersOf(u.id)).toHaveLength(0);
  });

  it('quantités minimale (10) et maximale (10 000) exactes : acceptées', async () => {
    // Prix 1 000 XAF les 1 000 : montants exacts, sans ambiguïté d arrondi.
    const s = await makeFollowersService({ price_xaf_1000: 1000, min_qty: 10, max_qty: 10_000 });
    const u = await makeFundedUser(created, { balance: 50_000 });
    await placeOrder(u.id, input(s.id, { quantity: 10, expected_total_xaf: 10 }), newKey());
    await placeOrder(u.id, input(s.id, { quantity: 10_000, expected_total_xaf: 10_000 }), newKey());
    expect(await ordersOf(u.id)).toHaveLength(2);
  });

  it('lien d une autre plateforme : INVALID_LINK, aucun débit', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(
      placeOrder(u.id, input(s.id, { link: 'https://www.instagram.com/p/Cabc/' }), newKey()),
    ).rejects.toMatchObject({ code: 'INVALID_LINK', status: 422 });
    expect(await balanceOf(u.id)).toBe(5000);
    expect(h.provider.add).not.toHaveBeenCalled();
  });

  it('commentaires refusés sur un service qui n en accepte pas (VALIDATION_ERROR sur le champ comments)', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(
      placeOrder(u.id, input(s.id, { comments: ['Super !'] }), newKey()),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { fields: { comments: expect.any(String) } },
    });
    expect(await balanceOf(u.id)).toBe(5000);
  });

  it('service « commentaires personnalisés » sans commentaires : VALIDATION_ERROR', async () => {
    const s = await makeCommentsService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(
      placeOrder(u.id, input(s.id, { quantity: 2, expected_total_xaf: 10 }), newKey()),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('commentaires : nombre de lignes différent de la quantité refusé', async () => {
    const s = await makeCommentsService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(
      placeOrder(
        u.id,
        input(s.id, { quantity: 3, expected_total_xaf: 15, comments: ['a', 'b'] }),
        newKey(),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('commentaires : ligne vide ou espaces seulement refusée', async () => {
    const s = await makeCommentsService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(
      placeOrder(
        u.id,
        input(s.id, { quantity: 2, expected_total_xaf: 10, comments: ['a', '   '] }),
        newKey(),
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('commentaires valides (autant de lignes que la quantité) : commande créée et commentaires transmis', async () => {
    const s = await makeCommentsService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const order = await placeOrder(
      u.id,
      input(s.id, { quantity: 3, expected_total_xaf: 15, comments: ['Super', 'Bravo', 'Top'] }),
      newKey(),
    );
    expect(order.status).toBe('in_progress');
    expect((await ordersOf(u.id))[0]!.comments).toEqual(['Super', 'Bravo', 'Top']);
    expect(h.provider.add).toHaveBeenCalledWith(
      expect.objectContaining({ comments: ['Super', 'Bravo', 'Top'] }),
    );
  });

  it.each([
    ['inactif', { active: false }],
    ['indisponible', { available: false }],
  ])('service %s : SERVICE_UNAVAILABLE, aucun débit', async (_l, patch) => {
    const s = await makeFollowersService(patch);
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(placeOrder(u.id, input(s.id), newKey())).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 422,
    });
    expect(await balanceOf(u.id)).toBe(5000);
  });

  it('service inconnu : SERVICE_UNAVAILABLE ou NOT_FOUND, aucun débit', async () => {
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(placeOrder(u.id, input(1), newKey())).rejects.toMatchObject({
      code: expect.stringMatching(/^(SERVICE_UNAVAILABLE|NOT_FOUND)$/),
    });
    expect(await balanceOf(u.id)).toBe(5000);
  });

  it('client bloqué : ACCOUNT_BLOCKED (403), aucun débit', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000, profile: { status: 'blocked' } });
    await expect(placeOrder(u.id, input(s.id), newKey())).rejects.toMatchObject({
      code: 'ACCOUNT_BLOCKED',
      status: 403,
    });
    expect(await balanceOf(u.id)).toBe(5000);
  });
});

describe('placeOrder : plafond journalier (réglage daily_order_cap_xaf)', () => {
  it('la 2e commande qui dépasse 100 000 XAF sur 24 h est refusée : DAILY_LIMIT_REACHED { limit_xaf: 100000 }', async () => {
    const s = await makeFollowersService({ price_xaf_1000: 1000, max_qty: 100_000 });
    const u = await makeFundedUser(created, { balance: 500_000 });
    await placeOrder(u.id, input(s.id, { quantity: 90_000, expected_total_xaf: 90_000 }), newKey());
    await expect(
      placeOrder(u.id, input(s.id, { quantity: 10_005, expected_total_xaf: 10_005 }), newKey()),
    ).rejects.toMatchObject({
      code: 'DAILY_LIMIT_REACHED',
      status: 422,
      details: { limit_xaf: 100_000 },
    });
    expect(await balanceOf(u.id)).toBe(410_000);
  });

  it('le plafond suit le réglage : à 20 000 XAF, une commande de 25 000 est refusée avec limit_xaf 20000', async () => {
    await setSetting('daily_order_cap_xaf', 20_000);
    const s = await makeFollowersService({ price_xaf_1000: 1000, max_qty: 100_000 });
    const u = await makeFundedUser(created, { balance: 500_000 });
    await expect(
      placeOrder(u.id, input(s.id, { quantity: 25_000, expected_total_xaf: 25_000 }), newKey()),
    ).rejects.toMatchObject({ code: 'DAILY_LIMIT_REACHED', details: { limit_xaf: 20_000 } });
  });
});

describe('placeOrder : idempotence (double clic)', () => {
  it('même clé deux fois : UNE commande, UN débit, même réponse', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const key = newKey();
    const a = await placeOrder(u.id, input(s.id), key);
    const b = await placeOrder(u.id, input(s.id), key);
    expect(b).toEqual(a);
    expect(await ordersOf(u.id)).toHaveLength(1);
    expect(await debitsOf(u.id)).toHaveLength(1);
    expect(await balanceOf(u.id)).toBe(3845);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
  });

  it('même clé en parallèle (10 appels simultanés) : une seule commande, un seul débit, un seul envoi fournisseur', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const key = newKey();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => placeOrder(u.id, input(s.id), key)),
    );
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await ordersOf(u.id)).toHaveLength(1);
    expect(await debitsOf(u.id)).toHaveLength(1);
    expect(await balanceOf(u.id)).toBe(3845);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
  });

  it('même clé mais quantité différente : IDEMPOTENCY_CONFLICT (409), rien de plus débité', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const key = newKey();
    await placeOrder(u.id, input(s.id), key);
    await expect(
      placeOrder(u.id, input(s.id, { quantity: 2000, expected_total_xaf: 2310 }), key),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
    expect(await balanceOf(u.id)).toBe(3845);
    expect(await ordersOf(u.id)).toHaveLength(1);
  });

  it('même clé mais lien différent : IDEMPOTENCY_CONFLICT', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const key = newKey();
    await placeOrder(u.id, input(s.id), key);
    await expect(
      placeOrder(u.id, input(s.id, { link: 'https://www.tiktok.com/@autre' }), key),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });

  it('deux commandes simultanées avec des clés différentes sur un solde pour une seule : une passe, l autre INSUFFICIENT_BALANCE', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 1200 });
    const results = await Promise.allSettled([
      placeOrder(u.id, input(s.id), newKey()),
      placeOrder(u.id, input(s.id), newKey()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(await balanceOf(u.id)).toBe(45);
    expect(await debitsOf(u.id)).toHaveLength(1);
  });
});

describe('placeOrder : échec du fournisseur (jamais de remboursement ni de reprise)', () => {
  it('provider.add échoue : commande to_review (pas d exception), alerte order_failed, solde RESTE débité, un seul appel', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    h.provider.add.mockRejectedValue(new Error('JAP: not enough funds secret-detail'));
    const order = await placeOrder(u.id, input(s.id), newKey());

    expect(order.status).toBe('to_review');
    expect(await balanceOf(u.id)).toBe(3845);
    expect(await debitsOf(u.id)).toHaveLength(1);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledWith('order_failed', expect.objectContaining({}));
    const refunds = await db
      .from('wallet_transactions')
      .select('id')
      .eq('user_id', u.id)
      .eq('type', 'refund');
    expect(refunds.data).toHaveLength(0);
  });

  it('le client ne voit jamais le message du fournisseur', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    h.provider.add.mockRejectedValue(new Error('JAP: not enough funds secret-detail'));
    const order = await placeOrder(u.id, input(s.id), newKey());
    expect(JSON.stringify(order)).not.toMatch(/secret-detail|JAP|not enough funds/i);
    expect(order).not.toHaveProperty('error');
  });

  it('rejouer la même clé après un échec ne rappelle PAS le fournisseur et ne débite pas de nouveau', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    h.provider.add.mockRejectedValue(new Error('boom'));
    const key = newKey();
    const a = await placeOrder(u.id, input(s.id), key);
    const b = await placeOrder(u.id, input(s.id), key);
    expect(b.id).toBe(a.id);
    expect(b.status).toBe('to_review');
    expect(h.provider.add).toHaveBeenCalledTimes(1);
    expect(await balanceOf(u.id)).toBe(3845);
  });

  it('un rejeu après un succès ne rappelle pas non plus le fournisseur', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const key = newKey();
    await placeOrder(u.id, input(s.id), key);
    await placeOrder(u.id, input(s.id), key);
    expect(h.provider.add).toHaveBeenCalledTimes(1);
  });
});

describe('placeOrder : solde du fournisseur', () => {
  it('solde fournisseur insuffisant pour la commande : SERVICE_UNAVAILABLE, aucun débit client, add jamais appelé', async () => {
    const s = await makeFollowersService({ cost_usd_1000: 0.385 });
    const u = await makeFundedUser(created, { balance: 5000 });
    h.provider = makeFakeProvider(0.1); // coût de la commande : 0.385 $
    await expect(placeOrder(u.id, input(s.id), newKey())).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 422,
    });
    expect(await balanceOf(u.id)).toBe(5000);
    expect(await ordersOf(u.id)).toHaveLength(0);
    expect(h.provider.add).not.toHaveBeenCalled();
  });

  it('solde fournisseur sous provider_low_balance_usd (5 $) après la commande : alerte low_provider_balance, commande passe', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    h.provider = makeFakeProvider(4.5);
    const order = await placeOrder(u.id, input(s.id), newKey());
    expect(order.status).toBe('in_progress');
    expect(notifyOwner).toHaveBeenCalledWith('low_provider_balance', expect.objectContaining({}));
  });

  it('solde fournisseur confortable (100 $) : aucune alerte', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await placeOrder(u.id, input(s.id), newKey());
    expect(notifyOwner).not.toHaveBeenCalledWith('low_provider_balance', expect.anything());
  });

  it('le seuil d alerte vient du réglage (pas en dur) : seuil 200 $ -> alerte avec 100 $', async () => {
    await setSetting('provider_low_balance_usd', 200);
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    await placeOrder(u.id, input(s.id), newKey());
    expect(notifyOwner).toHaveBeenCalledWith('low_provider_balance', expect.objectContaining({}));
  });
});
