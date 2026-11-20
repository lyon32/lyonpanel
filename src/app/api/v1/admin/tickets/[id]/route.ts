import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/auth/require-admin';
import { getAdminTicket, setTicketStatus } from '@/server/admin/tickets';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { patchTicketSchema } from '@/server/schemas/admin-tickets';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handler(async (_request, ctx) => {
    await requireAdmin();
    return Response.json(await getAdminTicket(id), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    const admin = await requireAdmin();
    assertSameOrigin(request);
    const { status } = await parseBody(request, patchTicketSchema);
    return Response.json(await setTicketStatus(admin.id, id, status), {
      headers: { 'x-request-id': ctx.requestId },
    });
  })(req);
}
