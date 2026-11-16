import { z } from 'zod';

// Même forme que la règle de la base : <uuid client>/<uuid fichier>.(jpg|png|webp), rien d'autre.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const ATTACHMENT_PATH = new RegExp(`^${UUID}/${UUID}\.(jpg|png|webp)$`);

export const MAX_PURGE_PATHS = 200;

export const purgeOrphansSchema = z.object({
  paths: z.array(z.string().regex(ATTACHMENT_PATH)).min(1).max(MAX_PURGE_PATHS),
  // Exactement `true` : « true », 1 ou l'absence de champ ne suppriment rien.
  confirm: z.literal(true),
  minAgeMinutes: z.number().int().min(0).max(10_080).optional(),
});
