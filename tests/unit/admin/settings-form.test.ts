import { describe, expect, it } from 'vitest';
import {
  diffSettings,
  readSettingValues,
  SETTING_FIELDS,
  type SettingInputs,
} from '@/lib/admin-settings-form';

const api = {
  usd_xaf_rate: 600,
  default_multiplier: 2.5,
  min_recharge_xaf: 500,
  max_recharge_xaf: 500000,
  daily_order_cap_xaf: 1000000,
  provider_low_balance_usd: 5,
  price_alert_pct: 30,
  referral_pct: 5,
  auto_discount: { threshold_xaf: 100000, pct: 3 },
};
const current = readSettingValues(api)!;
const inputs = (over: Partial<SettingInputs> = {}): SettingInputs => ({
  ...(Object.fromEntries(
    SETTING_FIELDS.map((f) => [f.key, String(current[f.key])]),
  ) as SettingInputs),
  ...over,
});

describe('réglages admin (écran)', () => {
  it('lit la remise automatique imbriquée et refuse une valeur manquante', () => {
    expect(current.auto_discount_pct).toBe(3);
    expect(readSettingValues({ usd_xaf_rate: 600 })).toBeNull();
  });
  it('sans changement : aucune modification', () => {
    expect(diffSettings(current, inputs()).changes).toEqual([]);
  });
  it("n'envoie que les champs modifiés, avec ancienne et nouvelle valeur", () => {
    const d = diffSettings(current, inputs({ usd_xaf_rate: '610,5' }));
    expect(d.invalid).toEqual([]);
    expect(d.patch).toEqual({ usd_xaf_rate: 610.5 });
    expect(d.changes).toEqual([{ key: 'usd_xaf_rate', oldValue: 600, newValue: 610.5 }]);
  });
  it('remise automatique : envoie les deux valeurs ensemble', () => {
    const d = diffSettings(current, inputs({ auto_discount_pct: '4' }));
    expect(d.patch).toEqual({ auto_discount: { threshold_xaf: 100000, pct: 4 } });
  });
  it('refuse les valeurs hors bornes du serveur', () => {
    expect(diffSettings(current, inputs({ default_multiplier: '51' })).invalid).toContain(
      'default_multiplier',
    );
    expect(diffSettings(current, inputs({ referral_pct: '101' })).invalid).toContain(
      'referral_pct',
    );
    expect(diffSettings(current, inputs({ min_recharge_xaf: '12.5' })).invalid).toContain(
      'min_recharge_xaf',
    );
    expect(diffSettings(current, inputs({ auto_discount_pct: '101' })).invalid).toContain(
      'auto_discount_pct',
    );
  });
  it('refuse un champ vide ou non numérique', () => {
    expect(diffSettings(current, inputs({ price_alert_pct: '' })).invalid).toContain(
      'price_alert_pct',
    );
    expect(diffSettings(current, inputs({ price_alert_pct: 'abc' })).invalid).toContain(
      'price_alert_pct',
    );
  });
  it('refuse un minimum de recharge au-dessus du maximum', () => {
    const d = diffSettings(current, inputs({ min_recharge_xaf: '600000' }));
    expect(d.invalid).toEqual(expect.arrayContaining(['min_recharge_xaf', 'max_recharge_xaf']));
  });
});
