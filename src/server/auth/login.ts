import 'server-only';
import type { LoginLimiter } from './rate-limit';
import { apiError } from '@/server/http/api-error';

export type LoginDeps = {
  limiter: LoginLimiter;
  /** Cherche l'email du compte par téléphone (profiles.phone) ; null si inconnu. */
  findEmailByPhone(phone: string): Promise<string | null>;
  /** Vérifie email + mot de passe ; null si refusé. Supabase vérifie lui-même le jeton captcha (TURNSTILE_FAILED). */
  signIn(email: string, password: string, captchaToken: string): Promise<{ id: string } | null>;
};

// Email qui n'existe pas : sert à faire le même travail pour un compte inconnu (temps de réponse égal).
const DECOY_EMAIL = 'inconnu@invalid.lyonpanel.test';

export async function login(
  input: { identifier: string; password: string; ip: string; turnstile_token: string },
  deps: LoginDeps,
): Promise<{ user: { id: string } }> {
  const { identifier, password, ip, turnstile_token: captchaToken } = input;
  // Avant tout (aucune tentative enregistrée) : sans jeton, Supabase refuserait de toute façon.
  if (!captchaToken.trim()) apiError('TURNSTILE_FAILED');
  // Enregistré avant toute vérification : une rafale parallèle ne peut pas dépasser le plafond.
  const attempt = await deps.limiter.begin(identifier, ip);

  const email = identifier.includes('@') ? identifier : await deps.findEmailByPhone(identifier);
  // Compte inconnu : on lance quand même une vérification pour ne rien révéler par le temps de réponse.
  const user = await deps.signIn(email ?? DECOY_EMAIL, password, captchaToken);

  if (!email || !user) {
    // Même erreur pour mauvais mot de passe, email inconnu et téléphone inconnu.
    apiError('INVALID_CREDENTIALS');
  }
  await attempt.succeed();
  return { user: { id: user.id } };
}
