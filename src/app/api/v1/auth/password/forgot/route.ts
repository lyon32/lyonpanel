import { forgotPasswordSchema } from '@/lib/schemas/auth';
import { requestPasswordReset } from '@/server/auth/password-reset';
import { buildForgotDeps } from '@/server/auth/supabase-deps';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, clientIp, parseBody } from '@/server/http/request';

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const input = await parseBody(req, forgotPasswordSchema);
  return requestPasswordReset(input, clientIp(req), buildForgotDeps(ctx.locale));
});
