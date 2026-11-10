import { createHash, timingSafeEqual } from 'node:crypto';
import { apiError } from '@/server/http/api-error';

const sha256 = (text: string) => createHash('sha256').update(text).digest();

// Garde commune des routes de test : 404 hors faux fournisseur / en production,
// 403 sans le bon TEST_ROUTE_SECRET (lu à chaque appel, comparaison à temps constant).
export function assertTestRouteAllowed(req: Request): void {
  // Lecture directe de process.env : le mode « live » hors production rend loadServerEnv() invalide,
  // et on veut un 404 propre, pas une erreur 500.
  const mode = process.env.PROVIDER_MODE ?? 'mock';
  if (
    mode !== 'mock' ||
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'
  ) {
    apiError('NOT_FOUND');
  }
  const secret = process.env.TEST_ROUTE_SECRET;
  const given = req.headers.get('x-test-secret') ?? '';
  if (!secret || !given || !timingSafeEqual(sha256(given), sha256(secret))) apiError('FORBIDDEN');
}
