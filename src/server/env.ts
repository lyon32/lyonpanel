import 'server-only';
import { z } from 'zod';

// Une variable vide dans .env.local (ex. `PROVIDER_API_KEY=`) équivaut à « absente ».
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: optionalString,
    NEXT_PUBLIC_SITE_URL: optionalString,
    ADMIN_PATH: optionalString,
    NEXT_PUBLIC_SUPABASE_URL: optionalString,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    PROVIDER_API_URL: optionalString,
    PROVIDER_API_KEY: optionalString,
    PROVIDER_MODE: z.enum(['mock', 'live']).optional(),
    SASPAY_API_URL: optionalString,
    SASPAY_API_KEY: optionalString,
    SASPAY_WEBHOOK_SECRET: optionalString,
    SASPAY_MODE: z.enum(['test', 'live']).default('test'),
    TELEGRAM_BOT_TOKEN: optionalString,
    TELEGRAM_CHAT_ID: optionalString,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
    TURNSTILE_SECRET_KEY: optionalString,
    CRON_SECRET: optionalString,
    TEST_ROUTE_SECRET: optionalString,
    AUTH_HASH_SECRET: optionalString,
    NEXT_PUBLIC_SENTRY_DSN: optionalString,
    SENTRY_AUTH_TOKEN: optionalString,
    SENTRY_ORG: optionalString,
    SENTRY_PROJECT: optionalString,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: optionalString,
    VERCEL_ENV: optionalString,
  })
  .superRefine((env, ctx) => {
    // Pas de faux fournisseur par oubli en production : le mode doit être choisi explicitement.
    const isProduction = env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';
    if (isProduction && env.PROVIDER_MODE === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['PROVIDER_MODE'],
        message: 'PROVIDER_MODE doit être défini explicitement en production (mock ou live)',
      });
    }
    // Le vrai fournisseur coûte de l'argent : interdit hors production.
    if (env.PROVIDER_MODE === 'live' && env.VERCEL_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['PROVIDER_MODE'],
        message: 'PROVIDER_MODE=live est réservé à la production',
      });
    }
    // Les vrais paiements SasPay sont interdits hors production.
    if (env.SASPAY_MODE === 'live' && env.VERCEL_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['SASPAY_MODE'],
        message: 'SASPAY_MODE=live est réservé à la production',
      });
    }
    // Une clé de test avec le mode live (ou l'inverse) fausserait de vrais paiements.
    const key = env.SASPAY_API_KEY?.toLowerCase();
    if (key) {
      const expected = env.SASPAY_MODE === 'live' ? 'sk_live_' : 'sk_test_';
      if (!key.startsWith(expected)) {
        ctx.addIssue({
          code: 'custom',
          path: ['SASPAY_API_KEY'],
          message: `La clé SasPay doit commencer par ${expected} avec SASPAY_MODE=${env.SASPAY_MODE}`,
        });
      }
    }
  });

export type ServerEnv = Omit<z.infer<typeof envSchema>, 'PROVIDER_MODE'> & {
  PROVIDER_MODE: 'mock' | 'live';
};

export class MissingEnvError extends Error {
  constructor(name: string) {
    super(`Variable d'environnement manquante : ${name}`);
    this.name = 'MissingEnvError';
  }
}

// Insensible à la casse : un secret mal nommé ne doit jamais partir au navigateur.
const SECRET_NAME =
  /SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE|PROVIDER_|SASPAY_|API_KEY|CRON|TELEGRAM/i;

export function loadServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  // Tout ce qui est NEXT_PUBLIC_ part dans le navigateur : aucun secret ne doit y être.
  for (const name of Object.keys(source)) {
    if (name.startsWith('NEXT_PUBLIC_') && SECRET_NAME.test(name)) {
      throw new Error(`Secret exposé au navigateur : ${name}`);
    }
  }
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')} : ${issue.message}`)
      .join(' ; ');
    throw new Error(`Variables d'environnement invalides — ${details}`);
  }
  // Hors production, le faux fournisseur est le défaut.
  return { ...result.data, PROVIDER_MODE: result.data.PROVIDER_MODE ?? 'mock' };
}

export function requireEnv<K extends keyof ServerEnv>(
  env: ServerEnv,
  key: K,
): NonNullable<ServerEnv[K]> {
  const value = env[key];
  if (value === undefined || value === null) throw new MissingEnvError(key);
  return value as NonNullable<ServerEnv[K]>;
}
