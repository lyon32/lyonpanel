import { randomUUID } from 'node:crypto';
import { adminClient } from '../db/helpers/client';

export type PaymentOverrides = Record<string, unknown>;

/** Insère une vraie recharge (statut `created` par défaut, identifiants uniques). */
export async function makePayment(
  userId: string,
  overrides: PaymentOverrides = {},
): Promise<{ id: string } & Record<string, unknown>> {
  const row = {
    user_id: userId,
    saspay_session_id: `sess_${randomUUID()}`,
    credited_xaf: 10000,
    fee_xaf: 300,
    total_paid: 10300,
    pay_currency: 'XAF',
    idem_key: randomUUID(),
    ...overrides,
  };
  const { data, error } = await adminClient().from('payments').insert(row).select().single();
  if (error || !data) throw new Error(`makePayment a échoué : ${error?.message}`);
  return data as { id: string } & Record<string, unknown>;
}
