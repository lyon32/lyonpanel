import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError, type ErrorCode } from '@/server/http/api-error';
import { getProvider } from '@/server/providers';
import { notifyOwner } from '@/server/providers/telegram';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_TIMEOUT_MS = 10_000;

const KNOWN: ErrorCode[] = [
  'ORDER_NOT_FOUND',
  'ORDER_NOT_CANCELLABLE',
  'ORDER_NOT_CLOSABLE',
  'ORDER_NOT_RESENDABLE',
  'ALREADY_RESENT',
  'ACTION_IN_PROGRESS',
  'REASON_REQUIRED',
  'NOT_ADMIN',
];

/** Traduit l'erreur d'une fonction SQL en erreur API ; toute autre erreur reste une panne (500). */
function fail(message: string, where: string): never {
  const code = KNOWN.find((c) => message.includes(c));
  if (code) return apiError(code);
  throw new Error(`${where}_failed`);
}

/** Lève l'erreur API correspondant à une erreur de fonction SQL, s'il y en a une. */
function check(error: { message: string } | null, where: string): void {
  if (error) fail(error.message, where);
}

const db = () => createAdminClient();

// Le fournisseur ne répond pas dans le délai : on rejette, jamais d'attente infinie.
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('PROVIDER_TIMEOUT')), PROVIDER_TIMEOUT_MS);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

function providerFailure(cause: unknown): never {
  const timeout = cause instanceof Error && cause.message === 'PROVIDER_TIMEOUT';
  return apiError(timeout ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR');
}

function checkId(id: string): void {
  if (!UUID.test(id)) apiError('ORDER_NOT_FOUND');
}

async function loadProviderOrderId(id: string): Promise<number> {
  const { data, error } = await db()
    .from('orders')
    .select('provider_order_id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('order_load_failed');
  if (!data) return apiError('ORDER_NOT_FOUND');
  if (data.provider_order_id === null) return apiError('ORDER_NOT_CANCELLABLE');
  return data.provider_order_id;
}

/**
 * Annulation admin en 3 temps : 1) réservation (un double clic ne passe pas), 2) demande au fournisseur,
 * 3) passage en `to_review` (aucun remboursement : l'admin rembourse ensuite la part non livrée).
 */
export async function cancelByAdmin(adminId: string, id: string, reason: string) {
  checkId(id);
  check(
    (await db().rpc('claim_order_cancel', { p_order: id, p_admin: adminId })).error,
    'claim_cancel',
  );
  const release = async () =>
    check(
      (await db().rpc('release_order_cancel', { p_order: id, p_admin: adminId })).error,
      'release_cancel',
    );
  let accepted: boolean;
  try {
    accepted = await withTimeout(getProvider().cancel(await loadProviderOrderId(id)));
  } catch (cause) {
    await release().catch(() => undefined);
    if (cause instanceof Error && cause.name === 'ApiError') throw cause;
    return providerFailure(cause);
  }
  if (!accepted) {
    await release();
    return apiError('ORDER_NOT_CANCELLABLE');
  }
  try {
    check(
      (await db().rpc('cancel_order', { p_order: id, p_admin: adminId, p_reason: reason })).error,
      'cancel_order',
    );
  } catch (e) {
    // Le fournisseur a annulé mais la base n'a pas suivi : réservation levée, propriétaire prévenu.
    await release().catch(() => undefined);
    await notifyOwner('internal_error', { where: 'cancelByAdmin', order_id: id });
    throw e;
  }
  return { order_status: 'to_review' as const };
}

/**
 * Renvoi manuel : la réservation (`resent_at`) précède `provider.add`, qui n'est donc appelé qu'UNE fois.
 * Si `add` échoue, aucun nouvel essai : l'admin examine (jamais de reprise automatique).
 */
export async function resendByAdmin(adminId: string, id: string, reason: string) {
  checkId(id);
  check(
    (await db().rpc('claim_order_resend', { p_order: id, p_admin: adminId, p_reason: reason }))
      .error,
    'claim_resend',
  );
  const { data, error } = await db()
    .from('orders')
    .select('service_id, link, quantity, comments')
    .eq('id', id)
    .single();
  if (error) throw new Error('order_load_failed');
  let providerOrderId: number;
  try {
    const added = await withTimeout(
      getProvider().add({
        service: data.service_id,
        link: data.link,
        quantity: data.quantity,
        ...(data.comments && data.comments.length > 0 ? { comments: data.comments } : {}),
      }),
    );
    providerOrderId = added.order;
  } catch (cause) {
    await notifyOwner('order_failed', { order_id: id, reason: 'resend failed' });
    return providerFailure(cause);
  }
  try {
    check(
      (
        await db().rpc('resend_order', {
          p_order: id,
          p_admin: adminId,
          p_reason: reason,
          p_provider_order_id: providerOrderId,
        })
      ).error,
      'resend_order',
    );
  } catch (e) {
    // La commande existe chez le fournisseur : son numéro est gardé dans l'alerte pour ne rien perdre.
    await notifyOwner('internal_error', {
      where: 'resendByAdmin',
      order_id: id,
      provider_order_id: providerOrderId,
    });
    throw e;
  }
  return { order_status: 'in_progress' as const };
}

export async function closeByAdmin(adminId: string, id: string, reason: string) {
  checkId(id);
  check(
    (await db().rpc('close_order', { p_order: id, p_admin: adminId, p_reason: reason })).error,
    'close_order',
  );
  return { order_status: 'completed' as const };
}
