import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { suggestOrder } from '@/server/orders/suggest-order';

// Calculée côté serveur à chaque appel : le navigateur ne fournit ni service ni quantité.
export const GET = handler(async (_req, ctx) => {
  const user = await requireApiUser();
  const suggestion = await suggestOrder(user.id, ctx.locale);
  return Response.json(
    { suggestion },
    { headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' } },
  );
});
