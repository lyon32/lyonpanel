import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { store } = vi.hoisted(() => ({
  store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: async () => store }));

import {
  RECOVERY_COOKIE,
  RECOVERY_MAX_AGE_SECONDS,
  clearRecoveryCookie,
  readRecoveryCookie,
  writeRecoveryCookie,
} from '@/server/auth/recovery-cookie';

/**
 * Contrat (src/server/auth/recovery-cookie.ts) :
 *   RECOVERY_COOKIE = 'lp_recovery' ; RECOVERY_MAX_AGE_SECONDS = 900 (15 min)
 *   writeRecoveryCookie(value: string): Promise<void>  : httpOnly, SameSite=Lax, path '/', maxAge 900,
 *                                                       Secure en production
 *   readRecoveryCookie(): Promise<string | null>
 *   clearRecoveryCookie(): Promise<void>               : supprime le cookie (delete ou maxAge 0)
 */

beforeEach(() => {
  store.get.mockReset();
  store.set.mockReset();
  store.delete.mockReset();
  vi.unstubAllEnvs();
});

describe('cookie de session de récupération', () => {
  it('porte le nom lp_recovery et dure 15 minutes', () => {
    expect(RECOVERY_COOKIE).toBe('lp_recovery');
    expect(RECOVERY_MAX_AGE_SECONDS).toBe(900);
  });

  it('est écrit httpOnly, SameSite=Lax, path /, 900 s', async () => {
    await writeRecoveryCookie('valeur-opaque');
    expect(store.set).toHaveBeenCalledWith(
      'lp_recovery',
      'valeur-opaque',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 900 }),
    );
  });

  it('est Secure en production, pas en développement', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await writeRecoveryCookie('v');
    expect(store.set.mock.calls.at(-1)?.[2]).toMatchObject({ secure: true });
    vi.stubEnv('NODE_ENV', 'development');
    await writeRecoveryCookie('v');
    expect(store.set.mock.calls.at(-1)?.[2]).toMatchObject({ secure: false });
  });

  it('se relit, et renvoie null quand il est absent ou vide', async () => {
    store.get.mockReturnValue({ name: 'lp_recovery', value: 'abc' });
    await expect(readRecoveryCookie()).resolves.toBe('abc');
    store.get.mockReturnValue(undefined);
    await expect(readRecoveryCookie()).resolves.toBeNull();
    store.get.mockReturnValue({ name: 'lp_recovery', value: '' });
    await expect(readRecoveryCookie()).resolves.toBeNull();
  });

  it('se supprime (delete ou maxAge 0)', async () => {
    await clearRecoveryCookie();
    const deleted = store.delete.mock.calls.some((c) => c[0] === 'lp_recovery');
    const expired = store.set.mock.calls.some(
      (c) => c[0] === 'lp_recovery' && (c[2] as { maxAge?: number })?.maxAge === 0,
    );
    expect(deleted || expired).toBe(true);
  });
});
