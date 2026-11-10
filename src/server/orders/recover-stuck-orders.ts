import 'server-only';
import { flagForReview } from './flag-for-review';
import { createAdminClient } from '@/server/db/supabase-admin';

const STUCK_AFTER_MINUTES = 5;

/**
 * Commandes restées « en envoi » (pending + error='submitting') : le serveur a coupé en plein appel.
 * On ne sait pas si le fournisseur a reçu la commande -> to_review + alerte.
 * Jamais de provider.add ici : un 2e envoi pourrait créer une double commande.
 */
export async function recoverStuckOrders(): Promise<{ recovered: number }> {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60_000).toISOString();
  const { data, error } = await createAdminClient()
    .from('orders')
    .select('id, short_id, service_id, charged_xaf')
    .eq('status', 'pending')
    .eq('error', 'submitting')
    .is('alerted_at', null)
    .lt('created_at', cutoff)
    .limit(100);
  if (error || !data) return { recovered: 0 };
  let recovered = 0;
  for (const order of data) {
    try {
      const done = await flagForReview(
        order,
        { status: 'pending', error: 'submitting' },
        'stuck while submitting',
      );
      if (done) recovered += 1;
    } catch {
      // Une commande isolée ne bloque pas les autres ; le prochain passage la reverra.
    }
  }
  return { recovered };
}
