import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/server/db/supabase-admin';

export interface Wallet {
  balance_xaf: number;
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

  const auto = autoDiscountSchema.safeParse(setting.data?.value);
  const total = wallet.data.total_recharged_xaf;
  const autoPct = auto.success && total >= auto.data.threshold_xaf ? auto.data.pct : 0;
  return {
    balance_xaf: wallet.data.balance_xaf,
    total_recharged_xaf: total,
    discount_pct: Math.max(autoPct, profile.data.custom_discount_pct ?? 0),
    // Seuil de la remise automatique, ou null s'il est déjà atteint (ou réglage absent).
    next_discount_threshold_xaf:
      auto.success && total < auto.data.threshold_xaf ? auto.data.threshold_xaf : null,
  };
}
