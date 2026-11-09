import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { memoryStore } from '../../helpers/memory-attempt-store';
import { registerUser, type RegisterDeps } from '@/server/auth/register';
import { requestPasswordReset, type PasswordResetDeps } from '@/server/auth/password-reset';
import { createRateLimiter } from '@/server/auth/rate-limit';
import { ApiError } from '@/server/http/api-error';

const input = {
  email: 'client-1@lyonpanel.test',
  password: 'Cf9!vQ2#zLm7-rTa84',
  phone: '+237600000001',
  country: 'CM',
  display_currency: 'USD',
  language: 'en',
  turnstile_token: 'tok',
} as const;
const IP = '203.0.113.7';

async function failure(p: Promise<unknown>): Promise<ApiError> {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

function makeDeps() {
  const deps = {
    rateLimiter: createRateLimiter({ store: memoryStore().store }),
    verifyTurnstile: vi.fn<RegisterDeps['verifyTurnstile']>(async () => true),
    createAuthUser: vi.fn<RegisterDeps['createAuthUser']>(async () => ({
      ok: true,
      userId: 'user-1',
    })),
    setDisplayCurrency: vi.fn<RegisterDeps['setDisplayCurrency']>(async () => {}),
  };
  return deps satisfies RegisterDeps;
}

let deps: ReturnType<typeof makeDeps>;
beforeEach(() => {
  deps = makeDeps();
});

describe('registerUser', () => {
  it("crée le compte puis pose la devise d'affichage choisie", async () => {
    const res = await registerUser(input, IP, deps);
    expect(res.user).toMatchObject({
      id: 'user-1',
      email: input.email,
      phone: input.phone,
      country: 'CM',
      display_currency: 'USD',
      language: 'en',
    });
    expect(deps.setDisplayCurrency).toHaveBeenCalledWith('user-1', 'USD');
  });

  it('transmet country, language et referral dans les métadonnées, jamais le mot de passe', async () => {
    await registerUser({ ...input, referral_code: 'ABC123' }, IP, deps);
    const arg = deps.createAuthUser.mock.calls[0]?.[0] as {
      password: string;
      metadata: Record<string, unknown>;
    };
    expect(arg).toMatchObject({
      email: input.email,
      phone: input.phone,
      password: input.password,
      metadata: { country: 'CM', language: 'en', referral: 'ABC123' },
    });
    expect(JSON.stringify(arg.metadata)).not.toContain(input.password);
  });

  it('ne renvoie jamais le mot de passe dans la réponse', async () => {
    const res = await registerUser(input, IP, deps);
    expect(JSON.stringify(res)).not.toContain(input.password);
  });

  it("vérifie Turnstile avec le jeton et l'IP ; échec = TURNSTILE_FAILED, aucun compte créé", async () => {
    deps.verifyTurnstile.mockResolvedValue(false);
    const err = await failure(registerUser(input, IP, deps));
    expect(err.code).toBe('TURNSTILE_FAILED');
    expect(err.status).toBe(400);
    expect(deps.verifyTurnstile).toHaveBeenCalledWith('tok', IP);
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });

  it('refuse un mot de passe de la liste des 10 000 plus courants', async () => {
    const err = await failure(registerUser({ ...input, password: 'password' }, IP, deps));
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(Object.keys((err.details as { fields: object }).fields)).toContain('password');
    expect(deps.createAuthUser).not.toHaveBeenCalled();
  });

  it('email déjà utilisé : 409 EMAIL_TAKEN (API_SPEC §3) avec details.fields.email', async () => {
    deps.createAuthUser.mockResolvedValue({ ok: false, reason: 'EMAIL_TAKEN' });
    const err = await failure(registerUser(input, IP, deps));
    expect(err.code).toBe('EMAIL_TAKEN');
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ fields: { email: 'EMAIL_TAKEN' } });
    expect(deps.setDisplayCurrency).not.toHaveBeenCalled();
  });

  it('téléphone déjà utilisé : 409 PHONE_TAKEN avec details.fields.phone', async () => {
    deps.createAuthUser.mockResolvedValue({ ok: false, reason: 'PHONE_TAKEN' });
    const err = await failure(registerUser(input, IP, deps));
    expect(err.code).toBe('PHONE_TAKEN');
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ fields: { phone: 'PHONE_TAKEN' } });
  });
});

describe('registerUser : plafond par IP', () => {
  it('accepte 10 inscriptions par heure et par IP, refuse la 11e (RATE_LIMITED 429, aucun compte créé)', async () => {
    const d = makeDeps();
    for (let i = 0; i < 10; i++) await registerUser(input, IP, d);
    d.createAuthUser.mockClear();
    const err = await failure(registerUser(input, IP, d));
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.status).toBe(429);
    expect(err.details?.retry_after_seconds).toBeGreaterThan(0);
    expect(d.createAuthUser).not.toHaveBeenCalled();
    expect(d.verifyTurnstile).toHaveBeenCalledTimes(10);
  });
  it('une autre IP garde son propre quota', async () => {
    const d = makeDeps();
    for (let i = 0; i < 10; i++) await registerUser(input, IP, d);
    await expect(registerUser(input, '198.51.100.9', d)).resolves.toBeDefined();
  });
  it("IP 'unknown' : le plafond par IP ne s'applique pas (on ne bloque pas tout le monde)", async () => {
    const d = makeDeps();
    for (let i = 0; i < 12; i++) await registerUser(input, 'unknown', d);
    expect(d.createAuthUser).toHaveBeenCalledTimes(12);
  });
});

describe('requestPasswordReset', () => {
  function makeResetDeps() {
    return {
      rateLimiter: createRateLimiter({ store: memoryStore().store }),
      sendReset: vi.fn<PasswordResetDeps['sendReset']>(async () => {}),
    } satisfies PasswordResetDeps;
  }
  let rdeps: ReturnType<typeof makeResetDeps>;
  beforeEach(() => {
    rdeps = makeResetDeps();
  });

  it('répond { ok: true } et envoie le lien', async () => {
    await expect(
      requestPasswordReset({ email: 'a@b.co', turnstile_token: 't' }, IP, rdeps),
    ).resolves.toEqual({ ok: true });
    expect(rdeps.sendReset).toHaveBeenCalledWith('a@b.co', 't');
  });

  it("répond exactement pareil quand l'email n'existe pas (le fournisseur échoue)", async () => {
    const exists = await requestPasswordReset({ email: 'a@b.co', turnstile_token: 't' }, IP, rdeps);
    rdeps.sendReset.mockRejectedValue(new Error('User not found'));
    const unknown = await requestPasswordReset(
      { email: 'zz@b.co', turnstile_token: 't' },
      IP,
      rdeps,
    );
    expect(unknown).toEqual(exists);
  });

  it('jeton Turnstile vide : TURNSTILE_FAILED 400 sans envoi ni appel réseau', async () => {
    const err = await failure(
      requestPasswordReset({ email: 'a@b.co', turnstile_token: '' }, IP, rdeps),
    );
    expect(err.code).toBe('TURNSTILE_FAILED');
    expect(err.status).toBe(400);
    expect(rdeps.sendReset).not.toHaveBeenCalled();
  });

  it('le jeton Turnstile est transmis tel quel à sendReset (Supabase le vérifie, pas de siteverify en plus)', async () => {
    expect('verifyTurnstile' in rdeps).toBe(false);
    await requestPasswordReset({ email: 'a@b.co', turnstile_token: 'jeton-xyz' }, IP, rdeps);
    expect(rdeps.sendReset).toHaveBeenCalledWith('a@b.co', 'jeton-xyz');
  });

  it("n'attend pas l'envoi avant de répondre : même durée que l'email existe ou non", async () => {
    rdeps.sendReset.mockImplementation(() => new Promise<void>(() => {})); // envoi qui ne finit jamais
    await expect(
      requestPasswordReset({ email: 'a@b.co', turnstile_token: 't' }, IP, rdeps),
    ).resolves.toEqual({ ok: true });
    expect(rdeps.sendReset).toHaveBeenCalledWith('a@b.co', 't');
  });

  it("un envoi qui échoue après coup n'est ni visible ni une erreur non gérée", async () => {
    rdeps.sendReset.mockRejectedValue(new Error('User not found'));
    await expect(
      requestPasswordReset({ email: 'zz@b.co', turnstile_token: 't' }, IP, rdeps),
    ).resolves.toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 10));
  });

  it('5 demandes par heure et par IP, la 6e : RATE_LIMITED 429 avec délai, aucun email envoyé', async () => {
    for (let i = 0; i < 5; i++)
      await requestPasswordReset({ email: `u${i}@b.co`, turnstile_token: 't' }, IP, rdeps);
    rdeps.sendReset.mockClear();
    const err = await failure(
      requestPasswordReset({ email: 'u9@b.co', turnstile_token: 't' }, IP, rdeps),
    );
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.details?.retry_after_seconds).toBeGreaterThan(0);
    expect(rdeps.sendReset).not.toHaveBeenCalled();
  });

  it('5 demandes par heure et par email, depuis des IP différentes (casse ignorée)', async () => {
    for (let i = 0; i < 5; i++)
      await requestPasswordReset(
        { email: i % 2 ? 'Cible@B.co' : 'cible@b.co', turnstile_token: 't' },
        `198.51.100.${i + 1}`,
        rdeps,
      );
    const err = await failure(
      requestPasswordReset({ email: 'cible@b.co', turnstile_token: 't' }, '198.51.100.99', rdeps),
    );
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('la réponse reste identique pour un email connu et inconnu, plafond atteint ou non', async () => {
    const a = await requestPasswordReset({ email: 'a@b.co', turnstile_token: 't' }, IP, rdeps);
    rdeps.sendReset.mockRejectedValue(new Error('User not found'));
    const b = await requestPasswordReset({ email: 'zz@b.co', turnstile_token: 't' }, IP, rdeps);
    expect(b).toEqual(a);
  });

  it("IP 'unknown' : seul le plafond par email s'applique", async () => {
    for (let i = 0; i < 7; i++)
      await requestPasswordReset({ email: `x${i}@b.co`, turnstile_token: 't' }, 'unknown', rdeps);
    expect(rdeps.sendReset).toHaveBeenCalledTimes(7);
    const err = await failure(
      (async () => {
        for (let i = 0; i < 6; i++)
          await requestPasswordReset(
            { email: 'meme@b.co', turnstile_token: 't' },
            'unknown',
            rdeps,
          );
      })(),
    );
    expect(err.code).toBe('RATE_LIMITED');
  });
});
