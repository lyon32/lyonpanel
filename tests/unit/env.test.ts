import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('refuse SASPAY_MODE=live hors production', () => {
    const live = { SASPAY_MODE: 'live', SASPAY_API_KEY: 'sk_live_x' };
    expect(() => loadServerEnv({ ...live, VERCEL_ENV: 'preview' })).toThrow(/SASPAY_MODE/);
    expect(() => loadServerEnv(live)).toThrow(/SASPAY_MODE/);
  });

  it('accepte SASPAY_MODE=live en production', () => {
    const env = loadServerEnv({
      SASPAY_MODE: 'live',
      SASPAY_API_KEY: 'sk_live_x',
      VERCEL_ENV: 'production',
    });
    expect(env.SASPAY_MODE).toBe('live');
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

  it('refuse les secrets NEXT_PUBLIC_ aux noms variés, sans tenir compte de la casse', () => {
    for (const name of [
      'NEXT_PUBLIC_SERVICE_KEY',
      'NEXT_PUBLIC_JAP_API_KEY',
      'NEXT_PUBLIC_SASPAY_API_KEY',
      'NEXT_PUBLIC_API_KEY',
      'NEXT_PUBLIC_PASSWORD',
      'NEXT_PUBLIC_PRIVATE_KEY',
      'NEXT_PUBLIC_supabase_service_role_key',
    ]) {
      expect(() => loadServerEnv({ [name]: 'x' })).toThrow(/Secret exposé/);
    }
  });

  it('accepte toutes les NEXT_PUBLIC_ de .env.example', () => {
    const text = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
    const names = [...text.matchAll(/^NEXT_PUBLIC_\w+/gm)].map((m) => m[0]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(() => loadServerEnv({ [name]: 'x' })).not.toThrow();
    }
  });

  it('compare les préfixes SasPay sans tenir compte de la casse et exige le préfixe du mode', () => {
    expect(() => loadServerEnv({ SASPAY_MODE: 'test', SASPAY_API_KEY: 'SK_LIVE_x' })).toThrow();
    expect(() => loadServerEnv({ SASPAY_MODE: 'test', SASPAY_API_KEY: 'sansprefixe' })).toThrow();
    expect(() => loadServerEnv({ SASPAY_MODE: 'test', SASPAY_API_KEY: 'SK_TEST_x' })).not.toThrow();
    const live = { SASPAY_MODE: 'live', VERCEL_ENV: 'production' };
    expect(() => loadServerEnv({ ...live, SASPAY_API_KEY: 'sansprefixe' })).toThrow();
    expect(() => loadServerEnv({ ...live, SASPAY_API_KEY: 'SK_TEST_x' })).toThrow();
    expect(() => loadServerEnv({ ...live, SASPAY_API_KEY: 'sk_live_x' })).not.toThrow();
  });

  it('requireEnv lève MissingEnvError avec le nom de la variable', () => {
    const env = loadServerEnv({});
    expect(() => requireEnv(env, 'JAP_API_KEY')).toThrow(MissingEnvError);
    expect(() => requireEnv(env, 'JAP_API_KEY')).toThrow(
      "Variable d'environnement manquante : JAP_API_KEY",
    );
  });
});
