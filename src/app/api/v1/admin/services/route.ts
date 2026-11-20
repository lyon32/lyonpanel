import type { NextRequest } from 'next/server';
import { listAdminServices } from '@/server/admin/services';
import { requireAdmin } from '@/server/auth/require-admin';
import { handler } from '@/server/http/handler';
import { listServicesQuerySchema } from '@/server/schemas/admin-services';

export async function GET(req: NextRequest) {
  return handler(async (request, ctx) => {
    await requireAdmin();
    const query = listServicesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await listAdminServices(query), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
