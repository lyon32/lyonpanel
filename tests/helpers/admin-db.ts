import { randomInt } from 'node:crypto';
import { vi } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import { adminClient } from '../db/helpers/client';

/* Aides communes des tests de l'admin (phase 11) : vraie base locale, session Supabase simulée. */

/** Charge un module par son chemin : un module absent fait échouer CE test, pas tout le fichier. */
export const load = <T = Record<string, unknown>>(path: string): Promise<T> =>
  import(/* @vite-ignore */ path) as Promise<T>;

/**
 * Un seul administrateur est possible (index unique) : réutilise l'existant, sinon en crée un.
 * `release()` retire le droit admin seulement si ce fichier de test l'avait donné.
 */
export async function ensureAdmin(): Promise<{ id: string; release: () => Promise<void> }> {
  const db = adminClient();
  const { data } = await db.from('profiles').select('id').eq('is_admin', true);
  const first = data?.[0];
  if (first) return { id: first.id as string, release: async () => {} };
  const u = await makeUser();
  await db.from('profiles').update({ is_admin: true }).eq('id', u.id);
  return {
    id: u.id,
    release: async () => {
      await db.from('profiles').update({ is_admin: false }).eq('id', u.id);
      await removeUser(u.id);
    },
  };
}

type Factor = { id: string; factor_type: 'totp'; status: 'verified' | 'unverified' };
export type FakeSessionOptions = {
  current?: 'aal1' | 'aal2';
  next?: 'aal1' | 'aal2';
  factors?: Factor[];
  /** Code accepté, par appareil (id du facteur). */
  validCodes?: Record<string, string>;
};

/** Faux client de session : getUser, niveau MFA (aal1/aal2) et facteurs TOTP. userId null = visiteur. */
export function fakeSession(userId: string | null, o: FakeSessionOptions = {}) {
  const factors = o.factors ?? [{ id: 'f1', factor_type: 'totp', status: 'verified' }];
  const validCodes = o.validCodes ?? { f1: '123456' };
  const verify = vi.fn(async ({ factorId, code }: { factorId: string; code: string }) =>
    validCodes[factorId] === code
      ? { data: { access_token: 'x' }, error: null }
      : {
          data: null,
          error: { message: 'Invalid TOTP code entered', code: 'mfa_verification_failed' },
        },
  );
  return {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: o.current ?? 'aal2', nextLevel: o.next ?? 'aal2' },
          error: null,
        }),
        listFactors: async () => ({
          data: { totp: factors.filter((f) => f.status === 'verified'), all: factors },
          error: null,
        }),
        challenge: vi.fn(async ({ factorId }: { factorId: string }) => ({
          data: { id: `challenge-${factorId}` },
          error: null,
        })),
        verify,
      },
    },
  };
}

/** Date de départ aléatoire (an 2100 à 2899) : les lignes de test ne se mélangent jamais aux autres tests. */
export function isolatedNow(): Date {
  return new Date(Date.UTC(2100 + randomInt(0, 800), 2, 15, 12, 30, 0));
}
/**
 * Comme isolatedNow, mais vérifie que la fenêtre des 41 derniers jours est vide (commandes, recharges,
 * profils) : des lignes laissées par d'anciens passages ne doublent jamais les totaux.
 */
export async function freeWindowNow(): Promise<Date> {
  const db = adminClient();
  for (let i = 0; i < 50; i++) {
    const now = new Date(
      Date.UTC(2100 + randomInt(0, 800), randomInt(0, 12), randomInt(1, 28), randomInt(0, 24), 30),
    );
    const from = new Date(now.getTime() - 41 * 86_400_000).toISOString();
    const to = new Date(now.getTime() + 86_400_000).toISOString();
    const counts = await Promise.all(
      ['orders', 'payments', 'profiles'].map((t) =>
        db
          .from(t)
          .select('id', { count: 'exact', head: true })
          .gte('created_at', from)
          .lt('created_at', to),
      ),
    );
    if (counts.every((c) => c.count === 0)) return now;
  }
  throw new Error('Aucune fenêtre libre trouvée pour les statistiques');
}
export const hoursAgo = (now: Date, h: number): string =>
  new Date(now.getTime() - h * 3_600_000).toISOString();
export const daysAgo = (now: Date, d: number): string => hoursAgo(now, d * 24);
