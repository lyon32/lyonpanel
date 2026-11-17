import 'server-only';
import type { NextRequest } from 'next/server';
import { assertSameOrigin } from './request';
import { requireAdmin } from '@/server/auth/require-admin';

/**
 * Garde commune des routes admin qui écrivent : l'administrateur est vérifié AVANT l'origine.
 * Sinon un visiteur recevrait 403 (la route existe) au lieu de 404.
 */
export async function requireAdminWrite(req: NextRequest): Promise<{ id: string }> {
  const admin = await requireAdmin();
  assertSameOrigin(req);
  return admin;
}
