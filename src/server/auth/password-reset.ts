import 'server-only';
import type { RateLimiter } from './rate-limit';
import { apiError } from '@/server/http/api-error';

export type PasswordResetDeps = {
  rateLimiter: RateLimiter;
  /** Supabase vérifie lui-même le jeton captcha. */
  sendReset(email: string, captchaToken: string): Promise<void>;
};

/** Répond toujours { ok: true } : on ne révèle pas si l'email existe. */
export async function requestPasswordReset(
  input: { email: string; turnstile_token: string },
  ip: string,
  deps: PasswordResetDeps,
): Promise<{ ok: true }> {
  if (ip !== 'unknown') {
    await deps.rateLimiter.consume({ scope: 'forgot-ip', key: ip, max: 5, windowSeconds: 3600 });
  }
  if (!input.turnstile_token.trim()) apiError('TURNSTILE_FAILED');
  // Après Turnstile : un robot ne peut pas épuiser le quota d'un email qui n'est pas le sien.
  await deps.rateLimiter.consume({
    scope: 'forgot-email',
    key: input.email,
    max: 5,
    windowSeconds: 3600,
  });
  // Non attendu : le délai d'envoi ne doit pas révéler si l'email existe. Échec ignoré pour la même raison.
  void deps.sendReset(input.email, input.turnstile_token).catch(() => {});
  return { ok: true };
}
