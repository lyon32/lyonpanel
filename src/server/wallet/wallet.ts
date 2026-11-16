import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/server/db/supabase-admin';
import {
  nextDiscountThresholdXaf,
  resolveDiscountPct,
  type AutoDiscount,
} from '@/server/pricing/resolve-discount-pct';

export interface Wallet {
  balance_xaf: number;
  /** Dette = solde négatif (bonus de parrainage annulé après dépense) ; 0 sinon. */
  debt_xaf: number;
  total_recharged_xaf: number;
  discount_pct: number;
  next_discount_threshold_xaf: number | null;
}

const autoDiscountSchema = z.object({
  threshold_xaf: z.coerce.number().int().nonnegative(),
  pct: z.coerce.number().min(0).max(100),
});

/**
 * Solde, total rechargé et remise du client. Même règle que place_order et le devis :
 * remise = la plus grande de l'automatique et de la personnalisée, jamais cumulées.
 * Lecture avec le client service : custom_discount_pct est caché au navigateur (DATA_MODEL §7).
 */
export async function getWallet(userId: string): Promise<Wallet> {
  const db = createAdminClient();
  const [wallet, profile, setting] = await Promise.all([
    db.from('wallets').select('balance_xaf, total_recharged_xaf').eq('user_id', userId).single(),
    db.from('profiles').select('custom_discount_pct').eq('id', userId).single(),
    db.from('settings').select('value').eq('key', 'auto_discount').maybeSingle(),
  ]);
  if (wallet.error) throw new Error(`wallets: ${wallet.error.message}`);
  if (profile.error) throw new Error(`profiles: ${profile.error.message}`);
  if (setting.error) throw new Error(`settings: ${setting.error.message}`);

  const parsed = autoDiscountSchema.safeParse(setting.data?.value);
  const total = wallet.data.total_recharged_xaf;
  const custom = profile.data.custom_discount_pct ?? null;
  // Réglage absent ou invalide : aucune remise automatique (seuil infini).
  const auto: AutoDiscount = parsed.success
    ? { thresholdXaf: parsed.data.threshold_xaf, pct: parsed.data.pct }
    : { thresholdXaf: Number.POSITIVE_INFINITY, pct: 0 };
  return {
    balance_xaf: wallet.data.balance_xaf,
    debt_xaf: Math.max(0, -wallet.data.balance_xaf),
    total_recharged_xaf: total,
    discount_pct: resolveDiscountPct(total, auto, custom),
    next_discount_threshold_xaf: parsed.success
      ? nextDiscountThresholdXaf(total, auto, custom)
      : null,
  };
}
