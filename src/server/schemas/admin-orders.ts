import { z } from 'zod';

// Motif obligatoire, borné : il est écrit tel quel dans le journal d'audit.
const reasonSchema = z.string().trim().min(2).max(500);

export const refundOrderSchema = z
  .object({
    // Entier XAF, jamais plus de 100 millions (garde-fou contre une faute de frappe).
    amount_xaf: z.number().int().positive().max(100_000_000),
    reason: reasonSchema,
  })
  .strict();

export const closeOrderSchema = z.object({ reason: reasonSchema }).strict();
export const cancelOrderSchema = z.object({ reason: reasonSchema }).strict();
export const resendOrderSchema = z
  .object({ confirm_verified: z.literal(true), reason: reasonSchema })
  .strict();

export const listAdminOrdersQuerySchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'partial', 'canceled', 'to_review', 'refunded'])
    .optional(),
  // Recherche par numéro (n° LyonPanel ou n° fournisseur) : chiffres seulement, rien de libre dans le filtre.
  q: z
    .string()
    .regex(/^\d{1,9}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
