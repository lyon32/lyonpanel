import { z } from 'zod';

const reasonSchema = z.string().trim().min(1).max(500);

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  status: z.enum(['active', 'blocked', 'deleted']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});

/**
 * Seuls ces 4 champs passent (corps strict) : pas de solde, d'email, de rôle ni de parrain.
 * Un blocage exige un motif ; un déblocage efface le motif.
 */
export const patchUserSchema = z
  .object({
    status: z.enum(['active', 'blocked']).optional(),
    blocked_reason: reasonSchema.optional(),
    custom_discount_pct: z.number().min(0).max(50).nullable().optional(),
    daily_spend_limit_xaf: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'EMPTY_BODY' })
  .refine((v) => v.status !== 'blocked' || v.blocked_reason !== undefined, {
    message: 'REASON_REQUIRED',
    path: ['blocked_reason'],
  })
  .refine((v) => v.blocked_reason === undefined || v.status === 'blocked', {
    message: 'REASON_ONLY_WHEN_BLOCKING',
    path: ['blocked_reason'],
  });

export const noteSchema = z.object({ body: z.string().trim().min(1).max(2000) });
export const cancelBonusSchema = z.object({ reason: reasonSchema });
