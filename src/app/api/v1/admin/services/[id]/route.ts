import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { updateAdminService } from '@/server/admin/services';
import { requireAdminWrite } from '@/server/http/admin-write';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { patchServiceSchema } from '@/server/schemas/admin-services';

type Params = { params: Promise<{ id: string }> };
const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    const admin = await requireAdminWrite(request);
    const serviceId = idSchema.parse(id);
    const patch = await parseBody(request, patchServiceSchema);
    return Response.json(await updateAdminService(admin.id, serviceId, patch), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
