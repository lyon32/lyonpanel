import { z } from 'zod';
import { normalizePhone } from '@/lib/schemas/auth';

const phoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (!phone) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' });
    return z.NEVER;
  }
  return phone;
});

/**
 * Seuls ces 4 champs sont lus : tout le reste (solde, remise, email, statut, rôle) est ignoré
 * par Zod et n'atteint jamais la base. Un corps sans aucun champ utile est refusé.
 */
export const patchMeSchema = z
  .object({
    display_currency: z.enum(['XAF', 'XOF', 'USD']).optional(),
    language: z.enum(['fr', 'en']).optional(),
    phone: phoneSchema.optional(),
    // Booléen strict : « false », 0 ou null sont refusés.
    suggestions_enabled: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'EMPTY_BODY',
    path: ['_'],
  });
export type PatchMeInput = z.infer<typeof patchMeSchema>;

export const deleteMeSchema = z.object({
  password: z.string().min(1, 'PASSWORD_REQUIRED').max(200),
});
