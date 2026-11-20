import { requireAdmin } from '@/server/auth/require-admin';
import { listAdminTickets } from '@/server/admin/tickets';
import { handler } from '@/server/http/handler';
import { listTicketsQuerySchema } from '@/server/schemas/admin-tickets';

export const GET = handler(async (req, ctx) => {
  await requireAdmin();
  const s = req.nextUrl.searchParams;
  const query = listTicketsQuerySchema.parse({
    status: s.get('status') ?? undefined,
    limit: s.get('limit') ?? undefined,
    cursor: s.get('cursor') ?? undefined,
  });
  return Response.json(await listAdminTickets(query), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
