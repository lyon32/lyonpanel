import 'server-only';
import type { AdminLoginDeps } from './login';
import { buildLoginDeps } from '@/server/auth/supabase-deps';
import { createAttemptStore } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';

/** Même connexion que celle des clients (limiteur, téléphone, Supabase) plus le contrôle « administrateur actif ». */
export function buildAdminLoginDeps(): AdminLoginDeps {
  const admin = createAdminClient();
  return {
    ...buildLoginDeps(),
    async isAdmin(userId) {
      const { data, error } = await admin
        .from('profiles')
        .select('is_admin, status')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(`profiles: ${error.message}`);
      return data?.is_admin === true && data.status === 'active';
    },
    async signOut() {
      await (await createSessionClient()).auth.signOut({ scope: 'local' });
    },
    store: createAttemptStore(admin),
  };
}
