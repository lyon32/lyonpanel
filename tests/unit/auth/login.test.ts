import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { memoryStore } from '../../helpers/memory-attempt-store';
import { login, type LoginDeps } from '@/server/auth/login';
import { createLoginLimiter } from '@/server/auth/rate-limit';
import { ApiError, apiError } from '@/server/http/api-error';

const EMAIL = 'jean@lyonpanel.test';
const PHONE = '+237600000001';
const PASSWORD = 'Un-bon-mot-de-passe-42';
const BAD = 'mauvais-mdp-123';
const IP = '203.0.113.7';
const TOKEN = 'captcha-tok';

/** Un seul compte existe : jean (EMAIL / PHONE / PASSWORD). */
function makeDeps() {
  const deps = {
    limiter: createLoginLimiter({ store: memoryStore().store }),
    findEmailByPhone: vi.fn(async (phone: string) => (phone === PHONE ? EMAIL : null)),
    signIn: vi.fn(async (email: string, password: string, captchaToken: string) =>
      email === EMAIL && password === PASSWORD && captchaToken === TOKEN ? { id: 'user-1' } : null,
    ),
  };
  return deps satisfies LoginDeps;
}

async function failure(p: Promise<unknown>): Promise<ApiError> {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

let deps: ReturnType<typeof makeDeps>;
beforeEach(() => {
  deps = makeDeps();
});

describe('login', () => {
  it('connecte par email avec le bon mot de passe', async () => {
    const res = await login(
      { identifier: EMAIL, password: PASSWORD, ip: IP, turnstile_token: TOKEN },
      deps,
    );
    expect(res.user.id).toBe('user-1');
    expect(deps.signIn).toHaveBeenCalledWith(EMAIL, PASSWORD, TOKEN);
    expect(deps.findEmailByPhone).not.toHaveBeenCalled();
  });

  it("connecte par téléphone : retrouve l'email puis vérifie le mot de passe", async () => {
    const res = await login(
      { identifier: PHONE, password: PASSWORD, ip: IP, turnstile_token: TOKEN },
      deps,
    );
    expect(res.user.id).toBe('user-1');
    expect(deps.findEmailByPhone).toHaveBeenCalledWith(PHONE);
    expect(deps.signIn).toHaveBeenCalledWith(EMAIL, PASSWORD, TOKEN);
  });

  it('mauvais mot de passe, email inconnu et téléphone inconnu : exactement la même erreur', async () => {
    const wrongPw = await failure(
      login({ identifier: EMAIL, password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
    );
    const unknownEmail = await failure(
      login(
        {
          identifier: 'personne@lyonpanel.test',
          password: PASSWORD,
          ip: IP,
          turnstile_token: TOKEN,
        },
        deps,
      ),
    );
    const unknownPhone = await failure(
      login(
        { identifier: '+237699999999', password: PASSWORD, ip: IP, turnstile_token: TOKEN },
        deps,
      ),
    );
    for (const e of [wrongPw, unknownEmail, unknownPhone]) {
      expect(e.code).toBe('INVALID_CREDENTIALS');
      expect(e.status).toBe(401);
    }
    expect(unknownEmail.details).toEqual(wrongPw.details);
    expect(unknownPhone.details).toEqual(wrongPw.details);
    expect(unknownPhone.message).toBe(wrongPw.message);
  });

  it('fait le même travail que le compte existe ou non : une vérification de mot de passe à chaque fois', async () => {
    await failure(
      login(
        { identifier: '+237699999999', password: PASSWORD, ip: IP, turnstile_token: TOKEN },
        deps,
      ),
    );
    expect(deps.signIn).toHaveBeenCalledTimes(1);
    deps.signIn.mockClear();
    await failure(
      login(
        {
          identifier: 'personne@lyonpanel.test',
          password: PASSWORD,
          ip: IP,
          turnstile_token: TOKEN,
        },
        deps,
      ),
    );
    expect(deps.signIn).toHaveBeenCalledTimes(1);
    deps.signIn.mockClear();
    await failure(
      login({ identifier: EMAIL, password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
    );
    expect(deps.signIn).toHaveBeenCalledTimes(1);
  });

  it('pour un compte inconnu, ne tente jamais la connexion avec un vrai email', async () => {
    await failure(
      login(
        { identifier: '+237699999999', password: PASSWORD, ip: IP, turnstile_token: TOKEN },
        deps,
      ),
    );
    expect(deps.signIn).not.toHaveBeenCalledWith(EMAIL, expect.anything(), expect.anything());
  });

  it('après 3 échecs, refuse même le bon mot de passe (AUTH_LOCKED) sans interroger le compte', async () => {
    for (let i = 0; i < 3; i++)
      await failure(
        login({ identifier: EMAIL, password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
      );
    deps.signIn.mockClear();
    deps.findEmailByPhone.mockClear();
    const err = await failure(
      login({ identifier: EMAIL, password: PASSWORD, ip: IP, turnstile_token: TOKEN }, deps),
    );
    expect(err.code).toBe('AUTH_LOCKED');
    expect(err.status).toBe(429);
    expect(err.details).toEqual({ retry_after_seconds: 900 });
    expect(deps.signIn).not.toHaveBeenCalled();
    expect(deps.findEmailByPhone).not.toHaveBeenCalled();
  });

  it('compte aussi les échecs sur un téléphone inconnu (pas de différence observable)', async () => {
    for (let i = 0; i < 3; i++)
      await failure(
        login({ identifier: '+237699999999', password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
      );
    const err = await failure(
      login({ identifier: '+237699999999', password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
    );
    expect(err.code).toBe('AUTH_LOCKED');
  });

  it('un succès requalifie la tentative (succeed) ; un échec la laisse comptée comme échec', async () => {
    const { store, rows } = memoryStore();
    deps.limiter = createLoginLimiter({ store });
    await login({ identifier: EMAIL, password: PASSWORD, ip: IP, turnstile_token: TOKEN }, deps);
    await failure(
      login({ identifier: EMAIL, password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
    );
    expect(rows.map((r) => r.success)).toEqual([true, false]);
  });

  it('la tentative est enregistrée AVANT la vérification du mot de passe', async () => {
    const { store, rows } = memoryStore();
    deps.limiter = createLoginLimiter({ store });
    let rowsSeenBySignIn = -1;
    deps.signIn.mockImplementation(async () => {
      rowsSeenBySignIn = rows.length;
      return null;
    });
    await failure(
      login({ identifier: EMAIL, password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
    );
    expect(rowsSeenBySignIn).toBe(1);
  });

  it('rafale de 20 requêtes parallèles avec un mauvais mot de passe : au plus 3 vérifications', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        login({ identifier: EMAIL, password: BAD, ip: IP, turnstile_token: TOKEN }, deps),
      ),
    );
    expect(deps.signIn.mock.calls.length).toBeLessThanOrEqual(3);
    const codes = results.map((r) => (r.status === 'rejected' ? r.reason.code : 'OK'));
    expect(codes.every((c) => c === 'INVALID_CREDENTIALS' || c === 'AUTH_LOCKED')).toBe(true);
    expect(codes.filter((c) => c === 'AUTH_LOCKED').length).toBeGreaterThanOrEqual(17);
  });

  describe('captcha Turnstile vérifié par Supabase (signIn reçoit le jeton)', () => {
    it('jeton vide : TURNSTILE_FAILED 400, sans appel réseau ni tentative enregistrée', async () => {
      const { store, rows } = memoryStore();
      deps.limiter = createLoginLimiter({ store });
      const err = await failure(
        login({ identifier: EMAIL, password: PASSWORD, ip: IP, turnstile_token: '' }, deps),
      );
      expect(err.code).toBe('TURNSTILE_FAILED');
      expect(err.status).toBe(400);
      expect(deps.signIn).not.toHaveBeenCalled();
      expect(deps.findEmailByPhone).not.toHaveBeenCalled();
      expect(rows).toHaveLength(0);
    });

    it("jeton fait seulement d'espaces : même refus", async () => {
      const err = await failure(
        login({ identifier: EMAIL, password: PASSWORD, ip: IP, turnstile_token: '   ' }, deps),
      );
      expect(err.code).toBe('TURNSTILE_FAILED');
      expect(deps.signIn).not.toHaveBeenCalled();
    });

    it('Supabase refuse le captcha (signIn lève TURNSTILE_FAILED) : la même erreur 400 remonte', async () => {
      deps.signIn.mockImplementation(async () => apiError('TURNSTILE_FAILED'));
      const err = await failure(
        login({ identifier: EMAIL, password: PASSWORD, ip: IP, turnstile_token: TOKEN }, deps),
      );
      expect(err.code).toBe('TURNSTILE_FAILED');
      expect(err.status).toBe(400);
    });

    it('le jeton transmis à signIn est celui du client, pour un email comme pour un téléphone', async () => {
      await login({ identifier: PHONE, password: PASSWORD, ip: IP, turnstile_token: TOKEN }, deps);
      expect(deps.signIn.mock.calls[0]?.[2]).toBe(TOKEN);
    });

    it('LoginDeps ne contient plus de vérification Turnstile séparée (pas de double usage du jeton)', () => {
      expect('verifyTurnstile' in deps).toBe(false);
    });
  });
});
