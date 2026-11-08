import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type CookieItem = { name: string; value: string; options: Record<string, unknown> };
type CookieAdapter = {
  getAll(): unknown[];
  setAll(items: CookieItem[]): void;
};

const { createServerClient, store } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  store: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));
vi.mock('@supabase/ssr', () => ({ createServerClient }));
vi.mock('next/headers', () => ({ cookies: async () => store }));
vi.mock('@/server/env', () => ({
  loadServerEnv: () => ({}),
  requireEnv: (_env: unknown, name: string) => `valeur-de-${name}`,
}));

import { createSessionClient } from '@/server/db/supabase-server';

/**
 * Contrat : le setAll des cookies de createSessionClient ne lève JAMAIS.
 * Pendant le rendu d'une page, Next interdit d'écrire des cookies (« Cookies can only be modified
 * in a Server Action or Route Handler ») : l'écriture est ignorée en silence (try/catch),
 * comme le recommande @supabase/ssr. Dans une route ou une action, elle fonctionne normalement.
 */

async function adapter(): Promise<CookieAdapter> {
  await createSessionClient();
  const options = createServerClient.mock.calls.at(-1)?.[2] as { cookies: CookieAdapter };
  return options.cookies;
}

beforeEach(() => {
  createServerClient.mockReset().mockReturnValue({});
  store.set.mockReset();
});

describe('createSessionClient : écriture des cookies', () => {
  it("ne lève pas quand l'écriture de cookies est interdite (rendu serveur)", async () => {
    store.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
    });
    const cookies = await adapter();
    expect(() =>
      cookies.setAll([{ name: 'sb-access-token', value: '', options: { maxAge: 0 } }]),
    ).not.toThrow();
  });

  it('plusieurs cookies dont le premier échoue : ne lève pas non plus', async () => {
    store.set.mockImplementationOnce(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
    });
    const cookies = await adapter();
    expect(() =>
      cookies.setAll([
        { name: 'a', value: '1', options: {} },
        { name: 'b', value: '2', options: {} },
      ]),
    ).not.toThrow();
  });

  it('écrit les cookies en httpOnly, SameSite=Lax, path / quand c’est permis', async () => {
    const cookies = await adapter();
    cookies.setAll([{ name: 'sb-token', value: 'v', options: {} }]);
    expect(store.set).toHaveBeenCalledWith(
      'sb-token',
      'v',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' }),
    );
  });

  it('supprime un cookie avec maxAge 0 et garde 7 jours pour les autres', async () => {
    const cookies = await adapter();
    cookies.setAll([
      { name: 'old', value: '', options: { maxAge: 0 } },
      { name: 'new', value: 'x', options: { maxAge: 3600 } },
    ]);
    expect(store.set).toHaveBeenCalledWith('old', '', expect.objectContaining({ maxAge: 0 }));
    expect(store.set).toHaveBeenCalledWith(
      'new',
      'x',
      expect.objectContaining({ maxAge: 7 * 24 * 60 * 60 }),
    );
  });
});
