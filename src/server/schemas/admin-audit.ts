import { z } from 'zod';

export const listAuditQuerySchema = z.object({
  // Noms d'actions en snake_case seulement : rien de libre n'entre dans le filtre.
  action: z
    .string()
    .regex(/^[a-z0-9_]{1,64}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // Curseur = identifiant numérique de la dernière ligne vue.
  cursor: z
    .string()
    .regex(/^\d{1,18}$/)
    .optional(),
});
