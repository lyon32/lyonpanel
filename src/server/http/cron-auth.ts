import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { apiError } from './api-error';
import { loadServerEnv } from '@/server/env';

const sha256 = (text: string) => createHash('sha256').update(text).digest();

/**
 * Les tâches cron exigent `Authorization: Bearer <CRON_SECRET>` (API_SPEC §2).
 * Sans secret configuré, tout est refusé. Comparaison en temps constant, sur des empreintes
 * de même longueur (timingSafeEqual refuse les longueurs différentes).
 */
export function assertCronSecret(req: NextRequest): void {
  const secret = loadServerEnv().CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!secret || !token || !timingSafeEqual(sha256(token), sha256(secret))) {
    apiError('UNAUTHENTICATED');
  }
}
