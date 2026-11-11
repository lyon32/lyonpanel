import { requireApiUser } from '@/server/auth/require-api-user';
import { listFavorites } from '@/server/favorites/favorites';
import { handler } from '@/server/http/handler';

export const GET = handler(async (_req, ctx) => {
  const user = await requireApiUser();
  return Response.json(await listFavorites(user.id, ctx.locale), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
