import { vi } from 'vitest';

/* Faux client Supabase pour les appareils (TOTP) : listFactors, challenge, verify, enroll, unenroll. Aucun réseau. */

export type FakeFactor = { id: string; factor_type: string; status: string };
export type FakeMfaOptions = {
  factors?: FakeFactor[];
  /** Code accepté sur chaque appareil (défaut 123456). */
  validCode?: string;
  unenrollError?: { message: string } | null;
  enrollError?: { message: string; code?: string } | null;
};

export const verifiedFactor = (id: string): FakeFactor => ({
  id,
  factor_type: 'totp',
  status: 'verified',
});
export const pendingFactor = (id: string): FakeFactor => ({
  id,
  factor_type: 'totp',
  status: 'unverified',
});

export function fakeMfaSupabase(o: FakeMfaOptions = {}) {
  const factors = o.factors ?? [verifiedFactor('f1')];
  const validCode = o.validCode ?? '123456';
  const mfa = {
    listFactors: vi.fn(async () => ({ data: { all: factors, totp: factors }, error: null })),
    challenge: vi.fn(async ({ factorId }: { factorId: string }) => ({
      data: { id: `challenge-${factorId}` },
      error: null,
    })),
    verify: vi.fn(async ({ code }: { factorId: string; challengeId: string; code: string }) =>
      code === validCode
        ? { data: { access_token: 'x' }, error: null }
        : { data: null, error: { message: 'Invalid TOTP code entered' } },
    ),
    unenroll: vi.fn(async () => ({ data: null, error: o.unenrollError ?? null })),
    enroll: vi.fn(async () =>
      o.enrollError
        ? { data: null, error: o.enrollError }
        : { data: { id: 'new-factor', totp: { qr_code: 'qr', secret: 'SECRET' } }, error: null },
    ),
  };
  return { client: { auth: { mfa } } as never, mfa };
}
