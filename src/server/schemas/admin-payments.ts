import { z } from 'zod';

export const listPaymentsQuerySchema = z.object({
  status: z.enum(['created', 'pending', 'succeeded', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
