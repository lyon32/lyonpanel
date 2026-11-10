import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';

export interface RechargeRules {
  minRechargeXaf: number;
  maxRechargeXaf: number;
  /** Pourcentage de frais SasPay (ex. 3 pour 3 %). */
  feePct: number;
}

export interface Quote {
  amountXaf: number;
  feeXaf: number;
  totalToPay: number;
}

/**
 * Devis d'une recharge en mode ADD_ON : le client paie montant + frais, son solde reçoit le montant.
 * Frais arrondis à l'entier supérieur ; calcul en entiers (centièmes de %) pour éviter les
 * erreurs de virgule flottante.
 */
export function computeQuote(amountXaf: number, rules: RechargeRules): Quote {
  if (!Number.isSafeInteger(amountXaf) || amountXaf <= 0) apiError('INVALID_AMOUNT');
  if (amountXaf < rules.minRechargeXaf) {
    apiError('AMOUNT_BELOW_MINIMUM', { min_xaf: rules.minRechargeXaf });
  }
  if (amountXaf > rules.maxRechargeXaf)
    apiError('INVALID_AMOUNT', { max_xaf: rules.maxRechargeXaf });
  const feeBasisPoints = Math.round(rules.feePct * 100);
  const feeXaf = Math.ceil((amountXaf * feeBasisPoints) / 10_000);
  return { amountXaf, feeXaf, totalToPay: amountXaf + feeXaf };
}

const settingsSchema = z.object({
  min_recharge_xaf: z.coerce.number().int().positive(),
  max_recharge_xaf: z.coerce.number().int().positive(),
  saspay_fee_pct: z.coerce.number().min(0).max(100),
});

/** Lit les réglages de recharge (table settings, jamais en dur). */
export async function loadRechargeRules(): Promise<RechargeRules> {
  const { data, error } = await createAdminClient()
    .from('settings')
    .select('key, value')
    .in('key', ['min_recharge_xaf', 'max_recharge_xaf', 'saspay_fee_pct']);
  if (error) throw new Error(`settings: ${error.message}`);
  const parsed = settingsSchema.safeParse(Object.fromEntries(data.map((r) => [r.key, r.value])));
  // Erreur interne (pas VALIDATION_ERROR) : le client n'y est pour rien.
  if (!parsed.success) throw new Error('réglages de recharge manquants ou invalides');
  return {
    minRechargeXaf: parsed.data.min_recharge_xaf,
    maxRechargeXaf: parsed.data.max_recharge_xaf,
    feePct: parsed.data.saspay_fee_pct,
  };
}

/** Devis avec les réglages en vigueur. */
export async function quotePayment(amountXaf: number): Promise<Quote> {
  return computeQuote(amountXaf, await loadRechargeRules());
}
