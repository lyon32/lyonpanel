import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { env } = vi.hoisted(() => ({ env: { current: {} as Record<string, unknown> } }));
vi.mock('@/server/env', () => ({ loadServerEnv: () => env.current }));

import { getProvider } from '@/server/providers';

// Module attendu : src/server/providers/index.ts
//   getProvider(): ProviderApi : faux fournisseur si PROVIDER_MODE=mock, client réel si live.

beforeEach(() => {
  env.current = { PROVIDER_MODE: 'mock' };
  vi.restoreAllMocks();
});

describe('getProvider', () => {
  it('en mode mock, renvoie le faux fournisseur sans aucun appel réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const list = await getProvider().services();
    expect(list.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('en mode live sans clé, refuse de démarrer', () => {
    env.current = { PROVIDER_MODE: 'live', PROVIDER_API_URL: 'https://x.invalid/api/v2' };
    expect(() => getProvider()).toThrow();
  });

  it('en mode live avec clé, renvoie un client qui expose les 4 méthodes', () => {
    env.current = {
      PROVIDER_MODE: 'live',
      PROVIDER_API_URL: 'https://x.invalid/api/v2',
      PROVIDER_API_KEY: 'k',
    };
    const p = getProvider();
    for (const m of ['services', 'balance', 'add', 'status'] as const) {
      expect(typeof p[m]).toBe('function');
    }
  });
});
