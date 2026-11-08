import { loginSchema } from '@/lib/schemas/auth';
import { login } from '@/server/auth/login';
import { buildLoginDeps } from '@/server/auth/supabase-deps';
import { verifyTurnstile } from '@/server/auth/turnstile';
import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, clientIp, parseBody } from '@/server/http/request';

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const input = await parseBody(req, loginSchema);
  const ip = clientIp(req);
  if (!(await verifyTurnstile(input.turnstile_token, ip))) apiError('TURNSTILE_FAILED');
  return login({ identifier: input.identifier, password: input.password, ip }, buildLoginDeps());
});
