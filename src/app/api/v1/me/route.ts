import { deleteAccount } from '@/server/accounts/delete-account';
import { getMe, updateMe } from '@/server/accounts/profile';
import { createAttemptStore, createRateLimiter } from '@/server/auth/rate-limit';
import { requireApiUser } from '@/server/auth/require-api-user';
import { createAdminClient } from '@/server/db/supabase-admin';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { deleteMeSchema, patchMeSchema } from '@/server/schemas/account';

const NO_STORE = 'private, no-store';

export const GET = handler(async (_req, ctx) => {
  const user = await requireApiUser();
  return Response.json(await getMe(user.id), {
    headers: { 'x-request-id': ctx.requestId, 'cache-control': NO_STORE },
  });
});

export const PATCH = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const input = await parseBody(req, patchMeSchema);
  // Le numéro sert à se connecter : on plafonne ses changements (5 par heure), pas les autres réglages.
  if (input.phone !== undefined) {
    await createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
      scope: 'phone-change',
      key: user.id,
      max: 5,
      windowSeconds: 60 * 60,
    });
  }
  const me = await updateMe(user.id, input);
  return Response.json(
    { user: me },
    { headers: { 'x-request-id': ctx.requestId, 'cache-control': NO_STORE } },
  );
});

export const DELETE = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  // Pas de Turnstile ici : le plafond par client empêche de deviner le mot de passe.
  await createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
    scope: 'account-delete',
    key: user.id,
    max: 5,
    windowSeconds: 15 * 60,
  });
  const { password } = await parseBody(req, deleteMeSchema);
  await deleteAccount(user.id, password);
  return new Response(null, { status: 204, headers: { 'x-request-id': ctx.requestId } });
});
