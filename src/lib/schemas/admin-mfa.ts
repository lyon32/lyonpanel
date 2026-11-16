import { z } from 'zod';

// Exactement 6 chiffres, sans espace ni nombre : rien n'est nettoyé, un code mal formé est refusé.
export const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'INVALID_CODE') });
export const mfaConfirmSchema = z.object({
  factor_id: z.uuid(),
  code: z.string().regex(/^\d{6}$/, 'INVALID_CODE'),
});
