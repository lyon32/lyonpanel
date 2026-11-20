import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/auth/require-admin';
import { getAdminOrder } from '@/server/admin/orders';
import { handler } from '@/server/http/handler';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (_r, ctx) => {
    await requireAdmin();
    return Response.json(await getAdminOrder(id), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
