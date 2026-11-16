import { mfaCodeSchema } from '@/lib/schemas/admin-mfa';
import { verifyAdminCode } from '@/server/admin/mfa';
import { requireAdminUser } from '@/server/auth/require-admin';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';

// Code à 6 chiffres -> session aal2. La garde passe AVANT la lecture du corps : un inconnu reçoit 404 quoi qu'il envoie.
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const { id, supabase } = await requireAdminUser();
  const { code } = await parseBody(req, mfaCodeSchema);
  await verifyAdminCode(supabase, id, code);
  return { ok: true };
});
