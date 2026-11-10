import { z } from 'zod';

// Clés en snake_case, comme l'API. Le total envoyé par le navigateur n'est qu'une attente :
// le serveur recalcule toujours le prix.
export const quoteOrderSchema = z.object({
  service_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  service_id: z.number().int().positive(),
  link: z.string().trim().min(1).max(2048),
  quantity: z.number().int().positive(),
  comments: z.array(z.string().min(1).max(500)).max(1000).optional(),
  expected_total_xaf: z.number().int().positive(),
});

export type QuoteOrderInput = z.infer<typeof quoteOrderSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
