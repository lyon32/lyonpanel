import { requireAdmin } from '@/server/auth/require-admin';
import { listPayments } from '@/server/admin/payments';
import { handler } from '@/server/http/handler';
import { listPaymentsQuerySchema } from '@/server/schemas/admin-payments';

export const GET = handler(async (req, ctx) => {
  await requireAdmin();
  const s = req.nextUrl.searchParams;
  const query = listPaymentsQuerySchema.parse({
    status: s.get('status') ?? undefined,
    limit: s.get('limit') ?? undefined,
    cursor: s.get('cursor') ?? undefined,
  });
  return Response.json(await listPayments(query), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
