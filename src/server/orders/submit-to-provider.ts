import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import type { Database } from '@/server/db/types';
import { getProvider } from '@/server/providers';
import { notifyOwner } from '@/server/providers/telegram';

export type OrderRow = Database['public']['Tables']['orders']['Row'];

const PROVIDER_TIMEOUT_MS = 10_000;

// Rejette après le délai ; le minuteur est toujours nettoyé par l'appelant.
function timeoutAfter(ms: number): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('PROVIDER_TIMEOUT')), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

/**
 * Envoie la commande au fournisseur : UNE seule tentative, jamais de reprise.
 * Pourquoi : un 2e `add` après un délai pourrait créer une double commande chez le fournisseur.
 * Échec ou délai -> `to_review` + alerte propriétaire ; le client n'est PAS remboursé
 * automatiquement (le propriétaire examine). Ne lève jamais d'erreur.
 */
export async function submitToProvider(order: OrderRow): Promise<'in_progress' | 'to_review'> {
  const db = createAdminClient();
  const timeout = timeoutAfter(PROVIDER_TIMEOUT_MS);
  try {
    const result = await Promise.race([
      getProvider().add({
        service: order.service_id,
        link: order.link,
        quantity: order.quantity,
        ...(order.comments && order.comments.length > 0 ? { comments: order.comments } : {}),
      }),
      timeout.promise,
    ]);
    const { error } = await db
      .from('orders')
      .update({ status: 'in_progress', provider_order_id: result.order, error: null })
      .eq('id', order.id);
    if (error) {
      // La commande existe chez le fournisseur : on garde son numéro dans l'alerte pour ne rien perdre.
      await notifyOwner('internal_error', {
        where: 'submitToProvider',
        order_id: order.id,
        provider_order_id: result.order,
      });
    }
    return 'in_progress';
  } catch (cause) {
    // Raison technique : stockée en interne (orders.error), jamais renvoyée au client.
    const reason = (cause instanceof Error ? cause.message : 'unknown error').slice(0, 300);
    await db.from('orders').update({ status: 'to_review', error: reason }).eq('id', order.id);
    await notifyOwner('order_failed', {
      order_id: order.id,
      short_id: order.short_id,
      service_id: order.service_id,
      charged_xaf: order.charged_xaf,
      reason,
    });
    return 'to_review';
  } finally {
    timeout.cancel();
  }
}
