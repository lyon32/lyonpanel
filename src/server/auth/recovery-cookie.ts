import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { hashSecret } from './rate-limit';

export const RECOVERY_COOKIE = 'lp_recovery';
export const RECOVERY_MAX_AGE_SECONDS = 15 * 60;

/** Marqueur « une récupération est en cours » : la vraie session est dans les cookies Supabase. */
export async function writeRecoveryCookie(value: string): Promise<void> {
  (await cookies()).set(RECOVERY_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: RECOVERY_MAX_AGE_SECONDS,
  });
}

export async function readRecoveryCookie(): Promise<string | null> {
  const value = (await cookies()).get(RECOVERY_COOKIE)?.value;
  return value ? value : null;
}

export async function clearRecoveryCookie(): Promise<void> {
  (await cookies()).delete(RECOVERY_COOKIE);
}

const sign = (userId: string, exp: number) =>
  createHmac('sha256', hashSecret()).update(`recovery-marker:${userId}:${exp}`).digest('hex');

/** `exp.signature` : l'expiration est signée, donc un cookie rejoué ou prolongé ne vaut rien. */
export function signRecoveryMarker(userId: string, now: number = Date.now()): string {
  const exp = Math.floor(now / 1000) + RECOVERY_MAX_AGE_SECONDS;
  return `${exp}.${sign(userId, exp)}`;
}

/** Faux (jamais d'exception) pour toute valeur mal formée, expirée ou signée pour un autre compte. */
export function verifyRecoveryMarker(
  value: string,
  userId: string,
  now: number = Date.now(),
): boolean {
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [expText, signature] = parts as [string, string];
  if (!/^\d{1,15}$/.test(expText) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const exp = Number(expText);
  if (now / 1000 >= exp) return false;
  const expected = Buffer.from(sign(userId, exp), 'hex');
  const given = Buffer.from(signature, 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}
