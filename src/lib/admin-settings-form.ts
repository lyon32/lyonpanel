import { patchSettingsSchema, type SettingsPatch } from '@/server/schemas/admin-settings';

// Champs de l'écran Réglages (la remise automatique est éclatée en deux champs).
export const SETTING_FIELDS = [
  { key: 'usd_xaf_rate', unit: 'XAF' },
  { key: 'default_multiplier', unit: '×' },
  { key: 'min_recharge_xaf', unit: 'XAF' },
  { key: 'max_recharge_xaf', unit: 'XAF' },
  { key: 'daily_order_cap_xaf', unit: 'XAF' },
  { key: 'provider_low_balance_usd', unit: 'USD' },
  { key: 'price_alert_pct', unit: '%' },
  { key: 'auto_discount_threshold_xaf', unit: 'XAF' },
  { key: 'auto_discount_pct', unit: '%' },
  { key: 'referral_pct', unit: '%' },
] as const;

export type SettingFieldKey = (typeof SETTING_FIELDS)[number]['key'];
export type SettingValues = Record<SettingFieldKey, number>;
export type SettingInputs = Record<SettingFieldKey, string>;

/** Valeurs lues dans la réponse de l'API ; null si une valeur manque ou n'est pas un nombre. */
export function readSettingValues(settings: Record<string, unknown>): SettingValues | null {
  const auto = settings.auto_discount;
  const autoObj =
    typeof auto === 'object' && auto !== null ? (auto as Record<string, unknown>) : {};
  const flat: Record<string, unknown> = {
    ...settings,
    auto_discount_threshold_xaf: autoObj.threshold_xaf,
    auto_discount_pct: autoObj.pct,
  };
  const out: Partial<SettingValues> = {};
  for (const f of SETTING_FIELDS) {
    const v = flat[f.key];
    if (typeof v !== 'number') return null;
    out[f.key] = v;
  }
  return out as SettingValues;
}

export type SettingChange = { key: SettingFieldKey; oldValue: number; newValue: number };

export type SettingsDiff = {
  patch: SettingsPatch;
  changes: SettingChange[];
  invalid: SettingFieldKey[];
};

/**
 * Compare la saisie aux valeurs actuelles et valide avec les bornes du serveur (même schéma Zod).
 * La règle minimum ≤ maximum de recharge est aussi contrôlée ici : la base la refuserait de toute façon.
 */
export function diffSettings(current: SettingValues, inputs: SettingInputs): SettingsDiff {
  const invalid = new Set<SettingFieldKey>();
  const changes: SettingChange[] = [];
  const next = { ...current };
  for (const f of SETTING_FIELDS) {
    const raw = inputs[f.key].trim().replace(',', '.');
    const n = raw === '' ? Number.NaN : Number(raw);
    if (!Number.isFinite(n)) {
      invalid.add(f.key);
      continue;
    }
    next[f.key] = n;
    if (n !== current[f.key]) changes.push({ key: f.key, oldValue: current[f.key], newValue: n });
  }
  const patch: Record<string, unknown> = {};
  for (const c of changes) {
    if (c.key === 'auto_discount_threshold_xaf' || c.key === 'auto_discount_pct') continue;
    patch[c.key] = c.newValue;
  }
  if (changes.some((c) => c.key.startsWith('auto_discount'))) {
    patch.auto_discount = {
      threshold_xaf: next.auto_discount_threshold_xaf,
      pct: next.auto_discount_pct,
    };
  }
  const parsed = patchSettingsSchema.safeParse(patch);
  if (!parsed.success && changes.length > 0) {
    for (const issue of parsed.error.issues) {
      const [head, sub] = issue.path;
      if (head === 'auto_discount') invalid.add(`auto_discount_${String(sub)}` as SettingFieldKey);
      else if (typeof head === 'string') invalid.add(head as SettingFieldKey);
    }
  }
  if (next.min_recharge_xaf > next.max_recharge_xaf) {
    invalid.add('min_recharge_xaf');
    invalid.add('max_recharge_xaf');
  }
  return {
    patch: parsed.success ? parsed.data : {},
    changes,
    invalid: [...invalid],
  };
}
