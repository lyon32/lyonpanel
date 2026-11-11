import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/server/auth/require-api-user';
import { addFavorite, parseServiceId, removeFavorite } from '@/server/favorites/favorites';
import { handler } from '@/server/http/handler';
import { assertSameOrigin } from '@/server/http/request';

type RouteContext = { params: Promise<{ service_id: string }> };

// PUT et DELETE ne diffèrent que par l'action : même origine, même session, même 204.
function favoriteRoute(action: (userId: string, serviceId: number) => Promise<unknown>) {
  return async (req: NextRequest, { params }: RouteContext) => {
    const { service_id } = await params;
    return handler(async (request, ctx) => {
      assertSameOrigin(request);
      const user = await requireApiUser();
      await action(user.id, parseServiceId(service_id));
      return new Response(null, { status: 204, headers: { 'x-request-id': ctx.requestId } });
    })(req);
  };
}

export const PUT = favoriteRoute(addFavorite);
export const DELETE = favoriteRoute(removeFavorite);
