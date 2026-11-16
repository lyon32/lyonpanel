import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Plancher de durée neutralisé ici (logique d'alertes/limiteur) ; le plancher réel est prouvé dans min-duration.test.ts.
vi.mock('@/server/http/min-duration', () => ({
  MIN_AUTH_DURATION_MS: 1000,
  withMinDuration: <T>(_ms: number, fn: () => Promise<T>) => fn(),
}));
const notify = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: notify.fn }));

import { load } from '../../helpers/admin-db';
import { memoryStore } from '../../helpers/memory-attempt-store';
import { ApiError } from '@/server/http/api-error';

/*
 * Connexion admin DÉDIÉE (phase 11, décision du propriétaire) : POST /api/v1/admin/login.
 * Module attendu : src/server/admin/login.ts
 *   adminLogin(input: { identifier; password; ip; turnstile_token; admin_path }, deps: AdminLoginDeps)
 *     : Promise<{ user: { id: string } }>
 *   AdminLoginDeps = {
 *     limiter: LoginLimiter;                       // comme la connexion client
 *     findEmailByPhone(phone): Promise<string | null>;
 *     signIn(email, password, captchaToken): Promise<{ id: string } | null>;
 *     isAdmin(userId): Promise<boolean>;
 *     signOut(): Promise<void>;                    // un compte non admin ne reste jamais connecté par cette route
 *     store: AttemptStore;                         // table login_attempts : compte les échecs pour l'alerte
 *   }
 * Règles :
 *   - `admin_path` doit être exactement ADMIN_PATH, sinon 404 NOT_FOUND avant tout (rien d'enregistré, rien d'appelé) ;
 *   - jeton Turnstile obligatoire ; réponse d'échec NEUTRE : INVALID_CREDENTIALS, identique pour mauvais mot de passe
 *     de l'admin, compte inconnu, téléphone inconnu et client ordinaire (même avec le bon mot de passe) ;
 *   - alerte Telegram `admin_login_failed` au 5e échec sur 15 min, une seule par fenêtre, contenu : { failures } seulement.
 */

const ADMIN_PATH = 'k7q2-test-path-9f3a';
const ADMIN_EMAIL = 'proprietaire@lyonpanel.test';
const ADMIN_PASSWORD = 'Un-bon-mot-de-passe-42';
const CLIENT_EMAIL = 'client-1@lyonpanel.test';
const TOKEN = 'captcha-tok';
const IP = '203.0.113.9';

type Input = {
  identifier: string;
  password: string;
  ip: string;
  turnstile_token: string;
  admin_path: string | undefined;
};
type Mod = { adminLogin: (input: Input, deps: unknown) => Promise<{ user: { id: string } }> };
const mod = () => load<Mod>('@/server/admin/login');

function makeDeps() {
  const mem = memoryStore();
  return {
    // Limiteur neutre : ces tests prouvent l'alerte, pas le blocage progressif (déjà testé pour la connexion client).
    limiter: { begin: vi.fn(async () => ({ succeed: async () => {} })) },
    findEmailByPhone: vi.fn(async () => null),
    signIn: vi.fn(async (email: string, password: string) => {
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) return { id: 'admin-1' };
      if (email === CLIENT_EMAIL && password === ADMIN_PASSWORD) return { id: 'client-1' };
      return null;
    }),
    isAdmin: vi.fn(async (id: string) => id === 'admin-1'),
    signOut: vi.fn(async () => {}),
    store: mem.store,
  };
}
type Deps = ReturnType<typeof makeDeps>;

const attempt = async (deps: Deps, over: Partial<Input> = {}) =>
  (await mod()).adminLogin(
    {
      identifier: ADMIN_EMAIL,
      password: 'mauvais-mdp-123',
      ip: IP,
      turnstile_token: TOKEN,
      admin_path: ADMIN_PATH,
      ...over,
    },
    deps,
  );
async function failure(p: Promise<unknown>): Promise<ApiError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

let deps: Deps;
beforeEach(() => {
  process.env.ADMIN_PATH = ADMIN_PATH;
  notify.fn.mockClear();
  deps = makeDeps();
});
afterEach(() => {
  delete process.env.ADMIN_PATH;
  vi.useRealTimers();
});

describe('adminLogin : adresse secrète', () => {
  it('bon mot de passe de l’administrateur : connecté', async () => {
    const res = await attempt(deps, { password: ADMIN_PASSWORD });
    expect(res.user.id).toBe('admin-1');
    expect(deps.signOut).not.toHaveBeenCalled();
    expect(notify.fn).not.toHaveBeenCalled();
  });

  it.each([[undefined], [''], ['admin'], [ADMIN_PATH.toUpperCase()], [`${ADMIN_PATH}/`], ['x']])(
    'adresse %j : 404 NOT_FOUND, rien d’enregistré ni d’appelé',
    async (path) => {
      const err = await failure(attempt(deps, { password: ADMIN_PASSWORD, admin_path: path }));
      expect(err).toMatchObject({ code: 'NOT_FOUND', status: 404 });
      expect(deps.signIn).not.toHaveBeenCalled();
      expect(deps.limiter.begin).not.toHaveBeenCalled();
      expect(notify.fn).not.toHaveBeenCalled();
    },
  );

  it('sans ADMIN_PATH configuré : tout est refusé en 404, même un segment vide', async () => {
    delete process.env.ADMIN_PATH;
    for (const path of [undefined, '', ADMIN_PATH]) {
      const err = await failure(attempt(deps, { password: ADMIN_PASSWORD, admin_path: path }));
      expect(err).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    }
    expect(deps.signIn).not.toHaveBeenCalled();
  });
});

describe('adminLogin : Turnstile et réponse neutre', () => {
  it('jeton Turnstile vide : TURNSTILE_FAILED, mot de passe jamais essayé', async () => {
    const err = await failure(attempt(deps, { turnstile_token: '  ' }));
    expect(err.code).toBe('TURNSTILE_FAILED');
    expect(deps.signIn).not.toHaveBeenCalled();
  });

  it('transmet le jeton Turnstile à la vérification du mot de passe', async () => {
    await attempt(deps, { password: ADMIN_PASSWORD });
    expect(deps.signIn).toHaveBeenCalledWith(ADMIN_EMAIL, ADMIN_PASSWORD, TOKEN);
  });

  it('mauvais mot de passe de l’admin, compte inconnu, téléphone inconnu et client ordinaire : exactement la même réponse', async () => {
    const wrongPw = await failure(attempt(deps));
    const unknownEmail = await failure(attempt(deps, { identifier: 'personne@lyonpanel.test' }));
    const unknownPhone = await failure(attempt(deps, { identifier: '+237600000999' }));
    const ordinaryClient = await failure(
      attempt(deps, { identifier: CLIENT_EMAIL, password: ADMIN_PASSWORD }),
    );
    for (const e of [unknownEmail, unknownPhone, ordinaryClient]) {
      expect(e.code).toBe('INVALID_CREDENTIALS');
      expect(e.status).toBe(wrongPw.status);
      expect(e.message).toBe(wrongPw.message);
      expect(e.details).toEqual(wrongPw.details);
    }
    expect(wrongPw).toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
  });

  it('un client ordinaire avec le bon mot de passe est déconnecté aussitôt (aucune session ouverte)', async () => {
    await failure(attempt(deps, { identifier: CLIENT_EMAIL, password: ADMIN_PASSWORD }));
    expect(deps.isAdmin).toHaveBeenCalledWith('client-1');
    expect(deps.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('adminLogin : alerte Telegram admin_login_failed', () => {
  it('4 échecs : aucune alerte ; le 5e : une alerte', async () => {
    for (let i = 0; i < 4; i++) await failure(attempt(deps));
    expect(notify.fn).not.toHaveBeenCalled();
    await failure(attempt(deps));
    expect(notify.fn).toHaveBeenCalledTimes(1);
    expect(notify.fn).toHaveBeenCalledWith('admin_login_failed', { failures: 5 });
  });

  // Décision du chef de projet (relecture 11.5, point 2) : une seule alerte par fenêtre de 15 min.
  it('6e à 12e : aucune nouvelle alerte (une seule alerte par fenêtre de 15 minutes)', async () => {
    for (let i = 0; i < 12; i++) await failure(attempt(deps));
    expect(notify.fn).toHaveBeenCalledTimes(1);
  });

  it('l’alerte ne contient ni mot de passe, ni email, ni identifiant, ni IP', async () => {
    for (let i = 0; i < 5; i++) await failure(attempt(deps, { password: `secret-${i}-xyz` }));
    const sent = JSON.stringify(notify.fn.mock.calls);
    for (const forbidden of ['secret-', ADMIN_EMAIL, 'proprietaire', IP, TOKEN]) {
      expect(sent).not.toContain(forbidden);
    }
  });

  it('les échecs de plus de 15 minutes ne comptent pas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    for (let i = 0; i < 4; i++) await failure(attempt(deps));
    vi.setSystemTime(new Date('2026-11-16T10:16:00Z'));
    await failure(attempt(deps)); // 1 seul échec dans la fenêtre
    expect(notify.fn).not.toHaveBeenCalled();
  });

  it('5 échecs en moins de 15 minutes (étalés) : alerte', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    for (let i = 0; i < 5; i++) {
      await failure(attempt(deps));
      vi.setSystemTime(new Date(Date.now() + 2 * 60_000));
    }
    expect(notify.fn).toHaveBeenCalledTimes(1);
  });

  it('une connexion réussie ne déclenche jamais d’alerte', async () => {
    for (let i = 0; i < 6; i++) await attempt(deps, { password: ADMIN_PASSWORD });
    expect(notify.fn).not.toHaveBeenCalled();
  });
});
