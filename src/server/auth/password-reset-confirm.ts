import 'server-only';
import { isCommonPassword } from './password-policy';
import { apiError } from '@/server/http/api-error';
import type { ResetPasswordInput } from '@/lib/schemas/auth';

export type ResetPasswordDeps = {
  /** Récupération déjà ouverte (cookie httpOnly valide) : le lien n'est alors pas relu. */
  getRecoverySession(): Promise<{ userId: string; email: string } | null>;
  /** Échange le jeton du lien UNE fois (verifyOtp) et ouvre la récupération (cookie, 15 min). */
  exchangeRecoveryToken(token: string): Promise<{ userId: string; email: string } | null>;
  /** Vrai si ce mot de passe est déjà celui du compte. */
  isCurrentPassword(email: string, password: string): Promise<boolean>;
  updatePassword(userId: string, password: string): Promise<void>;
  /** Ferme toutes les sessions du compte (scope global). */
  signOutAll(): Promise<void>;
  /** Efface la récupération (cookie marqueur et cookies de session). */
  clearRecoverySession(): Promise<void>;
};

export async function resetPassword(
  input: ResetPasswordInput,
  deps: ResetPasswordDeps,
): Promise<{ ok: true }> {
  if (isCommonPassword(input.new_password)) {
    apiError('VALIDATION_ERROR', { fields: { new_password: 'PASSWORD_TOO_COMMON' } });
  }

  // Un refus ne doit pas brûler le lien : le jeton n'est échangé qu'une fois, puis la récupération
  // (cookie) sert aux essais suivants.
  const who = (await deps.getRecoverySession()) ?? (await deps.exchangeRecoveryToken(input.token));
  // Pas de code dédié dans API_SPEC §3 : un jeton refusé est une erreur de champ.
  if (!who) apiError('VALIDATION_ERROR', { fields: { token: 'TOKEN_INVALID' } });

  if (input.new_password.toLowerCase() === who.email.toLowerCase()) {
    apiError('VALIDATION_ERROR', { fields: { new_password: 'PASSWORD_TOO_WEAK' } });
  }
  if (await deps.isCurrentPassword(who.email, input.new_password)) {
    apiError('VALIDATION_ERROR', { fields: { new_password: 'PASSWORD_SAME_AS_CURRENT' } });
  }

  await deps.updatePassword(who.userId, input.new_password);
  // Le mot de passe est déjà changé : un échec ici ne doit pas faire répondre 500 au client.
  try {
    await deps.signOutAll();
  } catch (error) {
    // Le nom seulement : le message ou l'objet complet pourrait embarquer un jeton.
    console.error(
      `reset-password: fermeture des sessions échouée (${error instanceof Error ? error.name : 'erreur inconnue'})`,
    );
  }
  await deps.clearRecoverySession();
  return { ok: true };
}
