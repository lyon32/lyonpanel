import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { MissingEnvError, loadServerEnv, requireEnv } from '@/server/env';

describe('loadServerEnv', () => {
  it('met JAP_MODE à mock et SASPAY_MODE à test par défaut', () => {
    const env = loadServerEnv({});
    expect(env.JAP_MODE).toBe('mock');
    expect(env.SASPAY_MODE).toBe('test');
  });

  it('refuse JAP_MODE=live hors production', () => {
    expect(() => loadServerEnv({ JAP_MODE: 'live', VERCEL_ENV: 'preview' })).toThrow(/JAP_MODE/);
  });

  it('accepte JAP_MODE=live en production', () => {
    const env = loadServerEnv({ JAP_MODE: 'live', VERCEL_ENV: 'production' });
    expect(env.JAP_MODE).toBe('live');
  });

  it('refuse une clé SasPay qui ne correspond pas au mode', () => {
    expect(() => loadServerEnv({ SASPAY_MODE: 'test', SASPAY_API_KEY: 'sk_live_x' })).toThrow();
    expect(() =>
      loadServerEnv({ SASPAY_MODE: 'live', SASPAY_API_KEY: 'sk_test_x', VERCEL_ENV: 'production' }),
    ).toThrow();
  });

  it('refuse un secret exposé en NEXT_PUBLIC_', () => {
    for (const name of [
      'NEXT_PUBLIC_API_SECRET',
      'NEXT_PUBLIC_SERVICE_ROLE',
      'NEXT_PUBLIC_BOT_TOKEN',
    ]) {
      expect(() => loadServerEnv({ [name]: 'x' })).toThrow();
    }
  });

  it('requireEnv lève MissingEnvError avec le nom de la variable', () => {
    const env = loadServerEnv({});
    expect(() => requireEnv(env, 'JAP_API_KEY')).toThrow(MissingEnvError);
    expect(() => requireEnv(env, 'JAP_API_KEY')).toThrow(
      "Variable d'environnement manquante : JAP_API_KEY",
    );
  });
});
