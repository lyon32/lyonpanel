import { requireAdmin } from '@/server/auth/require-admin';
import { listUsers } from '@/server/admin/users';
import { handler } from '@/server/http/handler';
import { listUsersQuerySchema } from '@/server/schemas/admin-users';

export const GET = handler(async (req, ctx) => {
  await requireAdmin();
  const s = req.nextUrl.searchParams;
  const query = listUsersQuerySchema.parse({
    q: s.get('q') ?? undefined,
    country: s.get('country') ?? undefined,
    status: s.get('status') ?? undefined,
    limit: s.get('limit') ?? undefined,
    cursor: s.get('cursor') ?? undefined,
  });
  return Response.json(await listUsers(query), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
