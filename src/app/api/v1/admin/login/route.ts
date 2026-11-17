import { z } from 'zod';
import { loginSchema } from '@/lib/schemas/auth';
import { adminLogin } from '@/server/admin/login';
import { buildAdminLoginDeps } from '@/server/admin/login-deps';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, clientIp, parseBody } from '@/server/http/request';

const adminLoginSchema = loginSchema.extend({ admin_path: z.string().max(128) });

export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const input = await parseBody(req, adminLoginSchema);
  return adminLogin({ ...input, ip: clientIp(req) }, buildAdminLoginDeps());
});
