import { requireAdmin } from '@/server/auth/require-admin';
import { listAudit } from '@/server/admin/audit';
import { handler } from '@/server/http/handler';
import { listAuditQuerySchema } from '@/server/schemas/admin-audit';

// Lecture seule : aucune autre méthode n'est exportée.
export const GET = handler(async (req, ctx) => {
  await requireAdmin();
  const s = req.nextUrl.searchParams;
  const query = listAuditQuerySchema.parse({
    action: s.get('action') ?? undefined,
    limit: s.get('limit') ?? undefined,
    cursor: s.get('cursor') ?? undefined,
  });
  return Response.json(await listAudit(query), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
