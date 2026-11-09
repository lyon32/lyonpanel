import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeService } from '../factories/service';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, userClient } from './helpers/client';

// Migration de la phase 4 : colonnes jap_* -> provider_*, margin_pct -> multiplier,
// table price_multipliers (aucun accès client), vue services_public sans colonnes fournisseur.

const db = adminClient();
const RULE = { platform: 'soundcloud', category: 'shares' } as const;

let client: SupabaseClient;
let anon: SupabaseClient;
let userId: string;

beforeAll(async () => {
  const u = await makeUser();
  userId = u.id;
  client = await userClient(u.id);
  anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
});

afterEach(async () => {
  await db
    .from('price_multipliers')
    .delete()
    .eq('platform', RULE.platform)
    .eq('category', RULE.category);
});

afterAll(async () => {
  await removeUser(userId);
});

async function columnExists(table: string, column: string): Promise<boolean> {
  const { error } = await db.from(table).select(column).limit(1);
  return error === null;
}

describe('colonnes renommées par la migration', () => {
  it.each([
    ['services', 'provider_name'],
    ['services', 'provider_type'],
    ['services', 'multiplier'],
    ['orders', 'provider_order_id'],
    ['service_price_history', 'multiplier'],
  ])('%s.%s existe', async (table, column) => {
    expect(await columnExists(table, column)).toBe(true);
  });

  it.each([
    ['services', 'jap_name'],
    ['services', 'jap_type'],
    ['services', 'margin_pct'],
    ['orders', 'jap_order_id'],
    ['service_price_history', 'margin_pct'],
  ])('%s.%s n existe plus', async (table, column) => {
    expect(await columnExists(table, column)).toBe(false);
  });

  it('la table provider_balance_snapshots existe, jap_balance_snapshots a disparu', async () => {
    expect(await columnExists('provider_balance_snapshots', '*')).toBe(true);
    expect(await columnExists('jap_balance_snapshots', '*')).toBe(false);
  });
});

describe('services.multiplier et services.active', () => {
  it('multiplier est facultatif (null = suivre la règle)', async () => {
    const s = await makeService();
    expect(s.multiplier).toBeNull();
  });

  it('accepte un multiplicateur positif décimal', async () => {
    const s = await makeService({ multiplier: 2.5 });
    expect(Number(s.multiplier)).toBe(2.5);
  });

  it('arrondit le multiplicateur à 2 décimales (numeric(8,2))', async () => {
    const s = await makeService({ multiplier: 2.555 });
    expect(Number(s.multiplier)).toBeCloseTo(2.56, 2);
  });

  it.each([0, -1, -0.01])('refuse le multiplicateur %s', async (m) => {
    await expect(makeService({ multiplier: m })).rejects.toThrow();
  });

  it('un nouveau service est actif par défaut', async () => {
    const s = await makeService({ active: undefined, available: undefined });
    expect(s.active).toBe(true);
    expect(s.available).toBe(true);
  });
});

describe('price_multipliers', () => {
  it('enregistre une règle (réseau, type) avec son multiplicateur', async () => {
    const { error } = await db.from('price_multipliers').insert({ ...RULE, multiplier: 4 });
    expect(error).toBeNull();
    const { data } = await db.from('price_multipliers').select('*').match(RULE).single();
    expect(Number(data?.multiplier)).toBe(4);
    expect(data?.updated_at).toEqual(expect.any(String));
  });

  it('refuse un doublon (réseau, type) : clé primaire', async () => {
    await db.from('price_multipliers').insert({ ...RULE, multiplier: 4 });
    const { error } = await db.from('price_multipliers').insert({ ...RULE, multiplier: 5 });
    expect(error?.code).toBe('23505');
  });

  it.each([0, -1, -3])('refuse un multiplicateur %s (doit être > 0)', async (m) => {
    const { error } = await db.from('price_multipliers').insert({ ...RULE, multiplier: m });
    expect(error?.code).toBe('23514');
  });

  it('refuse un multiplicateur absent', async () => {
    const { error } = await db.from('price_multipliers').insert({ ...RULE });
    expect(error).not.toBeNull();
  });

  it('arrondit à 2 décimales', async () => {
    await db.from('price_multipliers').insert({ ...RULE, multiplier: 2.555 });
    const { data } = await db.from('price_multipliers').select('multiplier').match(RULE).single();
    expect(Number(data?.multiplier)).toBeCloseTo(2.56, 2);
  });

  it('autorise la mise à jour par le serveur (upsert)', async () => {
    await db.from('price_multipliers').insert({ ...RULE, multiplier: 4 });
    const { error } = await db.from('price_multipliers').upsert({ ...RULE, multiplier: 6 });
    expect(error).toBeNull();
    const { data } = await db.from('price_multipliers').select('multiplier').match(RULE).single();
    expect(Number(data?.multiplier)).toBe(6);
  });

  describe.each([
    ['visiteur anonyme', () => anon],
    ['client connecté', () => client],
  ])('aucun accès pour le %s', (_label, who) => {
    it('ne lit aucune règle', async () => {
      await db.from('price_multipliers').insert({ ...RULE, multiplier: 4 });
      const { data } = await who().from('price_multipliers').select('*');
      expect(data ?? []).toEqual([]);
    });

    it('ne peut pas créer de règle', async () => {
      const { error } = await who()
        .from('price_multipliers')
        .insert({ ...RULE, multiplier: 1 });
      expect(error).not.toBeNull();
      const { data } = await db.from('price_multipliers').select('*').match(RULE);
      expect(data ?? []).toEqual([]);
    });

    it('ne peut ni modifier ni supprimer une règle', async () => {
      await db.from('price_multipliers').insert({ ...RULE, multiplier: 4 });
      await who().from('price_multipliers').update({ multiplier: 99 }).match(RULE);
      await who().from('price_multipliers').delete().match(RULE);
      const { data } = await db.from('price_multipliers').select('multiplier').match(RULE).single();
      expect(Number(data?.multiplier)).toBe(4);
    });
  });
});

describe('vue services_public', () => {
  const HIDDEN = [
    'provider_name',
    'provider_type',
    'cost_usd_1000',
    'multiplier',
    'margin_pct',
    'jap_name',
    'jap_type',
  ];
  const EXPECTED = [
    'id',
    'platform',
    'category',
    'name_fr',
    'price_xaf_1000',
    'min_qty',
    'max_qty',
    'refill',
    'cancel',
    'dripfeed',
    'sort_order',
  ];

  it.each([
    ['visiteur anonyme', () => anon],
    ['client connecté', () => client],
  ])('%s : n expose aucune colonne fournisseur, coût ni multiplicateur', async (_l, who) => {
    const s = await makeService({ multiplier: 4 });
    const { data, error } = await who().from('services_public').select('*').eq('id', s.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    const cols = Object.keys(data![0]);
    for (const hidden of HIDDEN) expect(cols, hidden).not.toContain(hidden);
    for (const col of EXPECTED) expect(cols, col).toContain(col);
  });

  it('refuse de lire une colonne cachée explicitement', async () => {
    for (const hidden of ['provider_name', 'provider_type', 'cost_usd_1000', 'multiplier']) {
      const { error } = await anon.from('services_public').select(hidden).limit(1);
      expect(error, hidden).not.toBeNull();
    }
  });

  it('ne contient que les services actifs ET disponibles', async () => {
    const live = await makeService({ active: true, available: true });
    const inactive = await makeService({ active: false, available: true });
    const gone = await makeService({ active: true, available: false });
    const { data } = await anon
      .from('services_public')
      .select('id')
      .in('id', [live.id, inactive.id, gone.id]);
    expect((data ?? []).map((r) => r.id)).toEqual([live.id]);
  });

  it('un client ne lit pas la table services directement', async () => {
    const s = await makeService();
    const { data } = await client
      .from('services')
      .select('provider_name, cost_usd_1000, multiplier')
      .eq('id', s.id);
    expect(data ?? []).toEqual([]);
    const anonRead = await anon.from('services').select('*').eq('id', s.id);
    expect(anonRead.data ?? []).toEqual([]);
  });
});

describe('service_price_history', () => {
  it('enregistre le multiplicateur appliqué (et plus de marge)', async () => {
    const s = await makeService();
    const { error } = await db.from('service_price_history').insert({
      service_id: s.id,
      cost_usd_1000: 1.5,
      price_xaf_1000: 2700,
      multiplier: 3,
      usd_xaf_rate: 600,
      reason: 'sync',
    });
    expect(error).toBeNull();
    const { data } = await db
      .from('service_price_history')
      .select('multiplier')
      .eq('service_id', s.id)
      .single();
    expect(Number(data?.multiplier)).toBe(3);
  });

  it.each(['sync', 'admin', 'taux'])('accepte la raison %s', async (reason) => {
    const s = await makeService();
    const { error } = await db.from('service_price_history').insert({
      service_id: s.id,
      cost_usd_1000: 1,
      price_xaf_1000: 1800,
      multiplier: 3,
      usd_xaf_rate: 600,
      reason,
    });
    expect(error).toBeNull();
  });

  it('refuse la colonne margin_pct', async () => {
    const s = await makeService();
    const { error } = await db.from('service_price_history').insert({
      service_id: s.id,
      cost_usd_1000: 1,
      price_xaf_1000: 1800,
      margin_pct: 60,
      usd_xaf_rate: 600,
      reason: 'sync',
    });
    expect(error).not.toBeNull();
  });
});

describe('réglages après la migration', () => {
  async function setting(key: string) {
    return db.from('settings').select('value').eq('key', key).maybeSingle();
  }

  it('default_multiplier vaut 3', async () => {
    expect((await setting('default_multiplier')).data?.value).toBe(3);
  });

  it('usd_xaf_rate vaut toujours 600', async () => {
    expect((await setting('usd_xaf_rate')).data?.value).toBe(600);
  });

  it('provider_low_balance_usd existe, jap_low_balance_usd a disparu', async () => {
    expect((await setting('provider_low_balance_usd')).data?.value).toBe(5);
    expect((await setting('jap_low_balance_usd')).data).toBeNull();
  });

  it('le réglage margins n existe plus', async () => {
    expect((await setting('margins')).data).toBeNull();
  });

  it('un client ne lit aucun réglage (default_multiplier compris)', async () => {
    const { data } = await client.from('settings').select('*').eq('key', 'default_multiplier');
    expect(data ?? []).toEqual([]);
  });
});
