import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { patchTicketSchema } from '@/server/schemas/ticket';
import { closeTicket, getTicket } from '@/server/tickets/tickets';

type Params = { params: Promise<{ id: string }> };
const PRIVATE = 'private, no-store';

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return handler(async (_request, ctx) => {
    const user = await requireApiUser();
    return Response.json(await getTicket(user.id, id), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': PRIVATE },
    });
  })(req);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    assertSameOrigin(request);
    const user = await requireApiUser();
    await parseBody(request, patchTicketSchema);
    await closeTicket(user.id, id);
    const { ticket } = await getTicket(user.id, id);
    return Response.json(
      { ticket },
      { headers: { 'x-request-id': ctx.requestId, 'cache-control': PRIVATE } },
    );
  })(req);
}
