import type { NextRequest } from 'next/server';
import { closeByAdmin } from '@/server/admin/order-actions';
import { requireAdminWrite } from '@/server/http/admin-write';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { closeOrderSchema } from '@/server/schemas/admin-orders';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    const admin = await requireAdminWrite(request);
    const { reason } = await parseBody(request, closeOrderSchema);
    return Response.json(await closeByAdmin(admin.id, id, reason), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
