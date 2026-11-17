import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { cancelOrder } from '@/server/orders/cancel-order';

// Annulation d'une commande qui n'a pas encore démarré : rembourse le montant débité.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (_request, ctx) => {
    const user = await requireApiUser();
    const result = await cancelOrder(user.id, id);
    return Response.json(result, { headers: { 'x-request-id': ctx.requestId } });
  })(req);
}
