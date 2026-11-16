import { mfaConfirmSchema } from '@/lib/schemas/admin-mfa';
import { confirmDevice, enrollDevice } from '@/server/admin/mfa';
import { createAttemptStore, createRateLimiter } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { requireAdminUser } from '@/server/auth/require-admin';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';

// 10 appels par 15 min et par administrateur (POST et PUT partagent le compteur).
const consumeEnrollQuota = (adminId: string) =>
  createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
    scope: 'admin-mfa-enroll',
    key: adminId,
    max: 10,
    windowSeconds: 15 * 60,
  });

// Étape 1 : crée l'appareil (QR + clé). Supabase exige aal2 pour en ajouter un 2e.
export const POST = handler(async (req) => {
  assertSameOrigin(req);
  const { id, supabase } = await requireAdminUser();
  await consumeEnrollQuota(id);
  return enrollDevice(supabase);
});

// Étape 2 : confirme l'appareil avec un premier code à 6 chiffres.
export const PUT = handler(async (req) => {
  assertSameOrigin(req);
  const { id, supabase } = await requireAdminUser();
  await consumeEnrollQuota(id);
  const { factor_id: factorId, code } = await parseBody(req, mfaConfirmSchema);
  await confirmDevice(supabase, id, factorId, code);
  return { ok: true };
});
