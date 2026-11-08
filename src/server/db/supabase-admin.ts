import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { loadServerEnv, requireEnv } from '@/server/env';

/** Client « service » : contourne la RLS. Serveur uniquement, jamais exposé au navigateur. */
export function createAdminClient() {
  const env = loadServerEnv();
  return createClient(
    requireEnv(env, 'NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
