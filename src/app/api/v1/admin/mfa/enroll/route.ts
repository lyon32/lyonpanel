import { mfaConfirmSchema } from '@/lib/schemas/admin-mfa';
import { confirmDevice, enrollDevice } from '@/server/admin/mfa';
import { requireAdminUser } from '@/server/auth/require-admin';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';

// Étape 1 : crée l'appareil (QR + clé). Supabase exige aal2 pour en ajouter un 2e.
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const { supabase } = await requireAdminUser();
  return enrollDevice(supabase);
});

// Étape 2 : confirme l'appareil avec un premier code à 6 chiffres.
export const PUT = handler(async (req) => {
  assertSameOrigin(req);
  const { id, supabase } = await requireAdminUser();
  const { factor_id: factorId, code } = await parseBody(req, mfaConfirmSchema);
  await confirmDevice(supabase, id, factorId, code);
  return { ok: true };
});
