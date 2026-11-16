import { z } from 'zod';

export const TICKET_SUBJECTS = ['order', 'recharge', 'account', 'other'] as const;
export const MAX_BODY_LENGTH = 4000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 3;

// Texte brut : gardé tel quel (l'affichage échappe), seulement refusé s'il est vide.
const bodySchema = z
  .string()
  .max(MAX_BODY_LENGTH)
  .refine((s) => s.trim().length > 0, { message: 'EMPTY_BODY' });

const attachmentIdsSchema = z
  .array(z.uuid())
  .max(MAX_ATTACHMENTS_PER_MESSAGE)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'DUPLICATE_ATTACHMENT' })
  .optional();

export const createTicketSchema = z
  .object({
    subject: z.enum(TICKET_SUBJECTS),
    order_id: z.uuid().optional(),
    body: bodySchema,
    attachment_ids: attachmentIdsSchema,
  })
  .refine((t) => t.subject !== 'order' || t.order_id !== undefined, {
    message: 'ORDER_REQUIRED',
    path: ['order_id'],
  });

export const ticketMessageSchema = z.object({
  body: bodySchema,
  attachment_ids: attachmentIdsSchema,
});

// Le client ne peut que fermer son ticket ; les autres statuts sont posés par la base.
export const patchTicketSchema = z.object({ status: z.literal('closed') });

export const listTicketsQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
