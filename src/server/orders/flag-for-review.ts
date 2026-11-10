import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import { notifyOwner } from '@/server/providers/telegram';

type Fields = { order_id: string; short_id: string; service_id: number; charged_xaf: number };

/**
 * Passe une commande en `to_review` et alerte le propriétaire UNE seule fois.
 * Pourquoi : `alerted_at is null` dans l'update rend l'alerte atomique, donc pas de doublon
 * même si le cron repasse ou tourne en double. Aucune écriture de solde, aucun remboursement.
 */
export async function flagForReview(
  order: { id: string; short_id: string; service_id: number; charged_xaf: number },
  from: { status: 'in_progress' | 'pending'; error?: string },
  reason: string,
  extra: Record<string, number | null> = {},
): Promise<boolean> {
  let q = createAdminClient()
    .from('orders')
    .update({ status: 'to_review', error: reason, alerted_at: new Date().toISOString(), ...extra })
    .eq('id', order.id)
    .eq('status', from.status)
    .is('alerted_at', null);
  if (from.error) q = q.eq('error', from.error);
  const { data, error } = await q.select('id');
  if (error || !data || data.length === 0) return false;
  const fields: Fields = {
    order_id: order.id,
    short_id: order.short_id,
    service_id: order.service_id,
    charged_xaf: order.charged_xaf,
  };
  await notifyOwner('order_failed', { ...fields, reason });
  return true;
}
