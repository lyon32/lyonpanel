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

/** Rembourse (une seule fois) une commande annulée : seule écriture de solde de ce module. */
export async function refundCanceled(orderId: string): Promise<boolean> {
  const { error } = await createAdminClient().rpc('refund_canceled_order', { p_order: orderId });
  if (!error) return true;
  // Déjà remboursée (rejeu, double clic) : le résultat voulu est atteint.
  return error.message.includes('ALREADY_REFUNDED');
}

/**
 * Annulation par le client. Possible seulement tant que le fournisseur n'a rien livré.
 * Ordre voulu : le fournisseur accepte l'annulation d'abord, le remboursement vient ensuite.
 * Si le remboursement échoue après l'accord du fournisseur, le propriétaire est alerté et le
 * prochain passage du suivi des commandes rejoue le remboursement (la fonction SQL est unique par commande).
 */
export async function cancelOrder(userId: string, orderId: string): Promise<{ refunded: boolean }> {
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
  // Demande déjà faite : on retente seulement le remboursement.
  if (order.cancel_requested_at === null && !cancellable) return apiError('ORDER_NOT_CANCELLABLE');

  if (order.cancel_requested_at === null) {
    // Règle lue chez le fournisseur au moment du clic : la synchro peut avoir du retard.
    // Panne du fournisseur : l'erreur remonte, refus prudent (ni annulation ni remboursement).
    const live = (await getProvider().status([order.provider_order_id as number]))[
      order.provider_order_id as number
    ];
    if (live?.status !== 'Pending') return apiError('ORDER_NOT_CANCELLABLE');
    const accepted = await getProvider().cancel(order.provider_order_id as number);
    if (!accepted) return apiError('ORDER_NOT_CANCELLABLE');
    // Garde sur le statut : une seule demande retenue même en cas de double clic.
    await db
      .from('orders')
      .update({ cancel_requested_at: new Date().toISOString() })
      .eq('id', order.id)
      .is('cancel_requested_at', null);
  }

  const refunded = await refundCanceled(order.id);
  // Le fournisseur a annulé mais le solde n'a pas été rendu : le propriétaire est prévenu.
  if (!refunded) await notifyOwner('internal_error', { where: 'cancelOrder', order_id: order.id });
  return { refunded };
}
