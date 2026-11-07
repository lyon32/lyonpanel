import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];
const LINK = 'https://www.tiktok.com/@client_test';

beforeAll(async () => {
  await db
    .from('settings')
    .upsert({ key: 'auto_discount', value: { threshold_xaf: 50000, pct: 10 } });
});

// Nettoyage au mieux : le journal immuable peut bloquer la suppression, c'est voulu.
afterEach(async () => {
  while (created.length) await removeUser(created.pop()!);
});

async function client(
  opts: { balance?: number; recharged?: number; profile?: Record<string, unknown> } = {},
) {
  const u = await makeUser();
  created.push(u.id);
  const { error } = await db
    .from('wallets')
    .update({ balance_xaf: opts.balance ?? 0, total_recharged_xaf: opts.recharged ?? 0 })
    .eq('user_id', u.id);
  expect(error).toBeNull();
  if (opts.profile) {
    const { error: e } = await db.from('profiles').update(opts.profile).eq('id', u.id);
    expect(e).toBeNull();
  }
  return u;
}

function place(
  userId: string,
  serviceId: number,
  qty: number,
  extra: Record<string, unknown> = {},
) {
  return db.rpc('place_order', {
    p_user: userId,
    p_service: serviceId,
    p_link: LINK,
    p_qty: qty,
    p_comments: null,
    p_idem_key: randomUUID(),
    ...extra,
  });
}

async function wallet(userId: string) {
  const { data } = await db.from('wallets').select('*').eq('user_id', userId).single();
  return data!;
}

async function count(table: 'orders' | 'wallet_transactions', userId: string) {
  const { count: n } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return n;
}

describe('place_order : commande normale', () => {
  it('débite le solde exact, journalise la transaction et fige la commande pending', async () => {
    const s = await makeService({ price_xaf_1000: 1500, cost_usd_1000: 1.5 });
    const u = await client({ balance: 1000 });
    const { data, error } = await place(u.id, s.id, 100);
    expect(error).toBeNull();
    expect(data.status).toBe('pending');
    expect(data.price_xaf_1000).toBe(1500);
    expect(Number(data.discount_pct)).toBe(0);
    expect(data.charged_xaf).toBe(150);
    expect(Number(data.cost_usd)).toBeCloseTo(0.15, 4);
    expect((await wallet(u.id)).balance_xaf).toBe(850);
    const { data: t } = await db.from('wallet_transactions').select('*').eq('user_id', u.id);
    expect(t).toHaveLength(1);
    expect(t![0]).toMatchObject({
      type: 'order',
      amount_xaf: -150,
      balance_after_xaf: 850,
      order_id: data.id,
      ref: `order:${data.id}`,
    });
  });

  it('accepte une quantité non ronde (137) et arrondit le prix au XAF supérieur', async () => {
    const s = await makeService({ price_xaf_1000: 1200, min_qty: 10, max_qty: 10000 });
    const u = await client({ balance: 1000 });
    const { data, error } = await place(u.id, s.id, 137);
    expect(error).toBeNull();
    // 1200 x 137 / 1000 = 164,4 -> 165
    expect(data.charged_xaf).toBe(165);
    expect((await wallet(u.id)).balance_xaf).toBe(835);
  });

  it('arrondit 164,4 vers le haut : 137 XAF/1000 x 1200 = 165', async () => {
    const s = await makeService({ price_xaf_1000: 137, min_qty: 10, max_qty: 10000 });
    const u = await client({ balance: 1000 });
    const { data, error } = await place(u.id, s.id, 1200);
    expect(error).toBeNull();
    expect(data.charged_xaf).toBe(165);
  });
});

describe('place_order : refus sans aucun changement', () => {
  it('refuse INSUFFICIENT_BALANCE si le solde ne couvre pas la commande', async () => {
    const s = await makeService({ price_xaf_1000: 1500 });
    const u = await client({ balance: 100 });
    const { error } = await place(u.id, s.id, 100);
    expect(error?.message).toContain('INSUFFICIENT_BALANCE');
    expect((await wallet(u.id)).balance_xaf).toBe(100);
    expect(await count('orders', u.id)).toBe(0);
    expect(await count('wallet_transactions', u.id)).toBe(0);
  });

  it('refuse ACCOUNT_BLOCKED pour un client bloqué', async () => {
    const s = await makeService();
    const u = await client({ balance: 5000, profile: { status: 'blocked' } });
    const { error } = await place(u.id, s.id, 100);
    expect(error?.message).toContain('ACCOUNT_BLOCKED');
    expect((await wallet(u.id)).balance_xaf).toBe(5000);
    expect(await count('orders', u.id)).toBe(0);
  });

  it('refuse SERVICE_UNAVAILABLE pour un service inactif', async () => {
    const s = await makeService({ active: false });
    const u = await client({ balance: 5000 });
    const { error } = await place(u.id, s.id, 100);
    expect(error?.message).toContain('SERVICE_UNAVAILABLE');
    expect((await wallet(u.id)).balance_xaf).toBe(5000);
  });

  it('refuse SERVICE_UNAVAILABLE pour un service indisponible', async () => {
    const s = await makeService({ available: false });
    const u = await client({ balance: 5000 });
    const { error } = await place(u.id, s.id, 100);
    expect(error?.message).toContain('SERVICE_UNAVAILABLE');
    expect((await wallet(u.id)).balance_xaf).toBe(5000);
  });

  it('refuse QUANTITY_OUT_OF_RANGE sous le minimum du service', async () => {
    const s = await makeService({ min_qty: 50, max_qty: 500 });
    const u = await client({ balance: 5000 });
    const { error } = await place(u.id, s.id, 49);
    expect(error?.message).toContain('QUANTITY_OUT_OF_RANGE');
    expect((await wallet(u.id)).balance_xaf).toBe(5000);
    expect(await count('orders', u.id)).toBe(0);
  });

  it('refuse QUANTITY_OUT_OF_RANGE au-dessus du maximum du service', async () => {
    const s = await makeService({ min_qty: 50, max_qty: 500 });
    const u = await client({ balance: 5000 });
    const { error } = await place(u.id, s.id, 501);
    expect(error?.message).toContain('QUANTITY_OUT_OF_RANGE');
    expect((await wallet(u.id)).balance_xaf).toBe(5000);
  });

  it('accepte exactement le minimum et le maximum', async () => {
    const s = await makeService({ min_qty: 50, max_qty: 500, price_xaf_1000: 1000 });
    const u = await client({ balance: 5000 });
    expect((await place(u.id, s.id, 50)).error).toBeNull();
    expect((await place(u.id, s.id, 500)).error).toBeNull();
  });

  it('refuse PRICE_CHANGED si le prix attendu diffère du prix actuel, sans débit', async () => {
    const s = await makeService({ price_xaf_1000: 1500 });
    const u = await client({ balance: 5000 });
    const { error } = await place(u.id, s.id, 100, { p_expected_price_xaf_1000: 1400 });
    expect(error?.message).toContain('PRICE_CHANGED');
    expect((await wallet(u.id)).balance_xaf).toBe(5000);
    expect(await count('orders', u.id)).toBe(0);
  });

  it('accepte le prix attendu quand il est identique au prix actuel', async () => {
    const s = await makeService({ price_xaf_1000: 1500 });
    const u = await client({ balance: 5000 });
    const { error } = await place(u.id, s.id, 100, { p_expected_price_xaf_1000: 1500 });
    expect(error).toBeNull();
  });
});

describe('place_order : idempotence et parallélisme', () => {
  it('même idem_key deux fois : une seule commande, un seul débit, même commande renvoyée', async () => {
    const s = await makeService({ price_xaf_1000: 1500 });
    const u = await client({ balance: 1000 });
    const key = randomUUID();
    const a = await place(u.id, s.id, 100, { p_idem_key: key });
    const b = await place(u.id, s.id, 100, { p_idem_key: key });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(b.data.id).toBe(a.data.id);
    expect(await count('orders', u.id)).toBe(1);
    expect(await count('wallet_transactions', u.id)).toBe(1);
    expect((await wallet(u.id)).balance_xaf).toBe(850);
  });

  it('deux commandes en parallèle dépassant le solde : une seule passe, solde jamais négatif', async () => {
    const s = await makeService({ price_xaf_1000: 1000, min_qty: 10, max_qty: 10000 });
    const u = await client({ balance: 1000 });
    const [a, b] = await Promise.all([place(u.id, s.id, 600), place(u.id, s.id, 600)]);
    const errors = [a.error, b.error].filter(Boolean);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('INSUFFICIENT_BALANCE');
    expect(await count('orders', u.id)).toBe(1);
    expect((await wallet(u.id)).balance_xaf).toBe(400);
  });
});

describe('place_order : plafond journalier', () => {
  it('refuse DAILY_LIMIT_REACHED quand les 24 h glissantes dépasseraient le plafond', async () => {
    const s = await makeService({ price_xaf_1000: 1000 });
    const u = await client({ balance: 10000, profile: { daily_spend_limit_xaf: 1000 } });
    await makeOrder(u.id, s.id, { charged_xaf: 600 });
    const { error } = await place(u.id, s.id, 500); // 500 XAF : 600 + 500 > 1000
    expect(error?.message).toContain('DAILY_LIMIT_REACHED');
    expect((await wallet(u.id)).balance_xaf).toBe(10000);
    expect(await count('orders', u.id)).toBe(1);
  });

  it('ne compte pas les commandes de plus de 24 h', async () => {
    const s = await makeService({ price_xaf_1000: 1000 });
    const u = await client({ balance: 10000, profile: { daily_spend_limit_xaf: 1000 } });
    const old = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    await makeOrder(u.id, s.id, { charged_xaf: 900, created_at: old });
    const { error } = await place(u.id, s.id, 500);
    expect(error).toBeNull();
  });
});

describe('place_order : remises (jamais cumulées)', () => {
  it('applique la remise auto de 10 % dès 50 000 XAF rechargés', async () => {
    const s = await makeService({ price_xaf_1000: 1000, max_qty: 10000 });
    const u = await client({ balance: 5000, recharged: 50000 });
    const { data, error } = await place(u.id, s.id, 1000);
    expect(error).toBeNull();
    expect(Number(data.discount_pct)).toBe(10);
    expect(data.charged_xaf).toBe(900);
  });

  it("n'applique pas la remise auto sous le seuil (49 999)", async () => {
    const s = await makeService({ price_xaf_1000: 1000, max_qty: 10000 });
    const u = await client({ balance: 5000, recharged: 49999 });
    const { data, error } = await place(u.id, s.id, 1000);
    expect(error).toBeNull();
    expect(Number(data.discount_pct)).toBe(0);
    expect(data.charged_xaf).toBe(1000);
  });

  it('remise perso plus grande que 10 % : elle gagne (20 % -> 800)', async () => {
    const s = await makeService({ price_xaf_1000: 1000, max_qty: 10000 });
    const u = await client({
      balance: 5000,
      recharged: 60000,
      profile: { custom_discount_pct: 20 },
    });
    const { data, error } = await place(u.id, s.id, 1000);
    expect(error).toBeNull();
    expect(Number(data.discount_pct)).toBe(20);
    expect(data.charged_xaf).toBe(800);
  });

  it('remise perso plus petite que la remise auto : la remise auto gagne (5 % vs 10 % -> 900)', async () => {
    const s = await makeService({ price_xaf_1000: 1000, max_qty: 10000 });
    const u = await client({
      balance: 5000,
      recharged: 60000,
      profile: { custom_discount_pct: 5 },
    });
    const { data, error } = await place(u.id, s.id, 1000);
    expect(error).toBeNull();
    expect(Number(data.discount_pct)).toBe(10);
    expect(data.charged_xaf).toBe(900);
  });

  it('remise perso seule, sans remise auto (5 % -> 950)', async () => {
    const s = await makeService({ price_xaf_1000: 1000, max_qty: 10000 });
    const u = await client({ balance: 5000, profile: { custom_discount_pct: 5 } });
    const { data, error } = await place(u.id, s.id, 1000);
    expect(error).toBeNull();
    expect(Number(data.discount_pct)).toBe(5);
    expect(data.charged_xaf).toBe(950);
  });

  it('arrondit au XAF supérieur après remise (333 x 0,9 = 299,7 -> 300)', async () => {
    const s = await makeService({ price_xaf_1000: 333, max_qty: 10000 });
    const u = await client({ balance: 5000, recharged: 50000 });
    const { data, error } = await place(u.id, s.id, 1000);
    expect(error).toBeNull();
    expect(data.charged_xaf).toBe(300);
  });
});

describe('place_order : sécurité', () => {
  it('ne prend aucun montant de l appelant : un paramètre montant est rejeté, rien n est débité', async () => {
    const s = await makeService({ price_xaf_1000: 1500 });
    const u = await client({ balance: 1000 });
    // La fonction doit exister (sinon PGRST202) et refuser le paramètre inconnu.
    const ok = await place(u.id, s.id, 100);
    expect(ok.error).toBeNull();
    const { error } = await place(u.id, s.id, 100, { p_charged_xaf: 1 });
    expect(error).not.toBeNull();
    expect(await count('orders', u.id)).toBe(1);
    expect((await wallet(u.id)).balance_xaf).toBe(850);
  });

  it('un client authentifié ne peut pas appeler la fonction directement', async () => {
    const s = await makeService({ price_xaf_1000: 1500 });
    const u = await client({ balance: 1000 });
    // Contrôle : le service peut appeler (la fonction existe), le client non.
    expect((await place(u.id, s.id, 100)).error).toBeNull();
    const uc = await userClient(u.id);
    const { error } = await uc.rpc('place_order', {
      p_user: u.id,
      p_service: s.id,
      p_link: LINK,
      p_qty: 100,
      p_comments: null,
      p_idem_key: randomUUID(),
    });
    expect(error).not.toBeNull();
    expect((await wallet(u.id)).balance_xaf).toBe(850);
    expect(await count('orders', u.id)).toBe(1);
  });
});
