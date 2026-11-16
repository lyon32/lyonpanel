import 'server-only';
import { alertIfThreshold } from './mfa';
import { isAdminSegment } from '@/server/auth/admin-path';
import type { LoginDeps } from '@/server/auth/login';
import { hashIdentifier, type AttemptStore } from '@/server/auth/rate-limit';
import { apiError } from '@/server/http/api-error';

export type AdminLoginDeps = LoginDeps & {
  isAdmin(userId: string): Promise<boolean>;
  /** Ferme la session ouverte par signIn (compte non administrateur). */
  signOut(): Promise<void>;
  store: AttemptStore;
};

// Email qui n'existe pas : même travail pour un compte inconnu (temps de réponse égal).
const DECOY_EMAIL = 'inconnu@invalid.lyonpanel.test';
// Clé fixe : TOUS les échecs de cette route, quel que soit l'identifiant, pour l'alerte « tous les 5 ».
const FAILURES_KEY = 'admin-login:failures';

/**
 * Connexion dédiée de l'administrateur. L'échec est compté AVANT le limiteur par identifiant :
 * sinon le limiteur (blocage dès le 4e essai) empêcherait d'atteindre le 5e échec et l'alerte.
 */
export async function adminLogin(
  input: {
    identifier: string;
    password: string;
    ip: string;
    turnstile_token: string;
    admin_path: string | undefined;
  },
  deps: AdminLoginDeps,
): Promise<{ user: { id: string } }> {
  // Mauvaise adresse secrète : 404 avant tout, rien d'enregistré.
  if (!isAdminSegment(input.admin_path, process.env.ADMIN_PATH)) apiError('NOT_FOUND');
  if (!input.turnstile_token.trim()) apiError('TURNSTILE_FAILED');

  const hash = hashIdentifier(FAILURES_KEY);
  const { id } = await deps.store.record({ identifierHash: hash, ipHash: hash, success: false });
  try {
    const user = await verify(input, deps);
    // Une réussite sort cette tentative du compte des échecs.
    await deps.store.markSuccess(id);
    return { user };
  } catch (error) {
    // Le contenu de l'alerte (nombre d'échecs seulement) vient de alertIfThreshold ; une panne Telegram ne masque pas l'erreur.
    await alertIfThreshold(deps.store, hash).catch(() => {});
    throw error;
  }
}

async function verify(
  input: { identifier: string; password: string; ip: string; turnstile_token: string },
  deps: AdminLoginDeps,
): Promise<{ id: string }> {
  const attempt = await deps.limiter.begin(input.identifier, input.ip);
  const email = input.identifier.includes('@')
    ? input.identifier
    : await deps.findEmailByPhone(input.identifier);
  const user = await deps.signIn(email ?? DECOY_EMAIL, input.password, input.turnstile_token);
  if (!email || !user) apiError('INVALID_CREDENTIALS');
  if (!(await deps.isAdmin(user.id))) {
    // Un client ne reste jamais connecté par cette route ; réponse identique à un mauvais mot de passe.
    await deps.signOut();
    apiError('INVALID_CREDENTIALS');
  }
  await attempt.succeed();
  return user;
}
