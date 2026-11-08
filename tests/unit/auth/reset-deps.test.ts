import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getUser, updateUser, store } = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/server/db/supabase-server', () => ({
  createSessionClient: async () => ({ auth: { getUser, updateUser } }),
  createStatelessClient: () => ({ auth: {} }),
}));
vi.mock('@/server/db/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('next/headers', () => ({ cookies: async () => store }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: vi.fn(),
}));

import { buildResetDeps } from '@/server/auth/supabase-deps';
import { signRecoveryMarker } from '@/server/auth/recovery-cookie';
import { ApiError } from '@/server/http/api-error';

/**
 * Contrat (buildResetDeps, src/server/auth/supabase-deps.ts) :
 *   updatePassword : erreur Supabase `same_password` -> ApiError VALIDATION_ERROR
 *     { fields: { new_password: 'PASSWORD_SAME_AS_CURRENT' } } ; toute autre erreur remonte telle quelle.
 *   getRecoverySession : le cookie lp_recovery doit contenir un marqueur valide
 *     (verifyRecoveryMarker(valeur, user.id)) pour l'utilisateur renvoyé par getUser ; sinon null.
 */

beforeEach(() => {
  vi.stubEnv('AUTH_HASH_SECRET', 'secret-de-test-recovery');
  getUser.mockReset();
  updateUser.mockReset();
  store.get.mockReset();
});

describe('buildResetDeps().updatePassword', () => {
  it('same_password de Supabase devient PASSWORD_SAME_AS_CURRENT sur le champ new_password', async () => {
    updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'same_password', status: 422, message: 'New password should be different' },
    });
    const err = await buildResetDeps()
      .updatePassword('u1', 'Cf9!vQ2#zLm7-rTa84')
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      details: { fields: { new_password: 'PASSWORD_SAME_AS_CURRENT' } },
    });
  });

  it('une autre erreur de updateUser remonte comme vraie erreur (pas une erreur de champ)', async () => {
    const boom = { code: 'unexpected_failure', status: 500, message: 'db down' };
    updateUser.mockResolvedValue({ data: { user: null }, error: boom });
    const err = await buildResetDeps()
      .updatePassword('u1', 'Cf9!vQ2#zLm7-rTa84')
      .catch((e) => e);
    expect(err).not.toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'unexpected_failure' });
  });

  it('succès : résout et transmet le nouveau mot de passe à updateUser', async () => {
    updateUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    await expect(
      buildResetDeps().updatePassword('u1', 'Cf9!vQ2#zLm7-rTa84'),
    ).resolves.toBeUndefined();
    expect(updateUser).toHaveBeenCalledWith({ password: 'Cf9!vQ2#zLm7-rTa84' });
  });
});

describe('buildResetDeps().getRecoverySession (marqueur signé)', () => {
  const user = { id: 'user-1', email: 'jean@lyonpanel.test' };
  const withCookie = (value: string | undefined) =>
    store.get.mockReturnValue(value === undefined ? undefined : { name: 'lp_recovery', value });

  it('marqueur valide pour cet utilisateur : renvoie son identité', async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    withCookie(signRecoveryMarker('user-1'));
    await expect(buildResetDeps().getRecoverySession()).resolves.toEqual({
      userId: 'user-1',
      email: 'jean@lyonpanel.test',
    });
  });

  it('marqueur expiré (émis il y a 16 minutes) : null', async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    withCookie(signRecoveryMarker('user-1', Date.now() - 16 * 60_000));
    await expect(buildResetDeps().getRecoverySession()).resolves.toBeNull();
  });

  it('marqueur signé pour un autre utilisateur : null', async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    withCookie(signRecoveryMarker('user-2'));
    await expect(buildResetDeps().getRecoverySession()).resolves.toBeNull();
  });

  it('ancien format ou valeur fabriquée à la main : null', async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    withCookie('a'.repeat(64));
    await expect(buildResetDeps().getRecoverySession()).resolves.toBeNull();
    withCookie('ok');
    await expect(buildResetDeps().getRecoverySession()).resolves.toBeNull();
  });

  it('pas de cookie : null, sans interroger Supabase', async () => {
    withCookie(undefined);
    await expect(buildResetDeps().getRecoverySession()).resolves.toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
