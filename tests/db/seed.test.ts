import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { adminClient } from './helpers/client';

// Contrat du seed : services fictifs d'ids 900001 à 900020, aucun client.
const SEED_FIRST_ID = 900001;
const SEED_LAST_ID = 900020;

type SeedService = {
  id: number;
  platform: string;
  name_fr: string;
  provider_name: string;
  cost_usd_1000: number;
  price_xaf_1000: number;
  min_qty: number;
  max_qty: number;
  active: boolean;
  available: boolean;
};

async function getSetting(key: string): Promise<unknown> {
  const { data, error } = await adminClient()
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  expect(error).toBeNull();
  expect(data, `réglage manquant : ${key}`).not.toBeNull();
  return data?.value;
}

async function seedServices(): Promise<SeedService[]> {
  const { data, error } = await adminClient()
    .from('services')
    .select('*')
    .gte('id', SEED_FIRST_ID)
    .lte('id', SEED_LAST_ID)
    .order('id');
  expect(error).toBeNull();
  return (data ?? []) as SeedService[];
}

describe('seed : réglages par défaut', () => {
  it.each([
    ['usd_xaf_rate', 600],
    ['min_recharge_xaf', 3000],
    ['referral_pct', 5],
    ['provider_low_balance_usd', 5],
    ['limited_launch', false],
  ])('le réglage %s vaut %j', async (key, expected) => {
    expect(await getSetting(key)).toEqual(expected);
  });

  it('auto_discount vaut 50 000 XAF et 10 %', async () => {
    expect(await getSetting('auto_discount')).toEqual({ threshold_xaf: 50000, pct: 10 });
  });

  it('saspay_fee_pct et price_alert_pct existent et sont des nombres positifs', async () => {
    for (const key of ['saspay_fee_pct', 'price_alert_pct']) {
      const value = await getSetting(key);
      expect(typeof value, key).toBe('number');
      expect(value as number, key).toBeGreaterThan(0);
    }
  });
});

describe('seed : services fictifs', () => {
  it('contient entre 18 et 24 services dans la plage 900001-900020', async () => {
    const rows = await seedServices();
    expect(rows.length).toBeGreaterThanOrEqual(18);
    expect(rows.length).toBeLessThanOrEqual(24);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('couvre tiktok, instagram et facebook', async () => {
    const platforms = new Set((await seedServices()).map((r) => r.platform));
    for (const p of ['tiktok', 'instagram', 'facebook']) expect(platforms.has(p), p).toBe(true);
  });

  it('active tous les services (actifs et disponibles)', async () => {
    const rows = await seedServices();
    expect(rows.filter((r) => !r.active || !r.available)).toEqual([]);
  });

  it('a des quantités cohérentes : 0 < min_qty <= max_qty', async () => {
    for (const r of await seedServices()) {
      expect(r.min_qty, `service ${r.id}`).toBeGreaterThan(0);
      expect(r.min_qty, `service ${r.id}`).toBeLessThanOrEqual(r.max_qty);
    }
  });

  it('applique le prix = coût × taux × 3, arrondi aux 5 XAF supérieurs', async () => {
    const rate = (await getSetting('usd_xaf_rate')) as number;
    const mult = (await getSetting('default_multiplier')) as number;
    for (const r of await seedServices()) {
      const costXaf = Number(r.cost_usd_1000) * rate;
      expect(Number.isInteger(Number(r.price_xaf_1000)), `service ${r.id}`).toBe(true);
      expect(Number(r.price_xaf_1000), `service ${r.id}`).toBeGreaterThanOrEqual(costXaf);
      expect(Number(r.price_xaf_1000), `service ${r.id}`).toBe(
        Math.ceil(Math.round(costXaf * mult * 1e6) / 1e6 / 5) * 5,
      );
    }
  });

  it('utilise des noms fournisseur fictifs et des noms FR sans prix ni étiquette JAP', async () => {
    for (const r of await seedServices()) {
      expect(r.provider_name, `service ${r.id}`).toMatch(/SEED|TEST/);
      expect(r.name_fr, `service ${r.id}`).not.toMatch(/\d\s*(\$|usd|xaf|fcfa)|\$|JAP|SEED|TEST/i);
    }
  });

  it('la vue services_public ne renvoie que les services actifs et disponibles du seed', async () => {
    const rows = await seedServices();
    const expectedIds = rows.filter((r) => r.active && r.available).map((r) => r.id);
    const { data, error } = await adminClient()
      .from('services_public')
      .select('id')
      .gte('id', SEED_FIRST_ID)
      .lte('id', SEED_LAST_ID);
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.id as number).sort((a, b) => a - b)).toEqual(expectedIds);
  });
});

describe('seed : aucune donnée réelle', () => {
  it('ne crée aucun faux client (aucun compte réel hors @lyonpanel.test, et seed.sql ne crée aucun compte)', async () => {
    const { data, error } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
    expect(error).toBeNull();
    // Les comptes anonymisés (email NULL) laissés par d'autres tests sont ignorés.
    const foreign = data.users.filter((u) => u.email && !u.email.endsWith('@lyonpanel.test'));
    expect(foreign).toEqual([]);
    const sql = readFileSync(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8');
    expect(sql).not.toMatch(/insert\s+into\s+(auth\.users|(public\.)?profiles)/i);
  });
});
