import { loginSchema } from '@/lib/schemas/auth';
import { login } from '@/server/auth/login';
import { buildLoginDeps } from '@/server/auth/supabase-deps';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, clientIp, parseBody } from '@/server/http/request';

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const input = await parseBody(req, loginSchema);
  const ip = clientIp(req);
  // Le jeton captcha est vérifié par Supabase lui-même (usage unique : pas de siteverify en plus).
  return login(
    {
      identifier: input.identifier,
      password: input.password,
      ip,
      turnstile_token: input.turnstile_token,
    },
    buildLoginDeps(),
  );
});
