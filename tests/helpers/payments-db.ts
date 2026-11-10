import { afterAll } from 'vitest';
import { adminClient } from '../db/helpers/client';
import { TEST_WEBHOOK_SECRET } from './saspay-webhook';

/*
 * Aide commune des tests de recharge qui utilisent la vraie base locale.
 * Le faux SasPay est actif (SASPAY_MODE=test, aucune clé) ; les secrets sont fictifs.
 */

export const CRON_TEST_SECRET = 'cron_test_only_not_a_real_secret';

/** À appeler en tête de fichier : le code serveur relit process.env à chaque appel. */
export function setupFakeSaspayEnv(): void {
  process.env.SASPAY_MODE = 'test';
  process.env.SASPAY_API_KEY = '';
  process.env.SASPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  process.env.CRON_SECRET = CRON_TEST_SECRET;
}

/** Réglages de la décision du 2026-11-10 : 500 à 500 000 XAF, frais 3 %. */
export async function setRechargeSettings(
  over: Partial<{
    min_recharge_xaf: number;
    max_recharge_xaf: number;
    saspay_fee_pct: number;
  }> = {},
): Promise<void> {
  const values = {
    min_recharge_xaf: 500,
    max_recharge_xaf: 500_000,
    saspay_fee_pct: 3,
    ...over,
  };
  const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
  const { error } = await adminClient().from('settings').upsert(rows);
  if (error) throw new Error(`réglages de recharge impossibles : ${error.message}`);
}

/**
 * À appeler en tête de fichier : en fin de fichier (même si un test a échoué),
 * remet les réglages de recharge à 500 / 500 000 / 3 et ferme les recharges
 * `pending` laissées, pour ne pas polluer seed.test.ts et les autres fichiers.
 */
export function restoreRechargeStateAfterAll(): void {
  afterAll(async () => {
    await setRechargeSettings();
    await clearOtherPendingPayments();
  });
}

export async function walletOf(
  userId: string,
): Promise<{ balance_xaf: number; total_recharged_xaf: number }> {
  const { data } = await adminClient().from('wallets').select('*').eq('user_id', userId).single();
  return data as { balance_xaf: number; total_recharged_xaf: number };
}

export async function paymentOf(id: string): Promise<Record<string, unknown>> {
  const { data } = await adminClient().from('payments').select('*').eq('id', id).single();
  return data as Record<string, unknown>;
}

/** Lignes du journal d'argent liées à un paiement (il ne doit y en avoir qu'une au plus). */
export async function journalOf(paymentId: string): Promise<Record<string, unknown>[]> {
  const { data } = await adminClient()
    .from('wallet_transactions')
    .select('*')
    .eq('payment_id', paymentId);
  return (data ?? []) as Record<string, unknown>[];
}

/** Recule la date de création d'une recharge (pour tester rattrapage et expiration). */
export async function ageInMinutes(paymentId: string, minutes: number): Promise<void> {
  const createdAt = new Date(Date.now() - minutes * 60_000).toISOString();
  const { error } = await adminClient()
    .from('payments')
    .update({ created_at: createdAt })
    .eq('id', paymentId);
  if (error) throw new Error(`vieillissement impossible : ${error.message}`);
}

/** Évite que des recharges en attente laissées par d'autres tests faussent les compteurs. */
export async function clearOtherPendingPayments(): Promise<void> {
  await adminClient().from('payments').update({ status: 'failed' }).eq('status', 'pending');
}
