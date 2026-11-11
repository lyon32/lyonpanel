import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { getWallet } from '@/server/wallet/wallet';

export const GET = handler(async (_req, ctx) => {
  const user = await requireApiUser();
  return Response.json(await getWallet(user.id), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
