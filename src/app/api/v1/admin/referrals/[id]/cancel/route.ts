import type { NextRequest } from 'next/server';
import { cancelReferralBonus } from '@/server/admin/users';
import { requireAdminWrite } from '@/server/http/admin-write';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { cancelBonusSchema } from '@/server/schemas/admin-users';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    const admin = await requireAdminWrite(request);
    const { reason } = await parseBody(request, cancelBonusSchema);
    return Response.json(await cancelReferralBonus(admin.id, id, reason), {
      headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
    });
  })(req);
}
