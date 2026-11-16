import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fakeMfaSupabase,
  pendingFactor,
  verifiedFactor,
  type FakeFactor,
  type FakeMfaOptions,
} from '../../helpers/fake-mfa-session';
import { memoryStore } from '../../helpers/memory-attempt-store';
import type { AttemptStore } from '@/server/auth/rate-limit';
import { ApiError } from '@/server/http/api-error';

vi.mock('server-only', () => ({}));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: vi.fn(async () => {}) }));
const ref = vi.hoisted(() => ({ store: null as AttemptStore | null }));
vi.mock('@/server/db/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/server/auth/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/server/auth/rate-limit')>()),
  createAttemptStore: () => ref.store,
}));

import { enrollDevice } from '@/server/admin/mfa';

/*
 * Enrôlement des appareils (relecture 11.5 point 3, sécurité failles 2 et 6). Module : src/server/admin/mfa.ts
 *   enrollDevice(supabase): Promise<{ factorId; qrCode; secret }>   (signature inchangée)
 * Règles :
 *   - le résultat de chaque `unenroll` est vérifié : en cas d'erreur, on lève et on n'appelle PAS `enroll` ;
 *   - refus de Supabase « AAL2 required to enroll a new factor » (1 appareil vérifié, session aal1)
 *     -> ApiError MFA_REQUIRED (401), pas une Error générique (sinon 500 + alerte internal_error) ;
 *   - ADMIN_ENROLL_OPEN (variable serveur, texte « true » / « false ») :
 *       absente ou « true » -> enrôlement possible tant qu'il y a moins de 2 appareils vérifiés (0 ou 1) ;
 *       « false »           -> fermé : NOT_FOUND (404), même avec 0 appareil ;
 *       2 appareils vérifiés -> toujours refusé (VALIDATION_ERROR, MFA_DEVICES_COMPLETE), jamais un 3e.
 */

const enroll = (o: FakeMfaOptions) => {
  const fake = fakeMfaSupabase(o);
  return { fake, run: () => enrollDevice(fake.client) };
};

beforeEach(() => {
  ref.store = memoryStore().store;
  vi.unstubAllEnvs();
});
afterEach(() => vi.unstubAllEnvs());

describe('enrollDevice : QR code', () => {
  it('retire le retour à la ligne final du SVG (next/image le refuse sinon)', async () => {
    const { fake, run } = enroll({ factors: [] });
    fake.mfa.enroll.mockResolvedValueOnce({
      data: { id: 'f', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>\n', secret: 'S' } },
      error: null,
    });
    await expect(run()).resolves.toMatchObject({ qrCode: 'data:image/svg+xml;utf-8,<svg/>' });
  });
});

describe('enrollDevice : nettoyage des appareils non confirmés', () => {
  it('retire un appareil jamais confirmé puis enrôle le nouveau', async () => {
    const { fake, run } = enroll({ factors: [pendingFactor('old')] });
    await expect(run()).resolves.toMatchObject({ factorId: 'new-factor', secret: 'SECRET' });
    expect(fake.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'old' });
  });

  it('si unenroll échoue : une erreur est levée et enroll n’est pas appelé', async () => {
    const { fake, run } = enroll({
      factors: [pendingFactor('old')],
      unenrollError: { message: 'boom' },
    });
    await expect(run()).rejects.toThrow();
    expect(fake.mfa.enroll).not.toHaveBeenCalled();
  });
});

describe('enrollDevice : 1 appareil vérifié et session aal1', () => {
  const aal2Refusal = { message: 'AAL2 required to enroll a new factor', code: 'insufficient_aal' };

  it('le refus de Supabase devient MFA_REQUIRED 401 (pas une erreur générique)', async () => {
    const { run } = enroll({ factors: [verifiedFactor('f1')], enrollError: aal2Refusal });
    const err = await run().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'MFA_REQUIRED', status: 401 });
  });

  it('une autre panne de Supabase reste une erreur interne (pas masquée en MFA_REQUIRED)', async () => {
    const { run } = enroll({ enrollError: { message: 'database unavailable' }, factors: [] });
    const err = await run().catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('enrollDevice : ADMIN_ENROLL_OPEN', () => {
  it('variable absente et 0 appareil vérifié : enrôlement ouvert', async () => {
    const { fake, run } = enroll({ factors: [] });
    await run();
    expect(fake.mfa.enroll).toHaveBeenCalledTimes(1);
  });

  it('« true » et 1 appareil vérifié : le 2e appareil peut être enrôlé', async () => {
    vi.stubEnv('ADMIN_ENROLL_OPEN', 'true');
    const { fake, run } = enroll({ factors: [verifiedFactor('f1')] });
    await run();
    expect(fake.mfa.enroll).toHaveBeenCalledTimes(1);
  });

  const closedCases: [string, FakeFactor[]][] = [
    ['0 appareil vérifié', []],
    ['1 appareil vérifié', [verifiedFactor('f1')]],
  ];
  it.each(closedCases)(
    '« false » ferme l’enrôlement (404 NOT_FOUND) : %s',
    async (_label, factors) => {
      vi.stubEnv('ADMIN_ENROLL_OPEN', 'false');
      const { fake, run } = enroll({ factors });
      await expect(run()).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
      expect(fake.mfa.enroll).not.toHaveBeenCalled();
    },
  );

  it.each([['absente'], ['true'], ['false']])(
    '2 appareils vérifiés : jamais de 3e appareil (variable : %s)',
    async (value) => {
      if (value !== 'absente') vi.stubEnv('ADMIN_ENROLL_OPEN', value);
      const { fake, run } = enroll({ factors: [verifiedFactor('f1'), verifiedFactor('f2')] });
      await expect(run()).rejects.toBeInstanceOf(ApiError);
      expect(fake.mfa.enroll).not.toHaveBeenCalled();
      expect(fake.mfa.unenroll).not.toHaveBeenCalled();
    },
  );
});
