import 'server-only';
import type { Json } from '@/server/db/types';
import type { SettingsPatch } from '@/server/schemas/admin-settings';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';

// Liste blanche : toute autre clé de la table (secrets éventuels) est retirée avant de répondre.
const EDITABLE_SETTINGS = [
  'usd_xaf_rate',
  'default_multiplier',
  'min_recharge_xaf',
  'max_recharge_xaf',
  'daily_order_cap_xaf',
  'provider_low_balance_usd',
  'price_alert_pct',
  'auto_discount',
  'referral_pct',
] as const;

function filterSettings(source: Record<string, Json>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const key of EDITABLE_SETTINGS) if (key in source) out[key] = source[key] as Json;
  return out;
}

export async function getAdminSettings() {
  const { data, error } = await createAdminClient()
    .from('settings')
    .select('key, value')
    .in('key', [...EDITABLE_SETTINGS]);
  if (error) throw new Error('admin_settings_read_failed');
  return { settings: filterSettings(Object.fromEntries(data.map((r) => [r.key, r.value]))) };
}

export async function updateAdminSettings(adminId: string, patch: SettingsPatch) {
  const { data, error } = await createAdminClient().rpc('update_setting', {
    p_changes: patch as Json,
    p_admin: adminId,
  });
  if (error) {
    if (/INVALID_SETTING|UNKNOWN_SETTING|EMPTY_CHANGES/.test(error.message)) {
      return apiError('VALIDATION_ERROR');
    }
    throw new Error('admin_settings_update_failed');
  }
  const all = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return { settings: filterSettings(all as Record<string, Json>) };
}
