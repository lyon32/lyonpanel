import { z } from 'zod';
import { requireApiUser } from '@/server/auth/require-api-user';
import { createAttemptStore, createRateLimiter } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { listOrders } from '@/server/orders/list-orders';
import { placeOrder } from '@/server/orders/place-order';
import { createOrderSchema } from '@/server/schemas/order';
import { idempotencyKeySchema } from '@/server/schemas/payment';

const listQuerySchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'partial', 'canceled', 'to_review', 'refunded'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).max(200).optional(),
});

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  // API_SPEC §5 : 10 commandes / minute / client, avant tout contact avec la base d'argent.
  await createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
    scope: 'orders',
    key: user.id,
    max: 10,
    windowSeconds: 60,
  });
  const idempotencyKey = idempotencyKeySchema.parse(
    req.headers.get('idempotency-key') ?? undefined,
  );
  const input = await parseBody(req, createOrderSchema);
  const order = await placeOrder(user.id, input, idempotencyKey);
  // 202 : débitée mais en vérification (to_review), jamais présentée comme un échec.
  return Response.json(order, {
    status: order.status === 'to_review' ? 202 : 201,
    headers: { 'x-request-id': ctx.requestId },
  });
});

export const GET = handler(async (req, ctx) => {
  const user = await requireApiUser();
  const search = req.nextUrl.searchParams;
  const query = listQuerySchema.parse({
    status: search.get('status') ?? undefined,
    limit: search.get('limit') ?? undefined,
    cursor: search.get('cursor') ?? undefined,
  });
  const page = await listOrders(user.id, query, ctx.locale);
  return Response.json(page, {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
