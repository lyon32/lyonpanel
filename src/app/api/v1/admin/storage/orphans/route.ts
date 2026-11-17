import { requireAdmin } from '@/server/auth/require-admin';
import { handler } from '@/server/http/handler';
import { listOrphanAttachments } from '@/server/tickets/purge-orphans';

export const GET = handler(async (_req, ctx) => {
  await requireAdmin();
  return Response.json(
    { items: await listOrphanAttachments() },
    { headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' } },
  );
});
