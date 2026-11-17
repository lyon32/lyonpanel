import { z } from 'zod';
import { requireAdmin } from '@/server/auth/require-admin';
import { getAdminStats } from '@/server/admin/stats';
import { handler } from '@/server/http/handler';

const querySchema = z.object({ range: z.enum(['today', '7d', '30d']).default('today') });

export const GET = handler(async (req, ctx) => {
  await requireAdmin();
  const { range } = querySchema.parse({
    range: req.nextUrl.searchParams.get('range') ?? undefined,
  });
  return Response.json(await getAdminStats(range), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
