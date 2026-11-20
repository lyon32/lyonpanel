import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { previewServiceMultiplier } from '@/server/admin/services';
import { requireAdminWrite } from '@/server/http/admin-write';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { previewServiceSchema } from '@/server/schemas/admin-services';

type Params = { params: Promise<{ id: string }> };
const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    await requireAdminWrite(request);
    const serviceId = idSchema.parse(id);
    const { multiplier } = await parseBody(request, previewServiceSchema);
    return Response.json(await previewServiceMultiplier(serviceId, multiplier), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
