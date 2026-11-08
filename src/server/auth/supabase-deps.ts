import 'server-only';
import { after } from 'next/server';
import { createAttemptStore, createLoginLimiter, createRateLimiter } from './rate-limit';
import { verifyTurnstile } from './turnstile';
import type { LoginDeps } from './login';
import type { PasswordResetDeps } from './password-reset';
import type { ResetPasswordDeps } from './password-reset-confirm';
import type { RegisterDeps } from './register';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient, createStatelessClient } from '@/server/db/supabase-server';
import { loadServerEnv } from '@/server/env';

/** Le client SDK signale un mauvais identifiant par un statut 4xx ; le reste est une vraie panne. */
function isRefusal(error: { status?: number }): boolean {
  return error.status !== undefined && error.status >= 400 && error.status < 500;
}

/** Ouvre la session (cookies) ; null si email ou mot de passe refusé. */
async function signInWithCookies(email: string, password: string): Promise<{ id: string } | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
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

export const openSession = signInWithCookies;

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
    verifyTurnstile,
    sendReset(email) {
      const site = loadServerEnv().NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      const sending = createStatelessClient()
        .auth.resetPasswordForEmail(email, { redirectTo: `${site}/${RESET_PATH[locale]}` })
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
  const admin = createAdminClient();
  type Recovery = { userId: string; email: string; accessToken: string } | null;
  // Supabase ne sait pas lire un jeton sans le consommer : la première lecture l'échange
  // et la seconde réutilise ce résultat. Conséquence : un mot de passe refusé après l'échange
  // brûle le lien (voir ResetPasswordDeps).
  let exchanged: Promise<Recovery> | undefined;
  // Client portant la session de récupération : seul lui peut la fermer pour tout le compte.
  let recoveryClient: ReturnType<typeof createStatelessClient> | undefined;
  const exchange = (token: string): Promise<Recovery> => {
    exchanged ??= (async () => {
      // Client sans mémoire disque : la session de récupération ne doit pas devenir un cookie.
      const client = createStatelessClient();
      const { data, error } = await client.auth.verifyOtp({
        type: 'recovery',
        token_hash: token,
      });
      if (error) {
        if (isRefusal(error)) return null;
        throw error;
      }
      const email = data.user?.email;
      if (!data.user || !email || !data.session) return null;
      recoveryClient = client;
      return { userId: data.user.id, email, accessToken: data.session.access_token };
    })();
    return exchanged;
  };
  return {
    async peekRecoveryToken(token) {
      const who = await exchange(token);
      return who ? { userId: who.userId, email: who.email } : null;
    },
    verifyRecoveryToken: exchange,
    async isCurrentPassword(email, password) {
      const { error } = await createStatelessClient().auth.signInWithPassword({ email, password });
      if (!error) return true;
      if (isRefusal(error)) return false;
      throw error;
    },
    async updatePassword(userId, password) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
    },
    // Après une réinitialisation, plus aucune session ancienne ne doit rester. Le signOut « admin »
    // par jeton échoue (session déjà invalidée par le changement de mot de passe) ; le client qui
    // a fait verifyOtp, lui, ferme bien toutes les sessions (vérifié sur Supabase local).
    async signOutAll(accessToken) {
      const { error } = recoveryClient
        ? await recoveryClient.auth.signOut({ scope: 'global' })
        : await admin.auth.admin.signOut(accessToken, 'global');
      if (error) throw error;
    },
  };
}
