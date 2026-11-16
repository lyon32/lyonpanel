import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { load } from '../../helpers/admin-db';
import { login } from '@/server/auth/login';

/*
 * Faille 4 (énumération de comptes par le temps de réponse). DEUX modules attendus :
 *
 *   src/server/http/min-duration.ts
 *     export const MIN_AUTH_DURATION_MS = 300;
 *     export function withMinDuration<T>(minMs: number, fn: () => Promise<T>): Promise<T>
 *       attend que `minMs` se soit écoulé depuis le début de l'appel, que fn réussisse OU échoue (l'erreur est
 *       relancée telle quelle, après le délai) ; un fn plus lent n'est pas rallongé (plancher, pas ajout).
 *
 *   login() (src/server/auth/login.ts) et adminLogin() (src/server/admin/login.ts) s'exécutent chacun dans
 *   withMinDuration(MIN_AUTH_DURATION_MS, ...) : même durée pour compte connu, inconnu, bon ou mauvais mot de passe.
 *   (Le 404 d'une mauvaise adresse admin ne révèle rien sur les comptes : hors règle.)
 */

type Dur = {
  withMinDuration: <T>(minMs: number, fn: () => Promise<T>) => Promise<T>;
  MIN_AUTH_DURATION_MS: number;
};
const dur = () => load<Dur>('@/server/http/min-duration');

/** Lance p, avance l'horloge à `ms`, dit si p est terminée (réussie ou échouée). */
async function settledAt(p: Promise<unknown>, ms: number): Promise<boolean> {
  let done = false;
  void p.then(
    () => (done = true),
    () => (done = true),
  );
  await vi.advanceTimersByTimeAsync(ms);
  return done;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('withMinDuration', () => {
  it('la constante vaut au moins 300 ms', async () => {
    expect((await dur()).MIN_AUTH_DURATION_MS).toBeGreaterThanOrEqual(300);
  });

  it('une réussite instantanée n’est rendue qu’après le délai minimal', async () => {
    const { withMinDuration } = await dur();
    const p = withMinDuration(300, async () => 'ok');
    expect(await settledAt(p, 299)).toBe(false);
    expect(await settledAt(p, 1)).toBe(true);
    await expect(p).resolves.toBe('ok');
  });

  it('un échec instantané est relancé tel quel, lui aussi après le délai minimal', async () => {
    const { withMinDuration } = await dur();
    const boom = new Error('boom');
    const p = withMinDuration(300, async () => {
      throw boom;
    });
    p.catch(() => {});
    expect(await settledAt(p, 299)).toBe(false);
    expect(await settledAt(p, 1)).toBe(true);
    await expect(p).rejects.toBe(boom);
  });

  it('une fonction plus lente que le minimum n’est pas rallongée', async () => {
    const { withMinDuration } = await dur();
    const p = withMinDuration(
      300,
      () => new Promise<string>((resolve) => setTimeout(() => resolve('lent'), 500)),
    );
    expect(await settledAt(p, 499)).toBe(false);
    expect(await settledAt(p, 1)).toBe(true);
  });
});

const KNOWN = 'connu@lyonpanel.test';
const loginDeps = () => ({
  limiter: { begin: vi.fn(async () => ({ succeed: async () => {} })) },
  findEmailByPhone: vi.fn(async () => null),
  signIn: vi.fn(async (email: string, password: string) =>
    email === KNOWN && password === 'bon-mdp-12345' ? { id: 'u1' } : null,
  ),
});
const loginInput = (identifier: string, password: string) => ({
  identifier,
  password,
  ip: '203.0.113.9',
  turnstile_token: 'tok',
});

describe('login (connexion client) : durée minimale identique', () => {
  it.each([
    ['compte connu, bon mot de passe', KNOWN, 'bon-mdp-12345'],
    ['compte connu, mauvais mot de passe', KNOWN, 'mauvais-mdp-1'],
    ['compte inconnu', 'inconnu@lyonpanel.test', 'mauvais-mdp-1'],
  ])('%s : terminé à 300 ms, pas avant', async (_label, identifier, password) => {
    const p = login(loginInput(identifier, password), loginDeps());
    p.catch(() => {});
    expect(await settledAt(p, 299)).toBe(false);
    expect(await settledAt(p, 1)).toBe(true);
  });
});

describe('adminLogin (connexion admin) : durée minimale identique', () => {
  const ADMIN_PATH = 'k7q2-test-path-9f3a';
  type Mod = { adminLogin: (i: unknown, d: unknown) => Promise<unknown> };

  beforeEach(() => {
    process.env.ADMIN_PATH = ADMIN_PATH;
  });
  afterEach(() => {
    delete process.env.ADMIN_PATH;
  });

  it.each([
    ['compte admin, bon mot de passe', KNOWN, 'bon-mdp-12345'],
    ['compte admin, mauvais mot de passe', KNOWN, 'mauvais-mdp-1'],
    ['compte inconnu', 'inconnu@lyonpanel.test', 'mauvais-mdp-1'],
  ])('%s : terminé à 300 ms, pas avant', async (_label, identifier, password) => {
    const store = (await import('../../helpers/memory-attempt-store')).memoryStore().store;
    const deps = {
      ...loginDeps(),
      isAdmin: vi.fn(async () => true),
      signOut: vi.fn(async () => {}),
      store,
    };
    const { adminLogin } = await load<Mod>('@/server/admin/login');
    const p = adminLogin({ ...loginInput(identifier, password), admin_path: ADMIN_PATH }, deps);
    p.catch(() => {});
    expect(await settledAt(p, 299)).toBe(false);
    expect(await settledAt(p, 1)).toBe(true);
  });
});
