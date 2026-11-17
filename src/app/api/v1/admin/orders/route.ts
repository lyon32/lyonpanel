import { requireAdmin } from '@/server/auth/require-admin';
import { listAdminOrders } from '@/server/admin/orders';
import { handler } from '@/server/http/handler';
import { listAdminOrdersQuerySchema } from '@/server/schemas/admin-orders';

export const GET = handler(async (req, ctx) => {
  await requireAdmin();
  const s = req.nextUrl.searchParams;
  const query = listAdminOrdersQuerySchema.parse({
    status: s.get('status') ?? undefined,
    limit: s.get('limit') ?? undefined,
    cursor: s.get('cursor') ?? undefined,
  });
  return Response.json(await listAdminOrders(query), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
