import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { getOrder } from '@/server/orders/list-orders';

// Rappelée toutes les 30 s par le site tant que la commande n'est pas terminée (API_SPEC §6.5).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (_request, ctx) => {
    const user = await requireApiUser();
    const order = await getOrder(user.id, id, ctx.locale);
    return Response.json(order, {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
