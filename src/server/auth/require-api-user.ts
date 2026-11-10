import 'server-only';
import { createSessionClient } from '@/server/db/supabase-server';
import { apiError } from '@/server/http/api-error';

/**
 * Garde des routes API privées : renvoie le client connecté ou lève UNAUTHENTICATED (401).
 * getUser() interroge Supabase pour vérifier le jeton (getSession() ne lirait que le cookie).
 */
export async function requireApiUser(): Promise<{ id: string }> {
  let userId: string | null = null;
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error) userId = data.user?.id ?? null;
  } catch {
    // Cookie invalide ou Supabase injoignable : même issue qu'un visiteur déconnecté.
  }
  if (!userId) apiError('UNAUTHENTICATED');
  return { id: userId };
}
