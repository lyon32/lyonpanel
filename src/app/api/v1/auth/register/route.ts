import { registerSchema } from '@/lib/schemas/auth';
import { buildRegisterDeps, openSession } from '@/server/auth/supabase-deps';
import { registerUser } from '@/server/auth/register';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, clientIp, parseBody } from '@/server/http/request';

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const input = await parseBody(req, registerSchema);
  const result = await registerUser(input, clientIp(req), buildRegisterDeps());
  // Session ouverte tout de suite : le client arrive connecté (cookies posés par le client SSR).
  await openSession(input.email, input.password);
  return Response.json(result, { status: 201, headers: { 'x-request-id': ctx.requestId } });
});
