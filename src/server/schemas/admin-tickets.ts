import { z } from 'zod';

export const ticketReplySchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();

// « answered » vient de la réponse du propriétaire, jamais d'un choix manuel.
export const patchTicketSchema = z.object({ status: z.enum(['open', 'closed']) }).strict();

export const listTicketsQuerySchema = z.object({
  status: z.enum(['open', 'answered', 'closed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});
