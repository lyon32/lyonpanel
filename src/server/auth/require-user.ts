import 'server-only';
import { redirect } from 'next/navigation';
import { createSessionClient } from '@/server/db/supabase-server';

// Chemins réels des pages de connexion (routing.ts).
const LOGIN_PATH = { fr: '/fr/connexion', en: '/en/login' } as const;

/**
 * Garde de la zone privée. getUser() interroge Supabase pour vérifier le jeton ;
 * getSession() ne ferait que lire le cookie, que n'importe qui peut fabriquer.
 */
export async function requireUser(
  locale: 'fr' | 'en',
): Promise<{ id: string; email: string | undefined }> {
  let user: { id: string; email?: string } | null = null;
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error) user = data.user;
  } catch {
    // Cookie de session révoquée ou Supabase injoignable : même issue qu'un visiteur déconnecté.
  }
  // Hors du try : redirect() lève une exception que le catch avalerait.
  if (!user) redirect(LOGIN_PATH[locale]);
  return { id: user.id, email: user.email };
}
