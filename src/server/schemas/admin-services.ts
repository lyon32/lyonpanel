import { z } from 'zod';

// Borne alignée sur la base (0 < multiplicateur ≤ 50).
const multiplierSchema = z.number().finite().gt(0).max(50);
const nameSchema = z.string().trim().min(1).max(200);
// Texte client perso : vide = retour au texte généré (la base le remet à null).
const customTextSchema = z.string().trim().max(400);

export const listServicesQuerySchema = z.object({
  platform: z.string().trim().min(1).max(50).optional(),
  active: z.enum(['true', 'false']).optional(),
  // Recherche : nom FR/EN ou identifiant exact.
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Corps strict : ni prix, ni coût, ni nom fournisseur, ni liste d'identifiants (pas de modification en masse). */
export const patchServiceSchema = z
  .object({
    active: z.boolean().optional(),
    name_fr: nameSchema.optional(),
    name_en: nameSchema.optional(),
    custom_name_fr: customTextSchema.optional(),
    custom_name_en: customTextSchema.optional(),
    custom_description_fr: customTextSchema.optional(),
    custom_description_en: customTextSchema.optional(),
    multiplier: multiplierSchema.optional(),
    sort_order: z.number().int().min(-1_000_000).max(1_000_000).optional(),
    confirm: z.boolean().optional(),
  })
  .strict();

export const previewServiceSchema = z.object({ multiplier: multiplierSchema }).strict();
