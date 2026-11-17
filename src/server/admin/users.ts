import 'server-only';
import type { z } from 'zod';
import type { listUsersQuerySchema, patchUserSchema } from '@/server/schemas/admin-users';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { decodeCursor, encodeCursor, keysetFilter } from '@/server/orders/list-orders';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Seuls ces caractères entrent dans le filtre de recherche ; tout autre signe ne correspond à aucun client.
const SEARCH_SAFE = /^[\p{L}\p{N}@.+_ -]+$/u;

const LIST_COLUMNS = 'id, email, phone, country, status, created_at, wallets(balance_xaf)';
// Liste blanche : jamais is_admin, signup_ip_hash ni identifiants d'authentification.
const PROFILE_COLUMNS =
  'id, email, phone, country, display_currency, language, status, referral_code, referred_by, custom_discount_pct, daily_spend_limit_xaf, blocked_reason, created_at, deleted_at';

type ListQuery = z.infer<typeof listUsersQuerySchema>;
type Patch = z.infer<typeof patchUserSchema>;

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
/** Identité lisible mais pas complète : « j***@gmail.com » ou « ***1234 ». */
export function maskIdentity(email: string | null, phone: string | null): string | null {
  if (email) {
    const [name = '', domain = ''] = email.split('@');
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return phone ? `***${phone.slice(-4)}` : null;
}

const userNotFound = (): never => apiError('USER_NOT_FOUND');

/** Recherche : morceau d'email, de téléphone ou code de parrainage. `_` est échappé (joker SQL). */
function searchFilter(q: string): string {
  const pattern = `*${q.replace(/_/g, '\\_')}*`;
  return ['email', 'phone', 'referral_code'].map((c) => `${c}.ilike.${pattern}`).join(',');
}

export async function listUsers(query: ListQuery) {
  const db = createAdminClient();
  if (query.q && !SEARCH_SAFE.test(query.q)) return { items: [], next_cursor: null };
  let req = db
    .from('profiles')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(query.limit + 1);
  if (query.country) req = req.eq('country', query.country);
  if (query.status) req = req.eq('status', query.status);
  if (query.q) req = req.or(searchFilter(query.q));
  if (query.cursor) req = req.or(keysetFilter(decodeCursor(query.cursor)));
  const { data, error } = await req;
  if (error) throw new Error('admin_users_list_failed');
  const rows = data ?? [];
  const page = rows.slice(0, query.limit);
  const last = page[page.length - 1];
  return {
    items: page.map((r) => ({
      id: r.id,
      email: r.email,
      phone: r.phone,
      country: r.country,
      status: r.status,
      balance_xaf: Number(one(r.wallets)?.balance_xaf ?? 0),
      created_at: r.created_at,
    })),
    next_cursor: rows.length > query.limit && last ? encodeCursor(last) : null,
  };
}

export async function getUserDetail(id: string) {
  if (!UUID.test(id)) return userNotFound();
  const db = createAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select(`${PROFILE_COLUMNS}, signup_ip_hash`)
    .eq('id', id)
    .maybeSingle();
  if (!profile) return userNotFound();
  const { signup_ip_hash: referrerHash, ...publicProfile } = profile;

  const [wallet, orders, notes, rewards, rate] = await Promise.all([
    db.from('wallets').select('balance_xaf, total_recharged_xaf').eq('user_id', id).maybeSingle(),
    db
      .from('orders')
      .select('id, short_id, service_id, quantity, charged_xaf, cost_usd, status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    db
      .from('admin_notes')
      .select('id, body, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    db
      .from('referral_rewards')
      .select(
        'id, referee_id, amount_xaf, created_at, cancelled_at, referee:profiles!referral_rewards_referee_id_fkey(signup_ip_hash, email, phone)',
      )
      .eq('referrer_id', id)
      .order('created_at', { ascending: false }),
    db.from('settings').select('value').eq('key', 'usd_xaf_rate').single(),
  ]);
  if (orders.error || notes.error || rewards.error || rate.error) {
    throw new Error('admin_user_detail_failed');
  }
  const usdXafRate = Number(rate.data.value);
  const balanceXaf = Number(wallet.data?.balance_xaf ?? 0);

  return {
    profile: publicProfile,
    wallet: {
      balance_xaf: balanceXaf,
      total_recharged_xaf: Number(wallet.data?.total_recharged_xaf ?? 0),
    },
    orders: (orders.data ?? []).map((o) => {
      const costUsd = o.cost_usd === null ? null : Number(o.cost_usd);
      return {
        id: o.id,
        short_id: o.short_id,
        service_id: o.service_id,
        quantity: o.quantity,
        charged_xaf: Number(o.charged_xaf),
        cost_usd: costUsd,
        profit_xaf:
          costUsd === null ? null : Number(o.charged_xaf) - Math.round(costUsd * usdXafRate),
        status: o.status,
        created_at: o.created_at,
      };
    }),
    notes: notes.data ?? [],
    referrals: (rewards.data ?? []).map((r) => {
      const refereeHash = one(r.referee)?.signup_ip_hash ?? null;
      return {
        id: r.id,
        referee_id: r.referee_id,
        referee_label: maskIdentity(one(r.referee)?.email ?? null, one(r.referee)?.phone ?? null),
        created_at: r.created_at,
        bonus_xaf: Number(r.amount_xaf),
        bonus_cancelled: r.cancelled_at !== null,
        // Seul le booléen sort : l'empreinte reste en base. Deux empreintes inconnues ne comptent pas.
        same_ip: referrerHash !== null && refereeHash !== null && referrerHash === refereeHash,
      };
    }),
    // Dette = solde négatif (bonus de parrainage annulé après dépense).
    debt_xaf: Math.max(0, -balanceXaf),
  };
}

async function audit(adminId: string, action: string, targetId: string, details: object) {
  const { error } = await createAdminClient().from('audit_log').insert({
    actor_id: adminId,
    action,
    target_table: 'profiles',
    target_id: targetId,
    details,
  });
  if (error) throw new Error('audit_write_failed');
}

async function loadTarget(id: string) {
  if (!UUID.test(id)) return userNotFound();
  const { data } = await createAdminClient()
    .from('profiles')
    .select('id, is_admin, status')
    .eq('id', id)
    .maybeSingle();
  return data ?? userNotFound();
}

/** Blocage, remise perso, plafond. Jamais de solde ici (phase 12). */
export async function updateUser(adminId: string, id: string, patch: Patch) {
  const target = await loadTarget(id);
  if (patch.status === 'blocked' && target.is_admin) apiError('FORBIDDEN');
  // Un compte supprimé ne se réactive pas par cette route.
  if (patch.status && target.status === 'deleted') apiError('FORBIDDEN');

  const changes: Record<string, unknown> = {};
  if (patch.status) {
    changes.status = patch.status;
    changes.blocked_reason = patch.status === 'blocked' ? patch.blocked_reason : null;
  }
  if (patch.custom_discount_pct !== undefined) {
    changes.custom_discount_pct = patch.custom_discount_pct;
  }
  if (patch.daily_spend_limit_xaf !== undefined) {
    changes.daily_spend_limit_xaf = patch.daily_spend_limit_xaf;
  }

  const { data, error } = await createAdminClient()
    .from('profiles')
    .update(changes)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw new Error('admin_user_update_failed');
  await audit(adminId, 'update_user', id, changes);
  return { profile: data };
}

export async function addNote(adminId: string, id: string, body: string) {
  await loadTarget(id);
  const { data, error } = await createAdminClient()
    .from('admin_notes')
    .insert({ user_id: id, body })
    .select('id')
    .single();
  if (error) throw new Error('admin_note_failed');
  await audit(adminId, 'add_note', id, { note_id: data.id });
  return { id: data.id };
}

/** Annule un bonus : uniquement par la fonction SQL (le solde peut devenir négatif, c'est voulu). */
export async function cancelReferralBonus(adminId: string, rewardId: string, reason: string) {
  if (!UUID.test(rewardId)) return apiError('NOT_FOUND');
  const { data, error } = await createAdminClient().rpc('cancel_referral_bonus', {
    p_reward: rewardId,
    p_reason: reason,
    p_admin: adminId,
  });
  if (error) {
    const m = error.message;
    if (m.includes('REWARD_NOT_FOUND') || m.includes('USER_NOT_FOUND')) {
      return apiError('NOT_FOUND');
    }
    if (m.includes('ALREADY_CANCELLED')) {
      return apiError('ALREADY_CANCELLED');
    }
    if (m.includes('NOTE_REQUIRED')) return apiError('NOTE_REQUIRED');
    if (m.includes('NOT_ADMIN')) return apiError('NOT_ADMIN');
    throw new Error('cancel_referral_bonus_failed');
  }
  return { balance_xaf: Number(data) };
}
