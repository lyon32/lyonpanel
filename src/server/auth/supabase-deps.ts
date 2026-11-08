import 'server-only';
import { after } from 'next/server';
import { createAttemptStore, createLoginLimiter, createRateLimiter } from './rate-limit';
import {
  RECOVERY_MAX_AGE_SECONDS,
  clearRecoveryCookie,
  readRecoveryCookie,
  signRecoveryMarker,
  verifyRecoveryMarker,
  writeRecoveryCookie,
} from './recovery-cookie';
import { verifyTurnstile } from './turnstile';
import type { LoginDeps } from './login';
import type { PasswordResetDeps } from './password-reset';
import type { ResetPasswordDeps } from './password-reset-confirm';
import type { RegisterDeps } from './register';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient, createStatelessClient } from '@/server/db/supabase-server';
import { loadServerEnv } from '@/server/env';
import { apiError } from '@/server/http/api-error';

/** Le client SDK signale un mauvais identifiant par un statut 4xx ; le reste est une vraie panne. */
function isRefusal(error: { status?: number }): boolean {
  return error.status !== undefined && error.status >= 400 && error.status < 500;
}

/** Supabase signale un captcha refusé par le code « captcha_failed » (statut 400, comme un mauvais mot de passe). */
function isCaptchaFailure(error: { code?: string; message?: string }): boolean {
  return error.code === 'captcha_failed' || /captcha/i.test(error.message ?? '');
}

/** Ouvre la session (cookies) ; null si email ou mot de passe refusé. Supabase vérifie le jeton captcha. */
async function signInWithCookies(
  email: string,
  password: string,
  captchaToken: string,
): Promise<{ id: string } | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  });
  if (error) {
    if (isCaptchaFailure(error)) apiError('TURNSTILE_FAILED');
    if (isRefusal(error)) return null;
    throw error;
  }
  return { id: data.user.id };
}

export function buildRegisterDeps(): RegisterDeps {
  const admin = createAdminClient();
  return {
    rateLimiter: createRateLimiter({ store: createAttemptStore(admin) }),
    verifyTurnstile,
    async createAuthUser({ email, password, phone, metadata }) {
      // Le téléphone est unique dans profiles : on le vérifie avant, le trigger de la base échouerait sinon.
      const { data: taken, error: lookupError } = await admin
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (lookupError) throw new Error(`profiles: ${lookupError.message}`);
      if (taken) return { ok: false, reason: 'PHONE_TAKEN' };

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: metadata,
      });
      if (error) {
        if (error.code === 'email_exists') return { ok: false, reason: 'EMAIL_TAKEN' };
        if (error.code === 'phone_exists') return { ok: false, reason: 'PHONE_TAKEN' };
        throw error;
      }
      return { ok: true, userId: data.user.id };
    },
    async setDisplayCurrency(userId, currency) {
      const { error } = await admin
        .from('profiles')
        .update({ display_currency: currency })
        .eq('id', userId);
      if (error) throw new Error(`profiles: ${error.message}`);
    },
  };
}

/**
 * Ouvre la session juste après l'inscription. Le captcha de Supabase protège le mot de passe
 * (jeton à usage unique, déjà vérifié par notre siteverify) : on passe donc par un lien magique
 * généré côté serveur, que verifyOtp transforme en session sans captcha.
 */
export async function openSession(email: string): Promise<void> {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (error) throw error;
  const supabase = await createSessionClient();
  const { error: otpError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  });
  if (otpError) throw otpError;
}

export function buildLoginDeps(): LoginDeps {
  const admin = createAdminClient();
  return {
    limiter: createLoginLimiter({ store: createAttemptStore(admin) }),
    async findEmailByPhone(phone) {
      const { data, error } = await admin
        .from('profiles')
        .select('email')
        .eq('phone', phone)
        .maybeSingle();
      if (error) throw new Error(`profiles: ${error.message}`);
      return (data?.email as string | null | undefined) ?? null;
    },
    signIn: signInWithCookies,
  };
}

// Chemin réel de la page du lien (routing.ts) selon la langue du site.
const RESET_PATH = { fr: 'fr/nouveau-mot-de-passe', en: 'en/reset-password' } as const;

export function buildForgotDeps(locale: 'fr' | 'en' = 'fr'): PasswordResetDeps {
  return {
    rateLimiter: createRateLimiter({ store: createAttemptStore(createAdminClient()) }),
    sendReset(email, captchaToken) {
      const site = loadServerEnv().NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      const sending = createStatelessClient()
        .auth.resetPasswordForEmail(email, {
          redirectTo: `${site}/${RESET_PATH[locale]}`,
          captchaToken,
        })
        .then(({ error }) => {
          // Remonté ici, avalé par requestPasswordReset pour garder une réponse identique.
          if (error) throw error;
        });
      // La réponse part sans attendre l'envoi : after() garde la fonction en vie jusqu'à sa fin (Vercel).
      after(() => sending.catch(() => {}));
      return sending;
    },
  };
}

export function buildResetDeps(): ResetPasswordDeps {
  // Cookies de session limités à 15 min : la récupération ne doit pas devenir une session de 7 jours.
  const session = () => createSessionClient({ maxAgeSeconds: RECOVERY_MAX_AGE_SECONDS });
  // Le marqueur est signé (HMAC), lié à l'utilisateur et daté : un cookie fabriqué ou rejoué ne vaut rien.
  return {
    async getRecoverySession() {
      const value = await readRecoveryCookie();
      if (!value) return null;
      try {
        // getUser (jamais getSession) : le jeton est vérifié par Supabase.
        const { data, error } = await (await session()).auth.getUser();
        const user = data.user;
        if (error || !user?.email || !verifyRecoveryMarker(value, user.id)) return null;
        return { userId: user.id, email: user.email };
      } catch {
        return null;
      }
    },
    async exchangeRecoveryToken(token) {
      const { data, error } = await (
        await session()
      ).auth.verifyOtp({
        type: 'recovery',
        token_hash: token,
      });
      if (error) {
        if (isRefusal(error)) return null;
        throw error;
      }
      const email = data.user?.email;
      if (!data.user || !email || !data.session) return null;
      await writeRecoveryCookie(signRecoveryMarker(data.user.id));
      return { userId: data.user.id, email };
    },
    // Impossible de comparer un mot de passe sans signInWithPassword, que le captcha de Supabase
    // bloque : le contrôle est fait par Supabase dans updatePassword (erreur same_password).
    async isCurrentPassword() {
      return false;
    },
    async updatePassword(_userId, password) {
      const { error } = await (await session()).auth.updateUser({ password });
      if (error) {
        if (error.code === 'same_password') {
          apiError('VALIDATION_ERROR', { fields: { new_password: 'PASSWORD_SAME_AS_CURRENT' } });
        }
        throw error;
      }
    },
    // Toutes les sessions du compte tombent (le client qui porte la récupération peut le faire).
    async signOutAll() {
      const { error } = await (await session()).auth.signOut({ scope: 'global' });
      if (error) throw error;
    },
    async clearRecoverySession() {
      await clearRecoveryCookie();
      try {
        // Efface aussi les cookies de session, même si la fermeture globale a échoué.
        await (await session()).auth.signOut({ scope: 'local' });
      } catch {
        // Déjà fermée : rien de plus à faire.
      }
    },
  };
}
