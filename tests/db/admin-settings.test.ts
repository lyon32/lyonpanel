import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAdmin, fakeSession } from '../helpers/admin-db';
import { ROUTES, auditRows, callRoute, failAuditFor } from '../helpers/admin-phase12';
import type { ErrorBody } from '../helpers/client-area-db';
import { resetOrderSettings, setSetting } from '../helpers/orders-db';
import { adminClient } from './helpers/client';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const session = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/server/db/supabase-server', () => ({ createSessionClient: async () => session.client }));

/*
 * Réglages admin (phase 12, « Mes choix »). Clés modifiables : usd_xaf_rate, default_multiplier, min_recharge_xaf,
 * max_recharge_xaf, daily_order_cap_xaf, provider_low_balance_usd, price_alert_pct, auto_discount, referral_pct.
 *   GET   /admin/settings -> { settings: { <clé>: <valeur> } } (aucun secret)
 *   PATCH /admin/settings { <clé>: <valeur>, ... } -> 200 { settings } ; corps strict, champs bornés (Zod)
 * Audit : une ligne `update_setting` PAR clé modifiée, target_id = la clé, details { old, new }.
 * Règle croisée : min_recharge_xaf doit rester <= max_recharge_xaf.
 */
const db = adminClient();
let admin: Awaited<ReturnType<typeof ensureAdmin>>;
const code = async (r: Response) => ((await r.json()) as ErrorBody).error.code;
const patch = (body: unknown) =>
  callRoute(ROUTES.settings, 'PATCH', '/api/v1/admin/settings', { body });
const value = async (key: string) =>
  (await db.from('settings').select('value').eq('key', key).single()).data?.value;
const RESTORE: Record<string, unknown> = {
  usd_xaf_rate: 600,
  default_multiplier: 3,
  min_recharge_xaf: 500,
  max_recharge_xaf: 500_000,
  referral_pct: 5,
  price_alert_pct: 20,
};

beforeAll(async () => {
  admin = await ensureAdmin();
});
afterAll(async () => admin.release());
beforeEach(() => {
  session.client = fakeSession(admin.id, { current: 'aal2' });
});
afterEach(async () => {
  for (const [k, v] of Object.entries(RESTORE)) await setSetting(k, v);
  await resetOrderSettings();
});

describe('GET /admin/settings', () => {
  it('liste les réglages modifiables et aucun secret', async () => {
    const res = await callRoute(ROUTES.settings, 'GET', '/api/v1/admin/settings');
    expect(res.status).toBe(200);
    const { settings } = (await res.json()) as { settings: Record<string, unknown> };
    expect(settings).toMatchObject({ usd_xaf_rate: 600, default_multiplier: 3 });
    for (const k of Object.keys(settings)) expect(k).not.toMatch(/key|secret|token|password/i);
  });
});

describe('PATCH /admin/settings', () => {
  it('change une valeur et garde l’ancienne dans le journal', async () => {
    const res = await patch({ usd_xaf_rate: 650 });
    expect(res.status).toBe(200);
    expect(await value('usd_xaf_rate')).toBe(650);
    const rows = await auditRows('update_setting', 'usd_xaf_rate');
    const last = rows[rows.length - 1]!;
    expect(last).toMatchObject({ actor_id: admin.id, target_table: 'settings' });
    expect(last.details).toMatchObject({ old: 600, new: 650 });
  });

  it('plusieurs clés dans une requête : une ligne de journal par clé', async () => {
    await patch({ referral_pct: 7, price_alert_pct: 25 });
    expect((await auditRows('update_setting', 'referral_pct')).length).toBeGreaterThanOrEqual(1);
    expect((await auditRows('update_setting', 'price_alert_pct')).length).toBeGreaterThanOrEqual(1);
    expect(await value('referral_pct')).toBe(7);
    expect(await value('price_alert_pct')).toBe(25);
  });

  it('remise automatique : seuil et pourcentage enregistrés ensemble', async () => {
    expect((await patch({ auto_discount: { threshold_xaf: 80_000, pct: 8 } })).status).toBe(200);
    expect(await value('auto_discount')).toEqual({ threshold_xaf: 80_000, pct: 8 });
  });

  it.each([
    ['usd_xaf_rate', 0],
    ['usd_xaf_rate', -1],
    ['default_multiplier', 0],
    ['referral_pct', 101],
    ['min_recharge_xaf', -5],
    ['price_alert_pct', 100_000],
  ])('valeur hors bornes %s = %j : 400 VALIDATION_ERROR, rien ne change', async (key, v) => {
    const before = await value(key);
    const res = await patch({ [key]: v });
    expect(res.status).toBe(400);
    expect(await code(res)).toBe('VALIDATION_ERROR');
    expect(await value(key)).toEqual(before);
  });

  it('refuse une clé inconnue ou secrète et n’en crée aucune', async () => {
    for (const k of ['saspay_api_key', 'service_role_key', 'nimporte']) {
      expect((await patch({ [k]: 'x' })).status).toBe(400);
      const { data } = await db.from('settings').select('key').eq('key', k);
      expect(data).toEqual([]);
    }
  });

  it('refuse un minimum de recharge supérieur au maximum', async () => {
    const res = await patch({ min_recharge_xaf: 600_000 });
    expect(res.status).toBe(400);
    expect(await value('min_recharge_xaf')).toBe(500);
  });

  it('une requête avec une clé valide et une clé invalide ne change rien du tout', async () => {
    const res = await patch({ usd_xaf_rate: 700, referral_pct: 500 });
    expect(res.status).toBe(400);
    expect(await value('usd_xaf_rate')).toBe(600);
  });

  it('atomique : si la trace échoue, la valeur reste l’ancienne', async () => {
    const restore = failAuditFor(['update_setting']);
    try {
      expect((await patch({ usd_xaf_rate: 700 })).status).toBeGreaterThanOrEqual(500);
    } finally {
      restore();
    }
    expect(await value('usd_xaf_rate')).toBe(600);
  });

  it('la trace n’enregistre aucun secret : les détails ne contiennent que ancienne et nouvelle valeur', async () => {
    await patch({ usd_xaf_rate: 640 });
    const rows = await auditRows('update_setting', 'usd_xaf_rate');
    const details = rows[rows.length - 1]!.details as Record<string, unknown>;
    expect(Object.keys(details).sort()).toEqual(['new', 'old']);
  });
});
