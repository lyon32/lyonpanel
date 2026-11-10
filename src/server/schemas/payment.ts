import { z } from 'zod';

// Les bornes min/max viennent des réglages (payments/quote.ts), pas du schéma.
// z.object retire les champs inconnus : frais et total envoyés par le navigateur sont ignorés.
export const createPaymentSchema = z.object({
  amount_xaf: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export const quotePaymentSchema = createPaymentSchema;

export const idempotencyKeySchema = z.string().trim().min(8).max(100);

export const listPaymentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.iso.datetime({ offset: true }).optional(),
});
