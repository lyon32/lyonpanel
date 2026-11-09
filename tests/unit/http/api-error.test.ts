import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ApiError, ERROR_STATUS, apiError, getErrorMessage } from '@/server/http/api-error';
import fr from '@/messages/errors.fr.json';
import en from '@/messages/errors.en.json';

const FR = fr as Record<string, string>;
const EN = en as Record<string, string>;

// Copie de API_SPEC.md §3 : toute divergence doit casser le test.
const TABLE: Record<string, number> = {
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
};

describe('ERROR_STATUS', () => {
  it("reprend exactement les codes et statuts HTTP d'API_SPEC §3", () => {
    expect(ERROR_STATUS).toEqual(TABLE);
  });
});

describe('apiError', () => {
  it('lève une ApiError avec code, statut et détails', () => {
    try {
      apiError('PHONE_TAKEN', { fields: { phone: 'PHONE_TAKEN' } });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const err = e as ApiError;
      expect(err.code).toBe('PHONE_TAKEN');
      expect(err.status).toBe(409);
      expect(err.details).toEqual({ fields: { phone: 'PHONE_TAKEN' } });
    }
  });
  it('donne 401 à INVALID_CREDENTIALS et 429 à AUTH_LOCKED', () => {
    expect(() => apiError('INVALID_CREDENTIALS')).toThrow(expect.objectContaining({ status: 401 }));
    expect(() => apiError('AUTH_LOCKED')).toThrow(expect.objectContaining({ status: 429 }));
  });
});

describe("messages d'erreur FR/EN", () => {
  it('ont une phrase non vide pour chaque code, dans les deux langues', () => {
    for (const code of Object.keys(TABLE)) {
      expect(FR[code], `fr ${code}`).toBeTruthy();
      expect(EN[code], `en ${code}`).toBeTruthy();
    }
  });
  it('getErrorMessage renvoie la langue demandée', () => {
    expect(getErrorMessage('INVALID_CREDENTIALS', 'fr')).toBe(FR.INVALID_CREDENTIALS);
    expect(getErrorMessage('INVALID_CREDENTIALS', 'en')).toBe(EN.INVALID_CREDENTIALS);
    expect(getErrorMessage('INVALID_CREDENTIALS', 'fr')).not.toBe(
      getErrorMessage('INVALID_CREDENTIALS', 'en'),
    );
  });
  it('FR et EN ont exactement les mêmes codes, et rien de plus que la table', () => {
    expect(Object.keys(FR).sort()).toEqual(Object.keys(EN).sort());
    expect(Object.keys(FR).sort()).toEqual(Object.keys(TABLE).sort());
  });
  it('FORBIDDEN a un message dans chaque langue, sans mention du CSRF ni de JAP', () => {
    expect(FR.FORBIDDEN).toBeTruthy();
    expect(EN.FORBIDDEN).toBeTruthy();
    expect(FR.FORBIDDEN).not.toBe(EN.FORBIDDEN);
  });
  it('ne mentionnent jamais JAP', () => {
    for (const msg of [...Object.values(FR), ...Object.values(EN)])
      expect(msg).not.toMatch(/\bJAP\b|JustAnotherPanel/i);
  });
  it('INVALID_CREDENTIALS ne dit pas si le compte existe', () => {
    expect(getErrorMessage('INVALID_CREDENTIALS', 'fr')).not.toMatch(
      /n'existe|introuvable|inconnu/i,
    );
    expect(getErrorMessage('INVALID_CREDENTIALS', 'en')).not.toMatch(
      /not exist|not found|unknown/i,
    );
  });
});
