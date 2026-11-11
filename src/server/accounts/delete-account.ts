import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';
import { apiError } from '@/server/http/api-error';

/**
 * Vérifie le mot de passe via verify_user_password, puis anonymise.
 * Le solde et les commandes ne sont jamais touchés : anonymize_user ne les lit même pas.
 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const admin = createAdminClient();
  // Vérification côté base (fonction réservée au service_role) : aucune session ouverte, aucun mot de passe journalisé.
  const { data: valid, error: verifyError } = await admin.rpc('verify_user_password', {
    p_user: userId,
    p_password: password,
  });
  if (verifyError) throw new Error('verify_user_password failed');
  if (valid !== true) apiError('INVALID_CREDENTIALS');

  const { error: rpcError } = await admin.rpc('anonymize_user', { p_user: userId });
  if (rpcError) throw new Error(`anonymize_user: ${rpcError.message}`);

  // Ferme la session du navigateur ; si elle est déjà invalide, le compte est de toute façon anonymisé.
  try {
    await (await createSessionClient()).auth.signOut();
  } catch {
    // ignoré : voir ci-dessus
  }
}
