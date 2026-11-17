import { requireAdmin } from '@/server/auth/require-admin';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { purgeOrphansSchema } from '@/server/schemas/storage';
import { purgeOrphanAttachments } from '@/server/tickets/purge-orphans';

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  // Garde d'abord : un visiteur ne doit rien apprendre sur la forme attendue du corps.
  const admin = await requireAdmin();
  // Le délai de grâce n'est pas réglable par la requête : seuls les tests le changent, via le service.
  const input = await parseBody(req, purgeOrphansSchema.omit({ minAgeMinutes: true }));
  return Response.json(await purgeOrphanAttachments(input, admin.id), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
