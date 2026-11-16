import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from '../factories/order';
import { makePayment } from '../factories/payment';
import { makeService } from '../factories/service';
import {
  daysAgo,
  ensureAdmin,
  fakeSession,
  hoursAgo,
  isolatedNow,
  load,
} from '../helpers/admin-db';
import { getReq } from '../helpers/client-area-db';
import { cleanupUsers, makeFundedUser, setSetting } from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Statistiques admin (phase 11, décision 2) : aujourd'hui / 7 jours / 30 jours.
 * Module attendu : src/server/admin/stats.ts
 *   getAdminStats(range: 'today' | '7d' | '30d', now?: Date): Promise<AdminStats>
 *   AdminStats = {
 *     range, from: string, to: string,                       // ISO
 *     sales_xaf, profit_xaf, orders_count,                   // commandes hors « refunded »
 *     recharges_xaf, recharges_count,                        // paiements « succeeded » (montant crédité)
 *     new_users_count,
 *     by_country: { country, sales_xaf, orders_count }[],    // triés par ventes décroissantes
 *     provider_balance_usd: number | null,                   // dernier relevé pris avant `now`
 *     provider_low: boolean,                                 // solde < settings.provider_low_balance_usd
 *   }
 * Bénéfice = charged_xaf - cost_usd x settings.usd_xaf_rate (tout en entiers XAF).
 * Route : GET /api/v1/admin/stats?range=today|7d|30d (défaut today) ; autre valeur : 400.
 * Toutes les lignes de test sont datées dans une année lointaine tirée au hasard : aucune autre donnée n'entre dans les fenêtres.
 */

type Stats = {
  range: string;
  sales_xaf: number;
  profit_xaf: number;
  orders_count: number;
  recharges_xaf: number;
  recharges_count: number;
  new_users_count: number;
  by_country: { country: string; sales_xaf: number; orders_count: number }[];
  provider_balance_usd: number | null;
  provider_low: boolean;
};
const db = adminClient();
const created: string[] = [];
const snapshotIds: number[] = [];
let now: Date;
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const stats = async (range: 'today' | '7d' | '30d', at = now) =>
  (
    await load<{ getAdminStats: (r: string, n?: Date) => Promise<Stats> }>('@/server/admin/stats')
  ).getAdminStats(range, at);

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => {
  await admin.release();
});

beforeEach(async () => {
  now = isolatedNow();
  await setSetting('usd_xaf_rate', 600);
  await setSetting('provider_low_balance_usd', 5);
  const service = await makeService();
  const cm = await makeFundedUser(created, {
    profile: { country: 'CM', created_at: hoursAgo(now, 0.5) },
  });
  const ci = await makeFundedUser(created, {
    profile: { country: 'CI', created_at: daysAgo(now, 5) },
  });
  const old = await makeFundedUser(created, {
    profile: { country: 'CM', created_at: daysAgo(now, 40) },
  });
  const order = (
    u: { id: string },
    at: string,
    charged: number,
    costUsd: number,
    status = 'completed',
  ) =>
    makeOrder(u.id, service.id, {
      created_at: at,
      charged_xaf: charged,
      cost_usd: costUsd,
      status,
    });
  await order(cm, hoursAgo(now, 0.5), 150, 0.15); // aujourd'hui : bénéfice 60
  await order(ci, daysAgo(now, 2), 300, 0.3, 'in_progress'); // 7 j : bénéfice 120
  await order(ci, hoursAgo(now, 24.5), 200, 0.1); // hier 12 h : 7 j, bénéfice 140
  await order(cm, daysAgo(now, 20), 1000, 1); // 30 j : bénéfice 400
  await order(cm, daysAgo(now, 40), 5000, 5); // hors 30 j
  await order(cm, hoursAgo(now, 0.5), 700, 0.5, 'refunded'); // remboursée : exclue partout
  const pay = (u: { id: string }, at: string, credited: number, status = 'succeeded') =>
    makePayment(u.id, {
      status,
      credited_xaf: credited,
      created_at: at,
      succeeded_at: status === 'succeeded' ? at : null,
    });
  await pay(cm, hoursAgo(now, 0.5), 10000);
  await pay(ci, daysAgo(now, 3), 5000);
  await pay(cm, hoursAgo(now, 0.5), 7000, 'failed');
  await pay(cm, hoursAgo(now, 0.5), 8000, 'pending');
  await pay(old, daysAgo(now, 40), 9000);
});
afterEach(async () => {
  while (snapshotIds.length)
    await db.from('provider_balance_snapshots').delete().eq('id', snapshotIds.pop()!);
  await cleanupUsers(created);
});

describe('getAdminStats', () => {
  it('aujourd’hui : ventes 150, bénéfice 60, 1 commande, recharge 10 000, 1 nouveau client', async () => {
    const s = await stats('today');
    expect(s).toMatchObject({
      range: 'today',
      sales_xaf: 150,
      profit_xaf: 60,
      orders_count: 1,
      recharges_xaf: 10000,
      recharges_count: 1,
      new_users_count: 1,
    });
  });

  it('7 jours : hier et il y a 2 jours comptent, pas il y a 20 jours', async () => {
    const s = await stats('7d');
    expect(s).toMatchObject({
      sales_xaf: 650,
      profit_xaf: 320,
      orders_count: 3,
      recharges_xaf: 15000,
      recharges_count: 2,
      new_users_count: 2,
    });
  });

  it('30 jours : tout sauf il y a 40 jours', async () => {
    const s = await stats('30d');
    expect(s).toMatchObject({
      sales_xaf: 1650,
      profit_xaf: 720,
      orders_count: 4,
      recharges_xaf: 15000,
      recharges_count: 2,
      new_users_count: 2,
    });
  });

  it('une commande remboursée n’entre ni dans les ventes, ni dans le bénéfice, ni dans le nombre', async () => {
    const s = await stats('today');
    expect(s.sales_xaf).toBe(150); // 150 + 700 si elle comptait
    expect(s.orders_count).toBe(1);
  });

  it('une recharge échouée ou en attente n’est jamais comptée', async () => {
    expect((await stats('today')).recharges_xaf).toBe(10000); // 25 000 si elles comptaient
  });

  it('répartition par pays (7 jours), triée par ventes décroissantes', async () => {
    const s = await stats('7d');
    expect(s.by_country).toEqual([
      { country: 'CI', sales_xaf: 500, orders_count: 2 },
      { country: 'CM', sales_xaf: 150, orders_count: 1 },
    ]);
  });

  it('répartition par pays (30 jours)', async () => {
    const s = await stats('30d');
    expect(s.by_country).toEqual([
      { country: 'CM', sales_xaf: 1150, orders_count: 2 },
      { country: 'CI', sales_xaf: 500, orders_count: 2 },
    ]);
  });

  it('période sans aucune donnée : des zéros et une liste vide, jamais d’erreur', async () => {
    const empty = new Date(Date.UTC(3500, 0, 1, 12));
    const s = await stats('30d', empty);
    expect(s).toMatchObject({
      sales_xaf: 0,
      profit_xaf: 0,
      orders_count: 0,
      recharges_xaf: 0,
      new_users_count: 0,
    });
    expect(s.by_country).toEqual([]);
  });

  it('tous les montants en XAF sont des entiers', async () => {
    const s = await stats('30d');
    for (const v of [
      s.sales_xaf,
      s.profit_xaf,
      s.recharges_xaf,
      ...s.by_country.map((c) => c.sales_xaf),
    ]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('suit le taux du réglage usd_xaf_rate pour le bénéfice', async () => {
    await setSetting('usd_xaf_rate', 700);
    // 150 - 0.15 x 700 = 45
    expect((await stats('today')).profit_xaf).toBe(45);
  });
});

describe('solde fournisseur et alerte sous 5 $', () => {
  async function snapshot(balance: number) {
    const { data } = await db
      .from('provider_balance_snapshots')
      .insert({ balance_usd: balance, taken_at: hoursAgo(now, 1) })
      .select('id')
      .single();
    snapshotIds.push(Number(data!.id));
  }

  it('4,99 $ : alerte', async () => {
    await snapshot(4.99);
    expect(await stats('today')).toMatchObject({ provider_balance_usd: 4.99, provider_low: true });
  });
  it('5,00 $ pile : pas d’alerte (« sous 5 $ »)', async () => {
    await snapshot(5);
    expect(await stats('today')).toMatchObject({ provider_balance_usd: 5, provider_low: false });
  });
  it('12,50 $ : pas d’alerte', async () => {
    await snapshot(12.5);
    expect(await stats('today')).toMatchObject({ provider_balance_usd: 12.5, provider_low: false });
  });
  it('le seuil suit le réglage provider_low_balance_usd', async () => {
    await setSetting('provider_low_balance_usd', 20);
    await snapshot(12.5);
    expect((await stats('today')).provider_low).toBe(true);
  });
  it('prend le relevé le plus récent', async () => {
    await db
      .from('provider_balance_snapshots')
      .insert({ balance_usd: 100, taken_at: hoursAgo(now, 5) });
    await snapshot(3);
    const s = await stats('today');
    expect(s.provider_balance_usd).toBe(3);
    await db
      .from('provider_balance_snapshots')
      .delete()
      .eq('balance_usd', 100)
      .eq('taken_at', hoursAgo(now, 5));
  });
});

describe('GET /api/v1/admin/stats', () => {
  type Handler = (req: Request) => Promise<Response>;
  const get = async (qs: string) =>
    (await load<{ GET: Handler }>('@/app/api/v1/admin/stats/route')).GET(
      getReq(`/api/v1/admin/stats${qs}`),
    );
  const asAdmin = () => (session.client = fakeSession(admin.id, { current: 'aal2' }));

  it.each(['today', '7d', '30d'])('range=%s : 200 avec les chiffres, réponse privée', async (r) => {
    asAdmin();
    const res = await get(`?range=${r}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/private/);
    const body = (await res.json()) as Stats;
    expect(body.range).toBe(r);
    for (const k of [
      'sales_xaf',
      'profit_xaf',
      'orders_count',
      'recharges_xaf',
      'new_users_count',
      'by_country',
      'provider_balance_usd',
      'provider_low',
    ]) {
      expect(body).toHaveProperty(k);
    }
  });

  it('sans range : « today » par défaut', async () => {
    asAdmin();
    expect(((await (await get('')).json()) as Stats).range).toBe('today');
  });

  it.each(['year', '90d', '7d;drop', 'TODAY'])(
    'range=%j refusé : 400 VALIDATION_ERROR',
    async (r) => {
      asAdmin();
      const res = await get(`?range=${encodeURIComponent(r)}`);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
        'VALIDATION_ERROR',
      );
      expect(res.status).toBe(400);
    },
  );
});
