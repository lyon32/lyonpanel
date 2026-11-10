import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupUsers,
  makeFollowersService,
  makeFundedUser,
  resetOrderSettings,
  restoreOrderSettingsAfterAll,
  balanceOf,
  ordersOf,
  newKey,
} from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));

import { quoteOrder } from '@/server/orders/quote';

/*
 * Signature attendue, fichier src/server/orders/quote.ts :
 *   quoteOrder(userId: string, input: { service_id: number; quantity: number }):
 *     Promise<{ price_xaf_1000: number; discount_pct: number; total_xaf: number; balance_after_xaf: number }>
 *   (forme de API_SPEC §6.5, snake_case ; aucun débit, aucune écriture.)
 *   total_xaf = computeOrderTotalXaf(prix remisé) = même résultat que place_order SQL (arrondi XAF supérieur).
 *   balance_after_xaf = solde - total (peut être négatif : l écran affiche « il vous manque »).
 *   Erreurs : QUANTITY_OUT_OF_RANGE { min, max }, SERVICE_UNAVAILABLE.
 */

const created: string[] = [];
restoreOrderSettingsAfterAll();
beforeEach(resetOrderSettings);
afterEach(() => cleanupUsers(created));

describe('quoteOrder', () => {
  it('1 000 abonnés à 1 155 XAF : total 1 155, solde après 3 845, aucun débit', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const q = await quoteOrder(u.id, { service_id: s.id, quantity: 1000 });
    expect(q).toEqual({
      price_xaf_1000: 1155,
      discount_pct: 0,
      total_xaf: 1155,
      balance_after_xaf: 3845,
    });
    expect(await balanceOf(u.id)).toBe(5000);
    expect(await ordersOf(u.id)).toHaveLength(0);
  });

  it('remise automatique 10 % (60 000 XAF rechargés) : total 1 040', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000, recharged: 60_000 });
    const q = await quoteOrder(u.id, { service_id: s.id, quantity: 1000 });
    expect(q).toMatchObject({ discount_pct: 10, total_xaf: 1040, balance_after_xaf: 3960 });
  });

  it('remise personnalisée 15 % : 1 000 -> 850', async () => {
    const s = await makeFollowersService({ price_xaf_1000: 1000 });
    const u = await makeFundedUser(created, {
      balance: 5000,
      profile: { custom_discount_pct: 15 },
    });
    const q = await quoteOrder(u.id, { service_id: s.id, quantity: 1000 });
    expect(q).toMatchObject({ discount_pct: 15, total_xaf: 850 });
  });

  it('le total du devis est exactement le montant débité ensuite (quantité à arrondi délicat : 10 x 1 155 / 1 000)', async () => {
    // Garde contre un écart entre computeOrderTotalXaf (TypeScript) et place_order (SQL).
    const s = await makeFollowersService({ min_qty: 10 });
    const u = await makeFundedUser(created, { balance: 5000 });
    const q = await quoteOrder(u.id, { service_id: s.id, quantity: 10 });
    const { data, error } = await adminClient().rpc('place_order', {
      p_user: u.id,
      p_service: s.id,
      p_link: 'https://www.tiktok.com/@client_test',
      p_qty: 10,
      p_comments: null,
      p_idem_key: newKey(),
    });
    expect(error).toBeNull();
    expect(data.charged_xaf).toBe(q.total_xaf);
    expect(await balanceOf(u.id)).toBe(5000 - q.total_xaf);
  });

  it('solde insuffisant : le devis est quand même fourni, avec un solde après négatif', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 1000 });
    const q = await quoteOrder(u.id, { service_id: s.id, quantity: 1000 });
    expect(q.balance_after_xaf).toBe(-155);
  });

  it('quantité hors limites : QUANTITY_OUT_OF_RANGE avec min et max', async () => {
    const s = await makeFollowersService({ min_qty: 10, max_qty: 10_000 });
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(quoteOrder(u.id, { service_id: s.id, quantity: 9 })).rejects.toMatchObject({
      code: 'QUANTITY_OUT_OF_RANGE',
      details: { min: 10, max: 10_000 },
    });
    await expect(quoteOrder(u.id, { service_id: s.id, quantity: 10_001 })).rejects.toMatchObject({
      code: 'QUANTITY_OUT_OF_RANGE',
    });
  });

  it('service inactif : SERVICE_UNAVAILABLE', async () => {
    const s = await makeFollowersService({ active: false });
    const u = await makeFundedUser(created, { balance: 5000 });
    await expect(quoteOrder(u.id, { service_id: s.id, quantity: 100 })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('le devis ne contient jamais coût, multiplicateur ni fournisseur', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const q = await quoteOrder(u.id, { service_id: s.id, quantity: 1000 });
    expect(Object.keys(q).sort()).toEqual([
      'balance_after_xaf',
      'discount_pct',
      'price_xaf_1000',
      'total_xaf',
    ]);
  });
});
