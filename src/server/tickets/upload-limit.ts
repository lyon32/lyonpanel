import 'server-only';
import { createAttemptStore, createRateLimiter } from '@/server/auth/rate-limit';
import { createAdminClient } from '@/server/db/supabase-admin';
import { ApiError, apiError } from '@/server/http/api-error';

const MAX_UPLOADS_PER_HOUR = 20;

/** Limite d'envois d'images par client (scope à part du compteur des tickets). */
export async function consumeUpload(userId: string): Promise<void> {
  try {
    await createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
      scope: 'ticket_uploads',
      key: userId,
      max: MAX_UPLOADS_PER_HOUR,
      windowSeconds: 3600,
    });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'RATE_LIMITED') {
      apiError('RATE_LIMITED', { ...e.details, reason: 'upload' });
    }
    throw e;
  }
}

// Un seul compteur pour les créations de tickets et les messages (API_SPEC §5).
const MAX_ACTIONS_PER_HOUR = 10;

export async function consumeAction(userId: string): Promise<void> {
  try {
    await createRateLimiter({ store: createAttemptStore(createAdminClient()) }).consume({
      scope: 'tickets',
      key: userId,
      max: MAX_ACTIONS_PER_HOUR,
      windowSeconds: 3600,
    });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'RATE_LIMITED') {
      apiError('RATE_LIMITED', { ...e.details, reason: 'rate' });
    }
    throw e;
  }
}
