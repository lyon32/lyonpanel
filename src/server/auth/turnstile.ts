import 'server-only';
import { apiError } from '@/server/http/api-error';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Vérifie le jeton auprès de Cloudflare. Au moindre doute (réseau, clé absente) : refus. */
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!token || !secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  try {
    const res = await fetch(SITEVERIFY, { method: 'POST', body });
    if (!res.ok) return false;
    const data: unknown = await res.json();
    return (
      typeof data === 'object' && data !== null && (data as { success?: unknown }).success === true
    );
  } catch {
    return false;
  }
}

export async function requireTurnstile(token: string, ip?: string): Promise<void> {
  if (!(await verifyTurnstile(token, ip))) apiError('TURNSTILE_FAILED');
}
