import { createHash, timingSafeEqual } from 'node:crypto';
import { loadServerEnv } from '@/server/env';
import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';
import { armNextAddFailure } from '@/server/providers/mock-provider';

const sha256 = (text: string) => createHash('sha256').update(text).digest();

// Route réservée aux tests e2e : le prochain `add` du faux fournisseur échoue, une seule fois.
// Elle n'existe (404) qu'en mode mock hors production.
export const POST = handler(async (req) => {
  const env = loadServerEnv();
  if (
    env.PROVIDER_MODE !== 'mock' ||
    process.env.NODE_ENV === 'production' ||
    env.VERCEL_ENV === 'production'
  ) {
    apiError('NOT_FOUND');
  }
  const secret = env.SASPAY_WEBHOOK_SECRET;
  const given = req.headers.get('x-test-secret') ?? '';
  if (!secret || !given || !timingSafeEqual(sha256(given), sha256(secret))) apiError('FORBIDDEN');
  armNextAddFailure();
  return { armed: true };
});
