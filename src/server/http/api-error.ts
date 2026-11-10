import 'server-only';
import en from '@/messages/errors.en.json';
import fr from '@/messages/errors.fr.json';

// Copie exacte d'API_SPEC.md §3 : un test la compare à la spécification.
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  TURNSTILE_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  MFA_REQUIRED: 401,
  ACCOUNT_BLOCKED: 403,
  NOT_ADMIN: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  PHONE_TAKEN: 409,
  IDEMPOTENCY_CONFLICT: 409,
  ALREADY_REFUNDED: 409,
  PAYMENT_NOT_PAYABLE: 409,
  INSUFFICIENT_BALANCE: 422,
  QUANTITY_OUT_OF_RANGE: 422,
  INVALID_LINK: 422,
  SERVICE_UNAVAILABLE: 422,
  PRICE_CHANGED: 422,
  DAILY_LIMIT_REACHED: 422,
  AMOUNT_BELOW_MINIMUM: 422,
  AMOUNT_MISMATCH: 422,
  AMOUNT_TOO_HIGH: 422,
  INVALID_AMOUNT: 422,
  NOTE_REQUIRED: 422,
  FILE_TOO_LARGE: 422,
  FILE_TYPE_NOT_ALLOWED: 422,
  RATE_LIMITED: 429,
  AUTH_LOCKED: 429,
  PROVIDER_ERROR: 502,
  PROVIDER_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;
export type ErrorLocale = 'fr' | 'en';

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Lève une ApiError ; le statut HTTP vient toujours de la table. */
export function apiError(code: ErrorCode, details?: Record<string, unknown>): never {
  throw new ApiError(code, ERROR_STATUS[code], details);
}

const MESSAGES: Record<ErrorLocale, Record<string, string>> = { fr, en };

/** « 15 min », « 2 h »… : arrondi au-dessus, pour ne jamais promettre trop tôt. */
function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.ceil(minutes / 60)} h`;
}

/** Un message peut contenir {duration}, remplacé par le temps restant (details.retry_after_seconds). */
export function getErrorMessage(
  code: ErrorCode,
  locale: ErrorLocale,
  details?: Record<string, unknown>,
): string {
  // Montants du détail (ex. {min_xaf}) : seuls les nombres entiers sont insérés, tels quels.
  const base = (MESSAGES[locale][code] ?? '').replace(
    /\{(min_xaf|max_xaf|missing_xaf|min|max|limit_xaf|new_total_xaf)\}/g,
    (match, key: string) => {
      const value = details?.[key];
      return typeof value === 'number' ? String(value) : match;
    },
  );
  if (!base.includes('{duration}')) return base;
  const seconds = details?.retry_after_seconds;
  const fallback = locale === 'fr' ? 'quelques instants' : 'a few moments';
  return base.replace(
    '{duration}',
    typeof seconds === 'number' ? formatDuration(seconds) : fallback,
  );
}
