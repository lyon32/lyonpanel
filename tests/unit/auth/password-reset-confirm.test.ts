import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resetPassword, type ResetPasswordDeps } from '@/server/auth/password-reset-confirm';
import { ApiError } from '@/server/http/api-error';

const GOOD = 'Cf9!vQ2#zLm7-rTa84';
const WHO = { userId: 'u1', email: 'jean@lyonpanel.test' };

/**
 * Contrat (le lien n'est jamais perdu pour un mot de passe refusé, sans migration) :
 *   1. mot de passe commun : refus AVANT tout (aucune dépendance appelée) ;
 *   2. who = (await getRecoverySession()) ?? (await exchangeRecoveryToken(token)) ; null -> TOKEN_INVALID.
 *      Si le cookie de récupération est présent, le jeton de l'entrée est ignoré.
 *      exchangeRecoveryToken fait verifyOtp UNE fois et pose le cookie httpOnly de récupération (15 min).
 *   3. refus (égal à l'email, même que l'actuel) : VALIDATION_ERROR, session de récupération intacte ;
 *   4. updatePassword(userId, mot de passe) puis signOutAll() (échec journalisé, jamais une 500),
 *      puis clearRecoverySession() dans tous les cas après un changement réussi.
 *      Si updatePassword échoue : erreur réelle, session conservée pour réessayer.
 */
function makeDeps(over: Partial<ResetPasswordDeps> = {}) {
  return {
    getRecoverySession: vi.fn<ResetPasswordDeps['getRecoverySession']>(async () => null),
    exchangeRecoveryToken: vi.fn<ResetPasswordDeps['exchangeRecoveryToken']>(async () => WHO),
    isCurrentPassword: vi.fn<ResetPasswordDeps['isCurrentPassword']>(async () => false),
    updatePassword: vi.fn<ResetPasswordDeps['updatePassword']>(async () => {}),
    signOutAll: vi.fn<ResetPasswordDeps['signOutAll']>(async () => {}),
    clearRecoverySession: vi.fn<ResetPasswordDeps['clearRecoverySession']>(async () => {}),
    ...over,
  } satisfies ResetPasswordDeps;
}

async function fieldError(promise: Promise<unknown>) {
  const e = await promise.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ApiError);
  return (e as ApiError).details?.fields;
}

describe('resetPassword : premier envoi avec le lien', () => {
  it('échange le jeton, change le mot de passe, ferme toutes les sessions et efface la récupération', async () => {
    const deps = makeDeps();
    await expect(resetPassword({ token: 't', new_password: GOOD }, deps)).resolves.toEqual({
      ok: true,
    });
    expect(deps.exchangeRecoveryToken).toHaveBeenCalledWith('t');
    expect(deps.updatePassword).toHaveBeenCalledWith('u1', GOOD);
    expect(deps.signOutAll).toHaveBeenCalledTimes(1);
    expect(deps.clearRecoverySession).toHaveBeenCalledTimes(1);
  });

  it('ordre : mise à jour, fermeture des sessions, puis effacement de la récupération', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      updatePassword: vi.fn(async () => void order.push('update')),
      signOutAll: vi.fn(async () => void order.push('signOutAll')),
      clearRecoverySession: vi.fn(async () => void order.push('clear')),
    });
    await resetPassword({ token: 't', new_password: GOOD }, deps);
    expect(order).toEqual(['update', 'signOutAll', 'clear']);
  });

  it('jeton invalide ou expiré : TOKEN_INVALID, rien de modifié', async () => {
    const deps = makeDeps({ exchangeRecoveryToken: vi.fn(async () => null) });
    expect(await fieldError(resetPassword({ token: 'x', new_password: GOOD }, deps))).toEqual({
      token: 'TOKEN_INVALID',
    });
    expect(deps.updatePassword).not.toHaveBeenCalled();
    expect(deps.signOutAll).not.toHaveBeenCalled();
    expect(deps.clearRecoverySession).not.toHaveBeenCalled();
  });

  it('mot de passe trop courant : refusé avant toute dépendance (le lien reste intact)', async () => {
    const deps = makeDeps();
    expect(await fieldError(resetPassword({ token: 't', new_password: 'password' }, deps))).toEqual(
      { new_password: 'PASSWORD_TOO_COMMON' },
    );
    expect(deps.getRecoverySession).not.toHaveBeenCalled();
    expect(deps.exchangeRecoveryToken).not.toHaveBeenCalled();
  });
});

describe('resetPassword : un refus ne perd pas le lien', () => {
  it("mot de passe égal à l'email : PASSWORD_TOO_WEAK, récupération conservée, aucune mise à jour", async () => {
    const deps = makeDeps();
    expect(
      await fieldError(resetPassword({ token: 't', new_password: 'jean@lyonpanel.test' }, deps)),
    ).toEqual({ new_password: 'PASSWORD_TOO_WEAK' });
    expect(deps.updatePassword).not.toHaveBeenCalled();
    expect(deps.clearRecoverySession).not.toHaveBeenCalled();
    expect(deps.signOutAll).not.toHaveBeenCalled();
  });

  it('même mot de passe que l’actuel : PASSWORD_SAME_AS_CURRENT, récupération conservée', async () => {
    const deps = makeDeps({ isCurrentPassword: vi.fn(async () => true) });
    expect(await fieldError(resetPassword({ token: 't', new_password: GOOD }, deps))).toEqual({
      new_password: 'PASSWORD_SAME_AS_CURRENT',
    });
    expect(deps.updatePassword).not.toHaveBeenCalled();
    expect(deps.clearRecoverySession).not.toHaveBeenCalled();
  });

  it('refus puis nouvel essai avec le MÊME lien : un seul échange du jeton, le second essai réussit', async () => {
    let cookie: typeof WHO | null = null; // simule le cookie de récupération
    const deps = makeDeps({
      getRecoverySession: vi.fn(async () => cookie),
      exchangeRecoveryToken: vi.fn(async () => {
        cookie = WHO;
        return WHO;
      }),
      clearRecoverySession: vi.fn(async () => {
        cookie = null;
      }),
    });
    expect(
      await fieldError(resetPassword({ token: 't', new_password: 'jean@lyonpanel.test' }, deps)),
    ).toEqual({ new_password: 'PASSWORD_TOO_WEAK' });
    await expect(resetPassword({ token: 't', new_password: GOOD }, deps)).resolves.toEqual({
      ok: true,
    });
    expect(deps.exchangeRecoveryToken).toHaveBeenCalledTimes(1);
    expect(deps.updatePassword).toHaveBeenCalledWith('u1', GOOD);
    expect(cookie).toBeNull();
  });

  it("cookie de récupération présent : le jeton de l'entrée est ignoré (pas de second échange)", async () => {
    const deps = makeDeps({ getRecoverySession: vi.fn(async () => WHO) });
    await resetPassword({ token: 'ancien-jeton', new_password: GOOD }, deps);
    expect(deps.exchangeRecoveryToken).not.toHaveBeenCalled();
    expect(deps.updatePassword).toHaveBeenCalledWith('u1', GOOD);
  });

  it('lien rejoué après un succès (cookie effacé, jeton déjà consommé) : TOKEN_INVALID', async () => {
    const deps = makeDeps({
      getRecoverySession: vi.fn(async () => null),
      exchangeRecoveryToken: vi.fn(async () => null),
    });
    expect(await fieldError(resetPassword({ token: 't', new_password: GOOD }, deps))).toEqual({
      token: 'TOKEN_INVALID',
    });
    expect(deps.updatePassword).not.toHaveBeenCalled();
  });
});

describe('resetPassword : échecs techniques', () => {
  it('signOutAll échoue : succès quand même, erreur journalisée sans secret, récupération effacée', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const deps = makeDeps({
      signOutAll: vi.fn(async () => {
        throw new Error('AuthSessionMissingError: jeton-secret-xyz');
      }),
    });
    await expect(
      resetPassword({ token: 'jeton-secret-xyz', new_password: GOOD }, deps),
    ).resolves.toEqual({ ok: true });
    expect(deps.updatePassword).toHaveBeenCalledWith('u1', GOOD);
    expect(deps.clearRecoverySession).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify([...err.mock.calls, ...warn.mock.calls]);
    expect(err.mock.calls.length + warn.mock.calls.length).toBeGreaterThan(0);
    expect(logged).not.toContain(GOOD);
    expect(logged).not.toContain('jeton-secret-xyz');
    err.mockRestore();
    warn.mockRestore();
  });

  it('updatePassword échoue : vraie erreur, aucune fermeture de session, récupération conservée', async () => {
    const deps = makeDeps({
      updatePassword: vi.fn(async () => {
        throw new Error('db down');
      }),
    });
    await expect(resetPassword({ token: 't', new_password: GOOD }, deps)).rejects.toThrow(
      'db down',
    );
    expect(deps.signOutAll).not.toHaveBeenCalled();
    expect(deps.clearRecoverySession).not.toHaveBeenCalled();
  });
});
