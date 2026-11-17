import type { NextRequest } from 'next/server';
import { getAdminSettings, updateAdminSettings } from '@/server/admin/settings';
import { requireAdmin } from '@/server/auth/require-admin';
import { requireAdminWrite } from '@/server/http/admin-write';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { patchSettingsSchema } from '@/server/schemas/admin-settings';

const headers = (requestId: string) => ({
  'x-request-id': requestId,
  'cache-control': 'private, no-store',
});

export async function GET(req: NextRequest) {
  return handler(async (_r, ctx) => {
    await requireAdmin();
    return Response.json(await getAdminSettings(), { headers: headers(ctx.requestId) });
  })(req);
}

export async function PATCH(req: NextRequest) {
  return handler(async (request, ctx) => {
    const admin = await requireAdminWrite(request);
    const patch = await parseBody(request, patchSettingsSchema);
    return Response.json(await updateAdminSettings(admin.id, patch), {
      headers: headers(ctx.requestId),
    });
  })(req);
}
