import 'server-only';
import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';
import {
  ApiError,
  ERROR_STATUS,
  getErrorMessage,
  type ErrorCode,
  type ErrorLocale,
} from './api-error';
import { redactSecrets } from './log-mask';

export type Ctx = { requestId: string; locale: ErrorLocale };

function detectLocale(req: NextRequest): ErrorLocale {
  const cookie = req.cookies.get('NEXT_LOCALE')?.value;
  if (cookie === 'fr' || cookie === 'en') return cookie;
  const first = req.headers.get('accept-language')?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'fr';
}

function errorResponse(
  code: ErrorCode,
  ctx: Ctx,
  details?: Record<string, unknown>,
  status: number = ERROR_STATUS[code],
): Response {
  const headers = new Headers({ 'x-request-id': ctx.requestId });
  const retryAfter = details?.retry_after_seconds;
  if ((code === 'AUTH_LOCKED' || code === 'RATE_LIMITED') && typeof retryAfter === 'number') {
    headers.set('retry-after', String(retryAfter));
  }
  const error = {
    code,
    message: getErrorMessage(code, ctx.locale, details),
    ...(details ? { details } : {}),
    request_id: ctx.requestId,
  };
  return Response.json({ error }, { status, headers });
}

/** Enveloppe toutes les routes API : request_id, langue, Zod, ApiError, erreur inconnue. */
export function handler<T>(
  fn: (req: NextRequest, ctx: Ctx) => Promise<T>,
): (req: NextRequest, routeCtx?: unknown) => Promise<Response> {
  // routeCtx : contexte de route Next (params), ignoré ici mais accepté par les tests et routes dynamiques.
  return async (req) => {
    const ctx: Ctx = {
      requestId: `req_${randomBytes(4).toString('hex')}`,
      locale: detectLocale(req),
    };
    try {
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return Response.json(result, { headers: { 'x-request-id': ctx.requestId } });
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.code, ctx, e.details, e.status);
      if (e instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of e.issues) fields[issue.path.join('.') || '_'] ??= issue.message;
        return errorResponse('VALIDATION_ERROR', ctx, { fields });
      }
      // Journal sans corps de requête ni en-têtes : seulement le nom et le message de l'erreur.
      const safe = redactSecrets({
        request_id: ctx.requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        error: e instanceof Error ? `${e.name}: ${e.message}` : 'unknown',
      }) as Record<string, unknown>;
      console.error('internal_error', safe);
      // Import tardif : le client Telegram ne se charge que pour une vraie panne.
      const { notifyOwner } = await import('@/server/providers/telegram');
      await notifyOwner('internal_error', safe);
      return errorResponse('INTERNAL_ERROR', ctx);
    }
  };
}
