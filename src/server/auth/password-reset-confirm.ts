import 'server-only';
import { isCommonPassword } from './password-policy';
import { apiError } from '@/server/http/api-error';
import type { ResetPasswordInput } from '@/lib/schemas/auth';

export type ResetPasswordDeps = {
  /**
   * Identité liée au jeton ; null si invalide ou expiré. Attention : avec Supabase, lire le jeton
   * (verifyOtp) le CONSOMME. Un mot de passe refusé après cet échange brûle donc le lien et le
   * client doit en redemander un. Un vrai « peek » sans consommation demanderait une fonction SQL
   * dédiée (migration), signalée au propriétaire.
   */
  peekRecoveryToken(token: string): Promise<{ userId: string; email: string } | null>;
  /** Consomme le jeton (usage unique, 1 h) ; null s'il l'a été entre-temps. */
  verifyRecoveryToken(
    token: string,
  ): Promise<{ userId: string; email: string; accessToken: string } | null>;
  /** Vrai si ce mot de passe est déjà celui du compte. */
  isCurrentPassword(email: string, password: string): Promise<boolean>;
  updatePassword(userId: string, password: string): Promise<void>;
  /** Ferme toutes les sessions du compte (scope global). */
  signOutAll(accessToken: string): Promise<void>;
};

export async function resetPassword(
  input: ResetPasswordInput,
  deps: ResetPasswordDeps,
): Promise<{ ok: true }> {
  if (isCommonPassword(input.new_password)) {
    apiError('VALIDATION_ERROR', { fields: { new_password: 'PASSWORD_TOO_COMMON' } });
  }

  // Contrôles d'abord sans consommer le lien : un mot de passe refusé laisse le lien utilisable.
  const who = await deps.peekRecoveryToken(input.token);
  // Pas de code dédié dans API_SPEC §3 : un jeton refusé est une erreur de champ.
  if (!who) apiError('VALIDATION_ERROR', { fields: { token: 'TOKEN_INVALID' } });

  if (input.new_password.toLowerCase() === who.email.toLowerCase()) {
    apiError('VALIDATION_ERROR', { fields: { new_password: 'PASSWORD_TOO_WEAK' } });
  }
  if (await deps.isCurrentPassword(who.email, input.new_password)) {
    apiError('VALIDATION_ERROR', { fields: { new_password: 'PASSWORD_SAME_AS_CURRENT' } });
  }

  // Consommation unique, seulement quand tout est validé.
  const consumed = await deps.verifyRecoveryToken(input.token);
  if (!consumed) apiError('VALIDATION_ERROR', { fields: { token: 'TOKEN_INVALID' } });

  await deps.updatePassword(consumed.userId, input.new_password);
  // Si le mot de passe a fui, toutes les sessions ouvertes doivent tomber.
  // Le mot de passe est déjà changé : un échec ici ne doit pas faire répondre 500 au client.
  try {
    await deps.signOutAll(consumed.accessToken);
  } catch (error) {
    // Le nom seulement : le message ou l'objet complet pourrait embarquer un jeton.
    console.error(
      `reset-password: fermeture des sessions échouée (${error instanceof Error ? error.name : 'erreur inconnue'})`,
    );
  }
  return { ok: true };
}
