import { z } from 'zod';

const amountXaf = z.number().int().min(1).max(100_000_000);

/**
 * Corps strict : toute clé inconnue (donc tout secret) est refusée.
 * Bornes alignées sur update_setting en base ; la règle min ≤ max est vérifiée par la base.
 */
export const patchSettingsSchema = z
  .object({
    usd_xaf_rate: z.number().finite().gt(0).max(100_000),
    default_multiplier: z.number().finite().gt(0).max(50),
    min_recharge_xaf: amountXaf,
    max_recharge_xaf: amountXaf,
    daily_order_cap_xaf: amountXaf,
    provider_low_balance_usd: z.number().finite().min(0).max(100_000),
    price_alert_pct: z.number().finite().gt(0).lt(1000),
    referral_pct: z.number().finite().min(0).max(100),
    auto_discount: z
      .object({
        threshold_xaf: z.number().int().min(0).max(100_000_000),
        pct: z.number().finite().min(0).max(100),
      })
      .strict(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'EMPTY_BODY' });

export type SettingsPatch = z.infer<typeof patchSettingsSchema>;
