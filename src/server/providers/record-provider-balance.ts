import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import { getProvider } from '@/server/providers';
import { notifyOwner } from '@/server/providers/telegram';

/**
 * Relève le solde du fournisseur, le garde pour le tableau de bord admin, et prévient le
 * propriétaire sous le seuil (réglage provider_low_balance_usd, 5 $ par défaut).
 * Aucune écriture de solde client : seulement un relevé en lecture seule pour l'admin.
 */
export async function recordProviderBalance(): Promise<{ balanceUsd: number; alerted: boolean }> {
  const { balance } = await getProvider().balance();
  const db = createAdminClient();
  const { error } = await db.from('provider_balance_snapshots').insert({ balance_usd: balance });
  if (error) throw new Error(`relevé du solde: ${error.message}`);
  const { data } = await db
    .from('settings')
    .select('value')
    .eq('key', 'provider_low_balance_usd')
    .maybeSingle();
  const threshold = Number(data?.value ?? 5);
  const alerted = Number.isFinite(threshold) && balance < threshold;
  if (alerted) {
    await notifyOwner('low_provider_balance', { balance_usd: balance, threshold_usd: threshold });
  }
  return { balanceUsd: balance, alerted };
}
