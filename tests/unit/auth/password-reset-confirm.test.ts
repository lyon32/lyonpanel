import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resetPassword, type ResetPasswordDeps } from '@/server/auth/password-reset-confirm';
import { ApiError } from '@/server/http/api-error';

const GOOD = 'Cf9!vQ2#zLm7-rTa84';

function makeDeps(over: Partial<ResetPasswordDeps> = {}) {
  return {
    // Lecture du jeton SANS le consommer (le lien reste utilisable si le mot de passe est refusé).
    peekRecoveryToken: vi.fn<ResetPasswordDeps['peekRecoveryToken']>(async () => ({
      userId: 'u1',
      email: 'jean@lyonpanel.test',
    })),
    // Consommation du jeton (usage unique) : seulement quand tout le reste est validé.
    verifyRecoveryToken: vi.fn<ResetPasswordDeps['verifyRecoveryToken']>(async () => ({
      userId: 'u1',
      email: 'jean@lyonpanel.test',
      accessToken: 'at',
    })),
    isCurrentPassword: vi.fn<ResetPasswordDeps['isCurrentPassword']>(async () => false),
    updatePassword: vi.fn<ResetPasswordDeps['updatePassword']>(async () => {}),
    signOutAll: vi.fn<ResetPasswordDeps['signOutAll']>(async () => {}),
    ...over,
  } satisfies ResetPasswordDeps;
}

async function fieldError(promise: Promise<unknown>) {
  const e = await promise.catch((x: unknown) => x);
  expect(e).toBeInstanceOf(ApiError);
  return (e as ApiError).details?.fields;
}

describe('resetPassword', () => {
  it('change le mot de passe puis déconnecte toutes les sessions', async () => {
    const deps = makeDeps();
    await expect(resetPassword({ token: 't', new_password: GOOD }, deps)).resolves.toEqual({
      ok: true,
    });
    expect(deps.updatePassword).toHaveBeenCalledWith('u1', GOOD);
    expect(deps.signOutAll).toHaveBeenCalledWith('at');
  });

  it('refuse un jeton invalide ou expiré sans rien modifier', async () => {
    const deps = makeDeps({ peekRecoveryToken: vi.fn(async () => null) });
    expect(await fieldError(resetPassword({ token: 'x', new_password: GOOD }, deps))).toEqual({
      token: 'TOKEN_INVALID',
    });
    expect(deps.updatePassword).not.toHaveBeenCalled();
    expect(deps.verifyRecoveryToken).not.toHaveBeenCalled();
  });

  it('refuse le mot de passe courant', async () => {
    const deps = makeDeps({ isCurrentPassword: vi.fn(async () => true) });
    expect(await fieldError(resetPassword({ token: 't', new_password: GOOD }, deps))).toEqual({
      new_password: 'PASSWORD_SAME_AS_CURRENT',
    });
    expect(deps.updatePassword).not.toHaveBeenCalled();
    expect(deps.verifyRecoveryToken).not.toHaveBeenCalled(); // le lien n'est pas brûlé
  });

  it("refuse un mot de passe égal à l'email du compte", async () => {
    const deps = makeDeps();
    const fields = await fieldError(
      resetPassword({ token: 't', new_password: 'jean@lyonpanel.test' }, deps),
    );
    expect(fields).toEqual({ new_password: 'PASSWORD_TOO_WEAK' });
    expect(deps.verifyRecoveryToken).not.toHaveBeenCalled(); // le lien n'est pas brûlé
  });

  it('refuse un mot de passe trop courant avant même de consommer le jeton', async () => {
    const deps = makeDeps();
    const fields = await fieldError(resetPassword({ token: 't', new_password: 'password' }, deps));
    expect(fields).toEqual({ new_password: 'PASSWORD_TOO_COMMON' });
    expect(deps.verifyRecoveryToken).not.toHaveBeenCalled();
  });

  it('consomme le jeton une seule fois, après les contrôles et avant de changer le mot de passe', async () => {
    const order: string[] = [];
    const deps = makeDeps({
      isCurrentPassword: vi.fn(async () => {
        order.push('isCurrent');
        return false;
      }),
      verifyRecoveryToken: vi.fn(async () => {
        order.push('consume');
        return { userId: 'u1', email: 'jean@lyonpanel.test', accessToken: 'at' };
      }),
      updatePassword: vi.fn(async () => {
        order.push('update');
      }),
    });
    await resetPassword({ token: 't', new_password: GOOD }, deps);
    expect(order).toEqual(['isCurrent', 'consume', 'update']);
    expect(deps.verifyRecoveryToken).toHaveBeenCalledTimes(1);
  });

  it('jeton consommé entre-temps : TOKEN_INVALID, mot de passe inchangé, sessions intactes', async () => {
    const deps = makeDeps({ verifyRecoveryToken: vi.fn(async () => null) });
    expect(await fieldError(resetPassword({ token: 't', new_password: GOOD }, deps))).toEqual({
      token: 'TOKEN_INVALID',
    });
    expect(deps.updatePassword).not.toHaveBeenCalled();
    expect(deps.signOutAll).not.toHaveBeenCalled();
  });

  describe('échec de la fermeture des sessions (signOutAll)', () => {
    it('le mot de passe est déjà changé : la réinitialisation répond quand même succès', async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const deps = makeDeps({
        signOutAll: vi.fn(async () => {
          throw new Error('AuthSessionMissingError: Auth session missing!');
        }),
      });
      await expect(resetPassword({ token: 't', new_password: GOOD }, deps)).resolves.toEqual({
        ok: true,
      });
      expect(deps.updatePassword).toHaveBeenCalledWith('u1', GOOD);
      expect(deps.signOutAll).toHaveBeenCalledTimes(1);
      err.mockRestore();
    });

    it("l'erreur est journalisée (console.error ou warn) sans mot de passe, jeton ni accessToken", async () => {
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const deps = makeDeps({
        signOutAll: vi.fn(async () => {
          throw new Error('Auth session missing');
        }),
      });
      await resetPassword({ token: 'jeton-secret-xyz', new_password: GOOD }, deps);
      const logged = JSON.stringify([...err.mock.calls, ...warn.mock.calls]);
      expect(err.mock.calls.length + warn.mock.calls.length).toBeGreaterThan(0);
      for (const secret of [GOOD, 'jeton-secret-xyz', 'at'])
        expect(logged).not.toContain(`"${secret}"`);
      expect(logged).not.toContain(GOOD);
      expect(logged).not.toContain('jeton-secret-xyz');
      err.mockRestore();
      warn.mockRestore();
    });

    it('un échec de updatePassword reste une vraie erreur et ne ferme aucune session', async () => {
      const deps = makeDeps({
        updatePassword: vi.fn(async () => {
          throw new Error('db down');
        }),
      });
      await expect(resetPassword({ token: 't', new_password: GOOD }, deps)).rejects.toThrow(
        'db down',
      );
      expect(deps.signOutAll).not.toHaveBeenCalled();
    });
  });
});
