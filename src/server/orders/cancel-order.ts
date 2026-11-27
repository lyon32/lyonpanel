import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { getProvider } from '@/server/providers';
import { notifyOwner } from '@/server/providers/telegram';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  short_id: string;
  user_id: string;
  service_id: number;
  quantity: number;
  charged_xaf: number;
  status: string;
  start_count: number | null;
  remains: number | null;
  provider_order_id: number | null;
  cancel_requested_at: string | null;
};

/**
 * Annulation par le client. Possible seulement tant que le fournisseur n'a rien livré.
 * Décision du 2026-11-27 : aucun remboursement automatique. Une fois l'annulation acceptée par le
 * fournisseur, la commande passe en `to_review` et le propriétaire décide (remboursement manuel).
 */
export async function cancelOrder(
  userId: string,
  orderId: string,
): Promise<{ refunded: false; status: 'to_review' }> {
  const result = { refunded: false, status: 'to_review' } as const;
  if (!UUID.test(orderId)) return apiError('ORDER_NOT_FOUND');
  const db = createAdminClient();
  const { data, error } = await db
    .from('orders')
    .select(
      'id, short_id, user_id, service_id, quantity, charged_xaf, status, start_count, remains, provider_order_id, cancel_requested_at',
    )
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`commande: ${error.message}`);
  if (!data) return apiError('ORDER_NOT_FOUND');
  const order = data as Row;
  if (order.status === 'refunded') return apiError('ALREADY_REFUNDED');

  // Demande déjà posée : jamais de 2e appel fournisseur ni de 2e alerte.
  if (order.cancel_requested_at !== null) {
    if (order.status !== 'to_review') {
      // Reprise après une coupure entre la demande et la mise en examen.
      await db
        .from('orders')
        .update({ status: 'to_review' })
        .eq('id', order.id)
        .eq('status', order.status);
    }
    return result;
  }

  const { data: service } = await db
    .from('services')
    .select('cancel')
    .eq('id', order.service_id)
    .maybeSingle();
  const started =
    (order.start_count ?? 0) > 0 || (order.remains !== null && order.remains < order.quantity);
  const cancellable =
    (order.status === 'in_progress' || order.status === 'pending') &&
    order.provider_order_id !== null &&
    service?.cancel === true &&
    !started;
  if (!cancellable) return apiError('ORDER_NOT_CANCELLABLE');

  // Règle lue chez le fournisseur au moment du clic : la synchro peut avoir du retard.
  // Panne du fournisseur : l'erreur remonte, refus prudent.
  const live = (
    await getProvider().status([order.provider_order_id as number], { readOnly: true })
  )[order.provider_order_id as number];
  if (live?.status !== 'Pending') return apiError('ORDER_NOT_CANCELLABLE');
  const accepted = await getProvider().cancel(order.provider_order_id as number);
  if (!accepted) return apiError('ORDER_NOT_CANCELLABLE');
  // Garde sur cancel_requested_at : une seule demande retenue (et une seule alerte) même en double clic.
  const { data: updated } = await db
    .from('orders')
    .update({ cancel_requested_at: new Date().toISOString(), status: 'to_review' })
    .eq('id', order.id)
    .is('cancel_requested_at', null)
    .select('id');
  if (!updated || updated.length > 0) {
    await notifyOwner('order_cancel_requested', {
      order_id: order.id,
      short_id: order.short_id,
      service_id: order.service_id,
      charged_xaf: order.charged_xaf,
    });
  }
  return result;
}
