import { z } from 'zod';
import { CURRENCIES } from '@/lib/currency';

/** Paramètres de ?currency= et ?locale= ; locale absente = langue détectée de la requête. */
export const catalogQuerySchema = z.object({
  currency: z.enum(CURRENCIES).default('XAF'),
  locale: z.enum(['fr', 'en']).optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
