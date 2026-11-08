import { resetPasswordSchema } from '@/lib/schemas/auth';
import { resetPassword } from '@/server/auth/password-reset-confirm';
import { buildResetDeps } from '@/server/auth/supabase-deps';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const input = await parseBody(req, resetPasswordSchema);
  return resetPassword(input, buildResetDeps());
});
