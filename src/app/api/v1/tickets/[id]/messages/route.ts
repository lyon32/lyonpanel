import type { NextRequest } from 'next/server';
import { requireApiUser } from '@/server/auth/require-api-user';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { ticketMessageSchema } from '@/server/schemas/ticket';
import { addMessage } from '@/server/tickets/tickets';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const input = await parseBody(request, ticketMessageSchema);
    return Response.json(await addMessage(user.id, id, input), {
      status: 201,
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
