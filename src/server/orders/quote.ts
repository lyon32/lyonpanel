import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import { computeDiscountedTotalXaf } from '@/server/pricing/compute-discounted-total';
import type { QuoteOrderInput } from '@/server/schemas/order';

export interface OrderQuote {
  price_xaf_1000: number;
  discount_pct: number;
  total_xaf: number;
  balance_after_xaf: number;
}

const autoDiscountSchema = z.object({
  threshold_xaf: z.coerce.number().int().nonnegative(),
  pct: z.coerce.number().min(0).max(100),
});

/** Remise automatique selon le total déjà rechargé ; 0 si le réglage est absent ou illisible. */
function autoDiscountPct(value: unknown, totalRechargedXaf: number): number {
  const parsed = autoDiscountSchema.safeParse(value);
  if (!parsed.success) return 0;
  return totalRechargedXaf >= parsed.data.threshold_xaf ? parsed.data.pct : 0;
}

/**
 * Devis d'une commande : aucun débit, aucune écriture. Mêmes règles que place_order (SQL) :
 * remise = la plus grande de l'automatique et de la personnalisée, jamais cumulées.
 */
export async function quoteOrder(userId: string, input: QuoteOrderInput): Promise<OrderQuote> {
  const db = createAdminClient();
  const [service, wallet, profile, setting] = await Promise.all([
    db.from('services').select('*').eq('id', input.service_id).maybeSingle(),
    db.from('wallets').select('balance_xaf, total_recharged_xaf').eq('user_id', userId).single(),
    db.from('profiles').select('custom_discount_pct').eq('id', userId).single(),
    db.from('settings').select('value').eq('key', 'auto_discount').maybeSingle(),
  ]);
  if (service.error) throw new Error(`services: ${service.error.message}`);
  if (wallet.error) throw new Error(`wallets: ${wallet.error.message}`);
  if (profile.error) throw new Error(`profiles: ${profile.error.message}`);
  if (setting.error) throw new Error(`settings: ${setting.error.message}`);

  const s = service.data;
  const price = s?.price_xaf_1000 ?? 0;
  if (!s || !s.active || !s.available || price <= 0) apiError('SERVICE_UNAVAILABLE');
  if (input.quantity < s.min_qty || input.quantity > s.max_qty) {
    apiError('QUANTITY_OUT_OF_RANGE', { min: s.min_qty, max: s.max_qty });
  }

  const discountPct = Math.max(
    autoDiscountPct(setting.data?.value, wallet.data.total_recharged_xaf),
    profile.data.custom_discount_pct ?? 0,
  );
  const totalXaf = computeDiscountedTotalXaf(price, input.quantity, discountPct);
  return {
    price_xaf_1000: price,
    discount_pct: discountPct,
    total_xaf: totalXaf,
    balance_after_xaf: wallet.data.balance_xaf - totalXaf,
  };
}
