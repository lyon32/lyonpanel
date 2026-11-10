import { adminClient } from '../db/helpers/client';
import { makeOrder } from '../factories/order';
import { makeFollowersService, makeFundedUser, nextProviderOrderId } from './orders-db';

/*
 * Aide des tests de suivi (phase 7) : commandes préparées directement en base,
 * sans débit ni appel fournisseur. Écriture de préparation seulement.
 */

export async function inProgressOrder(
  created: string[],
  over: Record<string, unknown> = {},
): Promise<{ id: string; userId: string; providerOrderId: number }> {
  const s = await makeFollowersService();
  const u = await makeFundedUser(created, { balance: 0 });
  const providerOrderId = nextProviderOrderId();
  const o = await makeOrder(u.id, s.id, {
    quantity: 1000,
    charged_xaf: 1155,
    status: 'in_progress',
    provider_order_id: providerOrderId,
    ...over,
  });
  return { id: o.id, userId: u.id, providerOrderId };
}

/** Commande restée « en envoi » : pending + error='submitting', créée il y a `minutesAgo` minutes. */
export async function stuckOrder(
  created: string[],
  minutesAgo: number,
): Promise<{ id: string; userId: string }> {
  const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const s = await makeFollowersService();
  const u = await makeFundedUser(created, { balance: 0 });
  const o = await makeOrder(u.id, s.id, {
    quantity: 1000,
    charged_xaf: 1155,
    status: 'pending',
    error: 'submitting',
    created_at: at,
    updated_at: at,
  });
  return { id: o.id, userId: u.id };
}

export async function reloadOrder(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await adminClient().from('orders').select('*').eq('id', id).single();
  if (error) throw new Error(`commande introuvable : ${error.message}`);
  return data as Record<string, unknown>;
}
