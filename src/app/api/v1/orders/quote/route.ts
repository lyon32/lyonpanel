import { requireApiUser } from '@/server/auth/require-api-user';
import { createAttemptStore, createRateLimiter } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { quoteOrder } from '@/server/orders/quote';
import { quoteOrderSchema } from '@/server/schemas/order';

// Devis d'une commande : aucun débit. Le prix est recalculé ici, jamais lu dans la requête.
export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  await createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
    scope: 'orders-quote',
    key: user.id,
    max: 60,
    windowSeconds: 60,
  });
  const input = await parseBody(req, quoteOrderSchema);
  return Response.json(await quoteOrder(user.id, input), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
