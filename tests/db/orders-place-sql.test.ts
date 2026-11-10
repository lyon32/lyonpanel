import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeOrder } from '../factories/order';
import {
  TIKTOK_LINK,
  balanceOf,
  cleanupUsers,
  makeCommentsService,
  makeFollowersService,
  makeFundedUser,
  newKey,
  resetOrderSettings,
  restoreOrderSettingsAfterAll,
  setSetting,
} from '../helpers/orders-db';
import { adminClient } from './helpers/client';

/*
 * Fonction SQL place_order (migration 6.2 de lp-db), appelée directement :
 *   rpc('place_order', { p_user, p_service, p_link, p_qty, p_comments, p_idem_key, p_expected_price_xaf_1000? })
 * Attendu de la migration :
 *   - réglage settings.daily_order_cap_xaf (jsonb nombre), défaut 100000 dans le seed ET la migration ;
 *   - plafond effectif = least(réglage, profiles.daily_spend_limit_xaf) ; période = 24 h glissantes ;
 *     les commandes 'refunded' et 'canceled' ne comptent pas ;
 *   - erreur SQL 'DAILY_LIMIT_REACHED' ;
 *   - commentaires : service dont provider_type = 'Custom Comments' => p_comments obligatoire, nombre = p_qty,
 *     aucune ligne vide (trim) ; autres services => p_comments doit être null ou vide ; sinon erreur 'COMMENTS_INVALID'.
 */

const db = adminClient();
const created: string[] = [];
restoreOrderSettingsAfterAll();

beforeEach(resetOrderSettings);
afterEach(() => cleanupUsers(created));

function place(
  userId: string,
  serviceId: number,
  qty: number,
  extra: Record<string, unknown> = {},
) {
  return db.rpc('place_order', {
    p_user: userId,
    p_service: serviceId,
    p_link: TIKTOK_LINK,
    p_qty: qty,
    p_comments: null,
    p_idem_key: newKey(),
    ...extra,
  });
}

/** Un service à 1 000 XAF les 1 000 : quantité = montant en XAF. */
const cheap = () => makeFollowersService({ price_xaf_1000: 1000, min_qty: 1, max_qty: 500_000 });

describe('place_order : plafond journalier lu dans les réglages', () => {
  it('100 000 XAF exactement : accepté ; 100 001 : DAILY_LIMIT_REACHED', async () => {
    const s = await cheap();
    const u = await makeFundedUser(created, { balance: 1_000_000 });
    const ok = await place(u.id, s.id, 100_000);
    expect(ok.error).toBeNull();
    const u2 = await makeFundedUser(created, { balance: 1_000_000 });
    const refused = await place(u2.id, s.id, 100_001);
    expect(refused.error?.message).toContain('DAILY_LIMIT_REACHED');
    expect(await balanceOf(u2.id)).toBe(1_000_000);
  });

  it('cumul sur 24 h : 60 000 puis 40 001 refusé, 40 000 accepté', async () => {
    const s = await cheap();
    const u = await makeFundedUser(created, { balance: 1_000_000 });
    expect((await place(u.id, s.id, 60_000)).error).toBeNull();
    expect((await place(u.id, s.id, 40_001)).error?.message).toContain('DAILY_LIMIT_REACHED');
    expect((await place(u.id, s.id, 40_000)).error).toBeNull();
  });

  it('on change le réglage et le comportement suit : plafond 20 000 -> 20 001 refusé', async () => {
    await setSetting('daily_order_cap_xaf', 20_000);
    const s = await cheap();
    const u = await makeFundedUser(created, { balance: 1_000_000 });
    expect((await place(u.id, s.id, 20_001)).error?.message).toContain('DAILY_LIMIT_REACHED');
    expect((await place(u.id, s.id, 20_000)).error).toBeNull();
  });

  it('plafond relevé à 300 000 : une commande de 150 000 passe (le réglage n est pas écrasé par 500 000 / 100 000 en dur)', async () => {
    await setSetting('daily_order_cap_xaf', 300_000);
    const s = await cheap();
    const u = await makeFundedUser(created, { balance: 1_000_000 });
    expect((await place(u.id, s.id, 150_000)).error).toBeNull();
  });

  it('le plafond individuel du client reste prioritaire s il est plus bas (least) : 30 000 -> 30 001 refusé', async () => {
    const s = await cheap();
    const u = await makeFundedUser(created, {
      balance: 1_000_000,
      profile: { daily_spend_limit_xaf: 30_000 },
    });
    expect((await place(u.id, s.id, 30_001)).error?.message).toContain('DAILY_LIMIT_REACHED');
    expect((await place(u.id, s.id, 30_000)).error).toBeNull();
  });

  it('les commandes refunded et canceled ne comptent pas dans les 24 h', async () => {
    const s = await cheap();
    const u = await makeFundedUser(created, { balance: 1_000_000 });
    await makeOrder(u.id, s.id, {
      status: 'refunded',
      charged_xaf: 60_000,
      price_xaf_1000: 1000,
      quantity: 60_000,
    });
    await makeOrder(u.id, s.id, {
      status: 'canceled',
      charged_xaf: 30_000,
      price_xaf_1000: 1000,
      quantity: 30_000,
    });
    expect((await place(u.id, s.id, 100_000)).error).toBeNull();
  });

  it('une commande en to_review ou in_progress compte bien', async () => {
    const s = await cheap();
    const u = await makeFundedUser(created, { balance: 1_000_000 });
    await makeOrder(u.id, s.id, {
      status: 'to_review',
      charged_xaf: 60_000,
      price_xaf_1000: 1000,
      quantity: 60_000,
    });
    expect((await place(u.id, s.id, 40_001)).error?.message).toContain('DAILY_LIMIT_REACHED');
  });

  it('fenêtre glissante : une commande vieille de plus de 24 h ne compte plus, de 23 h elle compte', async () => {
    const s = await cheap();
    const u = await makeFundedUser(created, { balance: 1_000_000 });
    const old = await makeOrder(u.id, s.id, {
      charged_xaf: 90_000,
      price_xaf_1000: 1000,
      quantity: 90_000,
    });
    const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
    await db
      .from('orders')
      .update({ created_at: hoursAgo(23) })
      .eq('id', old.id);
    expect((await place(u.id, s.id, 20_000)).error?.message).toContain('DAILY_LIMIT_REACHED');
    await db
      .from('orders')
      .update({ created_at: hoursAgo(25) })
      .eq('id', old.id);
    expect((await place(u.id, s.id, 20_000)).error).toBeNull();
  });
});

describe('place_order : commentaires', () => {
  it('service commentaires : accepte autant de lignes que la quantité et les enregistre', async () => {
    const s = await makeCommentsService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const { data, error } = await place(u.id, s.id, 2, { p_comments: ['Top', 'Bravo'] });
    expect(error).toBeNull();
    expect(data.comments).toEqual(['Top', 'Bravo']);
  });

  it.each([
    ['sans commentaires', null],
    ['liste vide', []],
    ['moins de lignes que la quantité', ['seul']],
    ['plus de lignes que la quantité', ['a', 'b', 'c']],
    ['une ligne vide', ['a', '']],
    ['une ligne d espaces', ['a', '   ']],
  ])('service commentaires %s : COMMENTS_INVALID, aucun débit', async (_l, comments) => {
    const s = await makeCommentsService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const { error } = await place(u.id, s.id, 2, { p_comments: comments });
    expect(error?.message).toContain('COMMENTS_INVALID');
    expect(await balanceOf(u.id)).toBe(5000);
  });

  it('service sans commentaires personnalisés : des commentaires sont refusés (COMMENTS_INVALID)', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    const { error } = await place(u.id, s.id, 100, { p_comments: ['Super'] });
    expect(error?.message).toContain('COMMENTS_INVALID');
    expect(await balanceOf(u.id)).toBe(5000);
  });

  it('service sans commentaires, p_comments null : fonctionne comme avant', async () => {
    const s = await makeFollowersService();
    const u = await makeFundedUser(created, { balance: 5000 });
    expect((await place(u.id, s.id, 100)).error).toBeNull();
  });
});
