import 'server-only';
import { submitToProvider, type OrderRow } from './submit-to-provider';
import { validateLink } from './validate-link';
import { createAdminClient } from '@/server/db/supabase-admin';
import type { Database } from '@/server/db/types';
import { apiError } from '@/server/http/api-error';
import { computeDiscountedTotalXaf } from '@/server/pricing/compute-discounted-total';
import { getProvider } from '@/server/providers';
import { notifyOwner } from '@/server/providers/telegram';
import type { CreateOrderInput } from '@/server/schemas/order';
import type { Network } from '@/server/catalog/labels';

type ServiceRow = Database['public']['Tables']['services']['Row'];
type OrderStatus = Database['public']['Enums']['order_status'];

/** Forme publique (API_SPEC §6.5) : liste blanche, jamais de coût, d'erreur brute ni d'identifiant fournisseur. */
export type Order = {
  id: string;
  short_id: number;
  service: { id: number; name: string; platform: string };
  link: string;
  quantity: number;
  charged_xaf: number;
  status: OrderStatus;
  start_count: number | null;
  remains: number | null;
  created_at: string;
  updated_at: string;
};

export function toPublicOrder(
  row: OrderRow,
  service: Pick<ServiceRow, 'id' | 'name_fr' | 'platform'>,
): Order {
  return {
    id: row.id,
    short_id: row.short_id,
    service: {
      id: service.id,
      name: service.name_fr ?? `#${service.id}`,
      platform: service.platform,
    },
    link: row.link,
    quantity: row.quantity,
    charged_xaf: row.charged_xaf,
    status: row.status,
    start_count: row.start_count,
    remains: row.remains,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const sameComments = (a: string[] | null, b: string[] | undefined) =>
  JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

// Même clé d'idempotence mais contenu différent : on refuse plutôt que renvoyer une autre commande.
function assertSameContent(row: OrderRow, input: CreateOrderInput): void {
  if (
    row.service_id !== input.service_id ||
    row.link !== input.link ||
    row.quantity !== input.quantity ||
    !sameComments(row.comments, input.comments)
  ) {
    apiError('IDEMPOTENCY_CONFLICT');
  }
}

async function loadService(id: number): Promise<ServiceRow> {
  const { data } = await createAdminClient()
    .from('services')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!data || !data.active || !data.available || (data.price_xaf_1000 ?? 0) <= 0) {
    apiError('SERVICE_UNAVAILABLE');
  }
  return data;
}

async function readSetting(key: string): Promise<unknown> {
  const { data } = await createAdminClient()
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

// Commentaires : un par ligne, non vides, pour « commentaires personnalisés » ; interdits sinon.
function assertComments(service: ServiceRow, input: CreateOrderInput): void {
  const comments = input.comments ?? [];
  const needed = service.provider_type === 'Custom Comments';
  const valid = needed
    ? comments.length === input.quantity && comments.every((c) => c.trim() !== '')
    : comments.length === 0;
  if (!valid) apiError('VALIDATION_ERROR', { fields: { comments: 'COMMENTS_INVALID' } });
}

// Remise appliquée : la plus grande de la remise automatique et de la remise du client (jamais cumulées).
async function discountPctOf(userId: string): Promise<number> {
  const db = createAdminClient();
  const [{ data: wallet }, { data: profile }, auto] = await Promise.all([
    db.from('wallets').select('total_recharged_xaf').eq('user_id', userId).maybeSingle(),
    db.from('profiles').select('status, custom_discount_pct').eq('id', userId).maybeSingle(),
    readSetting('auto_discount'),
  ]);
  if (!profile || profile.status !== 'active') apiError('ACCOUNT_BLOCKED');
  const rule = auto as { threshold_xaf?: number; pct?: number } | null;
  const autoPct =
    rule && Number(wallet?.total_recharged_xaf ?? 0) >= Number(rule.threshold_xaf)
      ? Number(rule.pct)
      : 0;
  return Math.max(autoPct, Number(profile.custom_discount_pct ?? 0));
}

// Solde du fournisseur : insuffisant -> service indisponible (aucun débit client).
// Retourne le solde restant après cette commande, pour l'alerte de seuil bas.
async function checkProviderBalance(service: ServiceRow, quantity: number): Promise<number> {
  const costUsd = (Number(service.cost_usd_1000 ?? 0) * quantity) / 1000;
  let balanceUsd: number;
  try {
    balanceUsd = (await getProvider().balance()).balance;
  } catch {
    return apiError('SERVICE_UNAVAILABLE');
  }
  if (balanceUsd < costUsd) apiError('SERVICE_UNAVAILABLE');
  return balanceUsd - costUsd;
}

// Traduit l'erreur SQL (message = code) en erreur d'API, avec les détails exacts attendus.
async function translateRpcError(
  message: string,
  userId: string,
  input: CreateOrderInput,
): Promise<never> {
  const db = createAdminClient();
  switch (message) {
    case 'INSUFFICIENT_BALANCE': {
      // Cas d'une course entre deux commandes : on relit le solde réel et le prix du moment.
      const service = await loadService(input.service_id);
      const discount = await discountPctOf(userId);
      const total = computeDiscountedTotalXaf(
        service.price_xaf_1000 ?? 0,
        input.quantity,
        discount,
      );
      const { data } = await db
        .from('wallets')
        .select('balance_xaf')
        .eq('user_id', userId)
        .maybeSingle();
      return apiError('INSUFFICIENT_BALANCE', {
        missing_xaf: Math.max(0, total - Number(data?.balance_xaf ?? 0)),
      });
    }
    case 'DAILY_LIMIT_REACHED': {
      const [setting, { data: profile }] = await Promise.all([
        readSetting('daily_order_cap_xaf'),
        db.from('profiles').select('daily_spend_limit_xaf').eq('id', userId).maybeSingle(),
      ]);
      const global = typeof setting === 'number' ? Math.floor(setting) : 100_000;
      const own = profile?.daily_spend_limit_xaf;
      return apiError('DAILY_LIMIT_REACHED', {
        limit_xaf: own == null ? global : Math.min(global, own),
      });
    }
    case 'QUANTITY_OUT_OF_RANGE': {
      const { data } = await db
        .from('services')
        .select('min_qty, max_qty')
        .eq('id', input.service_id)
        .maybeSingle();
      return apiError('QUANTITY_OUT_OF_RANGE', { min: data?.min_qty, max: data?.max_qty });
    }
    case 'PRICE_CHANGED': {
      const service = await loadService(input.service_id);
      const discount = await discountPctOf(userId);
      return apiError('PRICE_CHANGED', {
        new_total_xaf: computeDiscountedTotalXaf(
          service.price_xaf_1000 ?? 0,
          input.quantity,
          discount,
        ),
      });
    }
    case 'COMMENTS_INVALID':
      return apiError('VALIDATION_ERROR', { fields: { comments: 'COMMENTS_INVALID' } });
    case 'ACCOUNT_BLOCKED':
      return apiError('ACCOUNT_BLOCKED');
    case 'SERVICE_UNAVAILABLE':
      return apiError('SERVICE_UNAVAILABLE');
    default:
      return apiError('INTERNAL_ERROR');
  }
}

/**
 * Passe une commande : tous les contrôles côté serveur (le total du navigateur n'est qu'une
 * vérification), débit atomique par `place_order`, puis envoi unique au fournisseur.
 */
export async function placeOrder(
  userId: string,
  input: CreateOrderInput,
  idempotencyKey: string,
): Promise<Order> {
  const db = createAdminClient();

  // Rejeu (double clic, réseau) : on renvoie la commande existante sans rien refaire.
  const { data: existing } = await db
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('idem_key', idempotencyKey)
    .maybeSingle();
  if (existing) {
    assertSameContent(existing, input);
    return toPublicOrder(existing, await serviceOf(existing.service_id));
  }

  const service = await loadService(input.service_id);
  if (!validateLink(service.platform as Network, input.link).ok) apiError('INVALID_LINK');
  assertComments(service, input);
  if (input.quantity < service.min_qty || input.quantity > service.max_qty) {
    apiError('QUANTITY_OUT_OF_RANGE', { min: service.min_qty, max: service.max_qty });
  }

  const discount = await discountPctOf(userId);
  const totalXaf = computeDiscountedTotalXaf(service.price_xaf_1000 ?? 0, input.quantity, discount);
  if (totalXaf !== input.expected_total_xaf) apiError('PRICE_CHANGED', { new_total_xaf: totalXaf });

  const remainingUsd = await checkProviderBalance(service, input.quantity);

  const { data: row, error } = await db.rpc('place_order', {
    p_user: userId,
    p_service: service.id,
    p_link: input.link,
    p_qty: input.quantity,
    p_comments: input.comments ?? [],
    p_idem_key: idempotencyKey,
    p_expected_price_xaf_1000: service.price_xaf_1000 ?? undefined,
  });
  if (error || !row) return translateRpcError(error?.message ?? '', userId, input);
  assertSameContent(row, input);

  // « Réservation » atomique de l'envoi : si deux appels de même clé arrivent ensemble, un seul
  // contacte le fournisseur (jamais deux `add`). Les autres renvoient l'état courant.
  let current: OrderRow = row;
  if (row.status === 'pending') {
    const { data: claimed } = await db
      .from('orders')
      .update({ error: 'submitting' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .is('error', null)
      .select('id');
    if (claimed && claimed.length > 0) {
      await notifyLowProviderBalance(remainingUsd);
      await submitToProvider(row);
    }
    const { data: fresh } = await db.from('orders').select('*').eq('id', row.id).single();
    current = fresh ?? row;
  }
  return toPublicOrder(current, service);
}

async function serviceOf(id: number): Promise<Pick<ServiceRow, 'id' | 'name_fr' | 'platform'>> {
  const { data } = await createAdminClient()
    .from('services')
    .select('id, name_fr, platform')
    .eq('id', id)
    .single();
  if (!data) return apiError('INTERNAL_ERROR');
  return data;
}

async function notifyLowProviderBalance(remainingUsd: number): Promise<void> {
  const threshold = Number(await readSetting('provider_low_balance_usd'));
  if (Number.isFinite(threshold) && remainingUsd < threshold) {
    await notifyOwner('low_provider_balance', {
      balance_usd: Number(remainingUsd.toFixed(4)),
      threshold_usd: threshold,
    });
  }
}
