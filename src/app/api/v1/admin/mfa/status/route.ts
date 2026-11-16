import { getMfaStatus } from '@/server/admin/mfa';
import { requireAdminUser } from '@/server/auth/require-admin';
import { handler } from '@/server/http/handler';

// Dit à la page de connexion quoi afficher : saisie du code, ou enrôlement d'un appareil.
export const GET = handler(async () => {
  const { supabase } = await requireAdminUser();
  const [status, aal] = await Promise.all([
    getMfaStatus(supabase),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  return { ...status, aal2: aal.data?.currentLevel === 'aal2' };
});
