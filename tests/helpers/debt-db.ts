import { randomUUID } from 'node:crypto';
import { makePayment } from '../factories/payment';
import { makeUser, type TestUser } from '../factories/user';
import { adminClient } from '../db/helpers/client';

/* Aides des tests « dette » (phase 11) : la dette ne se fabrique QUE par cancel_referral_bonus, jamais par update direct. */

/** Recharge réelle via credit_payment ; rend l'erreur éventuelle (jamais d'exception). */
export async function recharge(userId: string, amountXaf: number) {
  const fee = Math.round(amountXaf * 0.03);
  const p = await makePayment(userId, {
    credited_xaf: amountXaf,
    fee_xaf: fee,
    total_paid: amountXaf + fee,
  });
  const { error } = await adminClient().rpc('credit_payment', {
    p_payment_id: p.id,
    p_saspay_transaction_id: `txn_${randomUUID()}`,
    p_net_amount_xaf: amountXaf,
    p_fee_xaf: fee,
    p_total_paid: amountXaf + fee,
    p_network: 'MTN',
    p_raw: { test: true },
  });
  return { paymentId: p.id, error };
}

export async function balanceXaf(userId: string): Promise<number> {
  const { data } = await adminClient()
    .from('wallets')
    .select('balance_xaf')
    .eq('user_id', userId)
    .single();
  return Number(data!.balance_xaf);
}

/**
 * Client dont le solde vaut -debtXaf : un filleul recharge 20 x la dette (bonus 5 % = la dette), le parrain
 * « dépense » (solde remis à 0), puis l'administrateur annule le bonus. `created` reçoit parrain et filleul.
 */
export async function makeDebtor(
  created: string[],
  debtXaf: number,
  adminId: string,
  opts: { referral?: string } = {},
): Promise<TestUser> {
  const db = adminClient();
  await db.from('settings').upsert({ key: 'referral_pct', value: 5 });
  const parrain = await makeUser(opts.referral ? { referral: opts.referral } : {});
  created.push(parrain.id);
  const { data: pp } = await db
    .from('profiles')
    .select('referral_code')
    .eq('id', parrain.id)
    .single();
  const filleul = await makeUser({ referral: pp!.referral_code as string });
  created.push(filleul.id);
  const { error } = await recharge(filleul.id, debtXaf * 20);
  if (error) throw new Error(`recharge du filleul impossible : ${error.message}`);
  const { data: reward } = await db
    .from('referral_rewards')
    .select('id, amount_xaf')
    .eq('referee_id', filleul.id)
    .single();
  if (Number(reward?.amount_xaf) !== debtXaf) throw new Error('bonus de parrainage inattendu');
  await db.from('wallets').update({ balance_xaf: 0 }).eq('user_id', parrain.id);
  const cancelled = await db.rpc('cancel_referral_bonus', {
    p_reward: reward!.id,
    p_reason: 'dette de test',
    p_admin: adminId,
  });
  if (cancelled.error) throw new Error(`dette impossible : ${cancelled.error.message}`);
  if ((await balanceXaf(parrain.id)) !== -debtXaf) throw new Error('solde de dette inattendu');
  return parrain;
}
