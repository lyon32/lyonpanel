import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Mot de passe fictif, réservé aux utilisateurs créés par les fabriques de test.
export const TEST_PASSWORD = 'Test-only-password-123';

const authOptions = { auth: { persistSession: false, autoRefreshToken: false } } as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable manquante pour les tests base : ${name}`);
  return value;
}

/** Client « service » : contourne la RLS, pour préparer et vérifier les données. */
export function adminClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    authOptions,
  );
}

/** Client connecté en tant que client réel : sert à tester la RLS. */
export async function userClient(userId: string): Promise<SupabaseClient> {
  const { data: found, error: lookupError } = await adminClient().auth.admin.getUserById(userId);
  const email = found.user?.email;
  if (lookupError || !email) throw new Error(`Utilisateur de test introuvable : ${userId}`);

  const client = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    authOptions,
  );
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`Connexion de test impossible : ${error.message}`);
  return client;
}
