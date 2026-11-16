import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/auth/require-admin';
import { getUserDetail, updateUser } from '@/server/admin/users';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { patchUserSchema } from '@/server/schemas/admin-users';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return handler(async (_r, ctx) => {
    await requireAdmin();
    return Response.json(await getUserDetail(id), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const patch = await parseBody(request, patchUserSchema);
    return Response.json(await updateUser(admin.id, id, patch), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
