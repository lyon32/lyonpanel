import { z } from 'zod';
import { assertTestRouteAllowed } from '../guard';
import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';
import { forceMockOrderStatus } from '@/server/providers/mock-provider';

const bodySchema = z.object({
  providerOrderId: z.number().int().positive(),
  status: z.enum(['Partial', 'Canceled']),
});

// Route réservée aux tests e2e : impose un statut fournisseur à une commande du faux fournisseur.
export const POST = handler(async (req) => {
  assertTestRouteAllowed(req);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) apiError('VALIDATION_ERROR');
  forceMockOrderStatus(parsed.data.providerOrderId, parsed.data.status);
  return { forced: true };
});
