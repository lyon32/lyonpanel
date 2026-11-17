import type { NextRequest } from 'next/server';
import { refundOrder } from '@/server/admin/refund-order';
import { requireAdminWrite } from '@/server/http/admin-write';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { refundOrderSchema } from '@/server/schemas/admin-orders';
import { idempotencyKeySchema } from '@/server/schemas/payment';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    const admin = await requireAdminWrite(request);
    const input = await parseBody(request, refundOrderSchema);
    // Clé facultative : rejouée, elle ne crédite jamais deux fois (la fonction SQL la garde).
    const header = request.headers.get('idempotency-key');
    const idemKey = header === null ? null : idempotencyKeySchema.parse(header);
    return Response.json(await refundOrder(admin.id, id, input, idemKey), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
