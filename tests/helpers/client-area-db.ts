import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { adminClient } from '../db/helpers/client';

/* Aides communes des tests de l'espace client (phase 8) : vraie base locale, aucun réseau. */

export const ORIGIN = 'http://localhost:3000';

export type ErrorBody = { error: { code: string; message: string; request_id: string } };

export const getReq = (path: string) => new NextRequest(`${ORIGIN}${path}`);

export const sendReq = (
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

/** Écrit une ligne de journal (préparation seulement ; l'argent réel passe par les fonctions SQL). */
export async function makeTransaction(
  userId: string,
  over: Partial<{
    type: 'recharge' | 'order' | 'refund' | 'referral_bonus' | 'adjustment';
    amount_xaf: number;
    balance_after_xaf: number;
    created_at: string;
    order_id: string;
  }> = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient()
    .from('wallet_transactions')
    .insert({
      user_id: userId,
      type: 'recharge',
      amount_xaf: 1000,
      balance_after_xaf: 1000,
      ref: `test-${randomUUID()}`,
      ...over,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`makeTransaction a échoué : ${error?.message}`);
  return data as { id: string };
}

export async function profileOf(userId: string): Promise<Record<string, unknown>> {
  const { data } = await adminClient().from('profiles').select('*').eq('id', userId).single();
  return data as Record<string, unknown>;
}

export async function favoriteIdsOf(userId: string): Promise<number[]> {
  const { data } = await adminClient().from('favorites').select('service_id').eq('user_id', userId);
  return (data ?? []).map((r) => Number(r.service_id));
}
