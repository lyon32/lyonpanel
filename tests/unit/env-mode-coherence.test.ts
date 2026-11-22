import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadServerEnv } from '@/server/env';

// Fausses valeurs de test uniquement.
const production = { VERCEL_ENV: 'production' };

describe('loadServerEnv : cohérence PROVIDER_MODE / SASPAY_MODE', () => {
  it('refuse PROVIDER_MODE=mock avec SASPAY_MODE=live (clients qui paient, commandes au faux fournisseur)', () => {
    expect(() =>
      loadServerEnv({
        ...production,
        PROVIDER_MODE: 'mock',
        SASPAY_MODE: 'live',
        SASPAY_API_KEY: 'sk_live_fausse',
      }),
    ).toThrow(/PROVIDER_MODE/);
  });

  it('explique clairement que le mode live de SasPay exige le fournisseur live', () => {
    expect(() =>
      loadServerEnv({
        ...production,
        PROVIDER_MODE: 'mock',
        SASPAY_MODE: 'live',
        SASPAY_API_KEY: 'sk_live_fausse',
      }),
    ).toThrow(/SASPAY_MODE=live.*PROVIDER_MODE=live/);
  });

  it('refuse aussi quand PROVIDER_MODE est absent hors production avec SASPAY_MODE=live', () => {
    expect(() =>
      loadServerEnv({ SASPAY_MODE: 'live', SASPAY_API_KEY: 'sk_live_fausse' }),
    ).toThrow();
  });

  it('accepte mock + test (local, preview)', () => {
    const env = loadServerEnv({ PROVIDER_MODE: 'mock', SASPAY_MODE: 'test' });
    expect(env.PROVIDER_MODE).toBe('mock');
    expect(env.SASPAY_MODE).toBe('test');
  });

  it('accepte mock + test en production (rien de réel, pas de vrai paiement)', () => {
    const env = loadServerEnv({ ...production, PROVIDER_MODE: 'mock', SASPAY_MODE: 'test' });
    expect(env.PROVIDER_MODE).toBe('mock');
  });

  it('accepte live + live en production', () => {
    const env = loadServerEnv({
      ...production,
      PROVIDER_MODE: 'live',
      SASPAY_MODE: 'live',
      SASPAY_API_KEY: 'sk_live_fausse',
    });
    expect(env.PROVIDER_MODE).toBe('live');
    expect(env.SASPAY_MODE).toBe('live');
  });

  it('accepte fournisseur live + SasPay test en production (déjà autorisé : aucun vrai paiement)', () => {
    const env = loadServerEnv({
      ...production,
      PROVIDER_MODE: 'live',
      SASPAY_MODE: 'test',
      SASPAY_API_KEY: 'sk_test_fausse',
    });
    expect(env.PROVIDER_MODE).toBe('live');
    expect(env.SASPAY_MODE).toBe('test');
  });
});
