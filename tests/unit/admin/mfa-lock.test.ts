import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeMfaSupabase } from '../../helpers/fake-mfa-session';
import { memoryStore } from '../../helpers/memory-attempt-store';
import type { AttemptStore } from '@/server/auth/rate-limit';

vi.mock('server-only', () => ({}));
const notify = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: notify.fn }));
const ref = vi.hoisted(() => ({ store: null as AttemptStore | null }));
vi.mock('@/server/db/supabase-admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/server/auth/rate-limit', async (orig) => ({
  ...(await orig<typeof import('@/server/auth/rate-limit')>()),
  createAttemptStore: () => ref.store,
}));

import { confirmDevice, verifyAdminCode } from '@/server/admin/mfa';

/*
 * Faille 3 (securite-admin.md) : verrou du code à 6 chiffres. Module : src/server/admin/mfa.ts, signatures INCHANGÉES
 *   verifyAdminCode(supabase, userId, code) et confirmDevice(supabase, userId, factorId, code)
 * Règle : 5 mauvais codes en 15 min pour un même administrateur (clé `admin-mfa:<id>`) -> les appels suivants
 * lèvent RATE_LIMITED (429) AVANT tout appel à Supabase (ni listFactors, ni challenge, ni verify), même avec le bon code.
 * Un code juste remet le compteur à zéro.
 */

const ADMIN = 'admin-1';
const GOOD = '123456';
const BAD = '000000';

let fake = fakeMfaSupabase();
const spies = () => Object.values(fake.mfa);
const verify = (code: string, userId = ADMIN) => verifyAdminCode(fake.client, userId, code);
const wrong = async (n: number, userId = ADMIN) => {
  for (let i = 0; i < n; i++) {
    await expect(verify(BAD, userId)).rejects.toMatchObject({ code: 'MFA_REQUIRED', status: 401 });
  }
};

beforeEach(() => {
  ref.store = memoryStore().store;
  notify.fn.mockClear();
  fake = fakeMfaSupabase();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('verifyAdminCode : verrou après 5 mauvais codes', () => {
  it('les 5 premiers mauvais codes donnent 401 MFA_REQUIRED, le 6e donne 429 RATE_LIMITED', async () => {
    await wrong(5);
    await expect(verify(BAD)).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });
  });

  it('le verrou ne contacte pas Supabase, même avec le bon code', async () => {
    await wrong(5);
    spies().forEach((s) => s.mockClear());
    await expect(verify(GOOD)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    spies().forEach((s) => expect(s).not.toHaveBeenCalled());
  });

  it('un bon code avant le verrou passe', async () => {
    await wrong(4);
    await expect(verify(GOOD)).resolves.toBeUndefined();
  });

  it('un succès remet le compteur à zéro : 4 échecs, succès, puis encore 5 échecs avant le verrou', async () => {
    await wrong(4);
    await verify(GOOD);
    await wrong(5);
    await expect(verify(BAD)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('le verrou se lève après 15 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    await wrong(5);
    vi.setSystemTime(new Date('2026-11-16T10:16:00Z'));
    await expect(verify(GOOD)).resolves.toBeUndefined();
  });

  it('le verrou est propre à chaque administrateur', async () => {
    await wrong(5);
    await expect(verify(GOOD, 'admin-2')).resolves.toBeUndefined();
  });

  it('les appels refusés par le verrou ne déclenchent pas de nouvelle alerte Telegram', async () => {
    await wrong(5);
    notify.fn.mockClear();
    for (let i = 0; i < 6; i++) await expect(verify(BAD)).rejects.toMatchObject({ status: 429 });
    expect(notify.fn).not.toHaveBeenCalled();
  });
});

describe('confirmDevice : même verrou (même compteur)', () => {
  it('après 5 mauvais codes, la confirmation d’un appareil est refusée en 429 sans appeler Supabase', async () => {
    await wrong(5);
    spies().forEach((s) => s.mockClear());
    await expect(confirmDevice(fake.client, ADMIN, 'new-factor', GOOD)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
    });
    spies().forEach((s) => expect(s).not.toHaveBeenCalled());
  });
});
