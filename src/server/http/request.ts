import 'server-only';
import type { NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { apiError } from './api-error';

/** CSRF (API_SPEC §2) : un POST venant d'un autre site est refusé. */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  if (!origin || origin !== req.nextUrl.origin) apiError('FORBIDDEN', { reason: 'bad_origin' });
}

/**
 * Adresse du client : cf-connecting-ip (Cloudflare), sinon x-real-ip (Vercel).
 * x-forwarded-for est ignoré : le client peut y écrire ce qu'il veut.
 */
export function clientIp(req: NextRequest): string {
  const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip');
  return ip?.trim() || 'unknown';
}

/** Lit le JSON puis le valide avec Zod ; un JSON cassé donne VALIDATION_ERROR, pas 500. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    apiError('VALIDATION_ERROR', { fields: { _: 'INVALID_JSON' } });
  }
  return schema.parse(raw);
}
