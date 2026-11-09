import 'server-only';
import { isCommonPassword } from './password-policy';
import type { RateLimiter } from './rate-limit';
import { apiError } from '@/server/http/api-error';
import type { RegisterInput } from '@/lib/schemas/auth';

export type RegisterDeps = {
  rateLimiter: RateLimiter;
  verifyTurnstile(token: string, ip?: string): Promise<boolean>;
  createAuthUser(args: {
    email: string;
    password: string;
    phone: string;
    metadata: { country: string; language: string; referral?: string };
  }): Promise<{ ok: true; userId: string } | { ok: false; reason: 'EMAIL_TAKEN' | 'PHONE_TAKEN' }>;
  setDisplayCurrency(userId: string, currency: string): Promise<void>;
};

export async function registerUser(input: RegisterInput, ip: string, deps: RegisterDeps) {
  // Avant Turnstile : un robot qui dépasse le plafond ne coûte plus d'appel à Cloudflare.
  if (ip !== 'unknown') {
    await deps.rateLimiter.consume({ scope: 'register', key: ip, max: 10, windowSeconds: 3600 });
  }
  if (!(await deps.verifyTurnstile(input.turnstile_token, ip))) apiError('TURNSTILE_FAILED');

  if (isCommonPassword(input.password)) {
    apiError('VALIDATION_ERROR', { fields: { password: 'PASSWORD_TOO_COMMON' } });
  }

  const created = await deps.createAuthUser({
    email: input.email,
    password: input.password,
    phone: input.phone,
    metadata: {
      country: input.country,
      language: input.language,
      ...(input.referral_code ? { referral: input.referral_code } : {}),
    },
  });
  if (!created.ok) {
    const field = created.reason === 'EMAIL_TAKEN' ? 'email' : 'phone';
    apiError(created.reason, { fields: { [field]: created.reason } });
  }

  // Le trigger de la base crée le profil ; la devise d'affichage se pose juste après.
  await deps.setDisplayCurrency(created.userId, input.display_currency);

  return {
    user: {
      id: created.userId,
      email: input.email,
      phone: input.phone,
      country: input.country,
      display_currency: input.display_currency,
      language: input.language,
    },
  };
}
