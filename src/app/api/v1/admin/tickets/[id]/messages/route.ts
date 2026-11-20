import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/auth/require-admin';
import { replyTicket } from '@/server/admin/tickets';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { ticketReplySchema } from '@/server/schemas/admin-tickets';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    const admin = await requireAdmin();
    assertSameOrigin(request);
    const { body } = await parseBody(request, ticketReplySchema);
    return Response.json(await replyTicket(admin.id, id, body), {
      status: 201,
      headers: { 'x-request-id': ctx.requestId },
    });
  })(req);
}
