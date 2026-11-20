import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { makeOrder } from '../factories/order';
import { makeService } from '../factories/service';
import { adminClient } from '../db/helpers/client';
import { getReq, sendReq } from './client-area-db';
import { makeFundedUser, makeFollowersService, nextProviderOrderId } from './orders-db';

/*
 * Aides communes des tests de la phase 12 (admin 2). Vraie base locale, aucun réseau.
 *
 * Contrat attendu des routes (API_SPEC §8, précisé par la tâche 12.1) :
 *   GET   /admin/orders?status=&limit=&cursor=      -> { items: [{ id, short_id, status, provider_order_id, ... }], next_cursor }
 *   GET   /admin/orders/{id}                         -> { order: {..., provider_order_id, cost_usd, profit_xaf, refunded_xaf }, ... }
 *   POST  /admin/orders/{id}/refund  { amount_xaf, reason }  (en-tête facultatif Idempotency-Key)
 *                                                    -> 200 { refunded_xaf, total_refunded_xaf, order_status }
 *   POST  /admin/orders/{id}/cancel  { reason }      -> 200 { order_status: 'to_review' } (annulation envoyée au fournisseur)
 *   POST  /admin/orders/{id}/resend  { confirm_verified: true, reason }  -> 200
 *   POST  /admin/orders/{id}/close   { reason }      -> 200 { order_status: 'completed' }
 *   GET   /admin/payments?status=                    -> { items, next_cursor }
 *   GET   /admin/services?platform=&active=          -> { items }
 *   PATCH /admin/services/{id} { active?, name_fr?, name_en?, multiplier?, sort_order?, confirm? } -> 200 { service }
 *   POST  /admin/services/{id}/preview { multiplier } -> 200 { old_price_xaf_1000, new_price_xaf_1000 }
 *   GET|PATCH /admin/settings                        -> { settings: { <clé>: <valeur> } }
 *   GET   /admin/tickets?status=                     -> { items, next_cursor }
 *   POST  /admin/tickets/{id}/messages { body }      -> 201
 *   PATCH /admin/tickets/{id} { status: 'open'|'closed' } -> 200
 *   GET   /admin/audit?action=&limit=&cursor=        -> { items: [{ id, actor_id, action, target_table, target_id, details, created_at }], next_cursor }
 */

type Handler = (req: Request, ctx?: unknown) => Promise<Response>;

/** Charge un module par son chemin : un module absent fait échouer CE test, pas tout le fichier. */
const load = <T>(path: string): Promise<T> => import(/* @vite-ignore */ path) as Promise<T>;

export const ROUTES = {
  orders: '@/app/api/v1/admin/orders/route',
  order: '@/app/api/v1/admin/orders/[id]/route',
  refund: '@/app/api/v1/admin/orders/[id]/refund/route',
  cancel: '@/app/api/v1/admin/orders/[id]/cancel/route',
  resend: '@/app/api/v1/admin/orders/[id]/resend/route',
  close: '@/app/api/v1/admin/orders/[id]/close/route',
  payments: '@/app/api/v1/admin/payments/route',
  services: '@/app/api/v1/admin/services/route',
  service: '@/app/api/v1/admin/services/[id]/route',
  preview: '@/app/api/v1/admin/services/[id]/preview/route',
  settings: '@/app/api/v1/admin/settings/route',
  tickets: '@/app/api/v1/admin/tickets/route',
  ticket: '@/app/api/v1/admin/tickets/[id]/route',
  ticketMessages: '@/app/api/v1/admin/tickets/[id]/messages/route',
  audit: '@/app/api/v1/admin/audit/route',
} as const;

/** Appelle un handler de route par son nom de méthode ; `id` alimente params.id des routes dynamiques. */
export async function callRoute(
  route: string,
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  opts: { body?: unknown; id?: string; headers?: Record<string, string> } = {},
): Promise<Response> {
  const mod = await load<Record<string, Handler>>(route);
  const fn = mod[method];
  if (typeof fn !== 'function') throw new Error(`${route} n'exporte pas ${method}`);
  const req = method === 'GET' ? getReq(url) : sendReq(method, url, opts.body, opts.headers);
  return fn(req, opts.id ? { params: Promise.resolve({ id: opts.id }) } : undefined);
}

/** Commande déjà payée (débit réel écrit), prête pour remboursement, renvoi ou clôture. */
export async function paidOrder(
  created: string[],
  over: Record<string, unknown> = {},
): Promise<{ id: string; userId: string; providerOrderId: number; serviceId: number }> {
  const s = await makeFollowersService();
  const u = await makeFundedUser(created, { balance: 0 });
  const providerOrderId = nextProviderOrderId();
  const o = await makeOrder(u.id, s.id, {
    quantity: 1000,
    charged_xaf: 1000,
    status: 'to_review',
    provider_order_id: providerOrderId,
    remains: 1000,
    start_count: 0,
    ...over,
  });
  const charged = Number(o.charged_xaf);
  const { error } = await adminClient()
    .from('wallet_transactions')
    .insert({
      user_id: u.id,
      type: 'order',
      amount_xaf: -charged,
      balance_after_xaf: 0,
      order_id: o.id,
      ref: `order:${o.id}`,
    });
  if (error) throw new Error(`débit de test impossible : ${error.message}`);
  return { id: o.id, userId: u.id, providerOrderId, serviceId: s.id };
}

export async function refundsOf(orderId: string): Promise<Record<string, unknown>[]> {
  const { data } = await adminClient()
    .from('wallet_transactions')
    .select('*')
    .eq('order_id', orderId)
    .eq('type', 'refund');
  return (data ?? []) as Record<string, unknown>[];
}

export async function auditRows(
  action: string,
  targetId?: string,
): Promise<Record<string, unknown>[]> {
  let q = adminClient().from('audit_log').select('*').eq('action', action);
  if (targetId) q = q.eq('target_id', targetId);
  const { data } = await q.order('id');
  return (data ?? []) as Record<string, unknown>[];
}

function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', 'supabase_db_lyonpanel', 'psql', '-U', 'postgres', '-At', '-c', sql],
    {
      encoding: 'utf8',
    },
  );
}

/**
 * Fait échouer toute écriture dans audit_log pour ces actions (déclencheur temporaire, base locale).
 * Sert à prouver l'atomicité : si la trace échoue, le changement doit être annulé.
 * Renvoie la fonction qui retire le déclencheur : à appeler dans `finally`.
 */
export function failAuditFor(actions: string[]): () => void {
  const tag = `zz_fail_${randomUUID().slice(0, 8).replace(/-/g, '')}`;
  const list = actions.map((a) => `'${a.replace(/'/g, "''")}'`).join(',');
  psql(
    `create function public.${tag}() returns trigger language plpgsql as $$ begin raise exception 'AUDIT_TEST_FAILURE'; end $$; ` +
      `create trigger ${tag} before insert on public.audit_log for each row when (new.action in (${list})) execute function public.${tag}();`,
  );
  return () => {
    psql(
      `drop trigger if exists ${tag} on public.audit_log; drop function if exists public.${tag}();`,
    );
  };
}

export { makeService };
