import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const notify = vi.hoisted(() => ({ fn: vi.fn(async () => {}) }));
vi.mock('@/server/providers/telegram', () => ({ notifyOwner: notify.fn }));

import { load } from '../../helpers/admin-db';
import { memoryStore } from '../../helpers/memory-attempt-store';
import { createLoginLimiter, hashIdentifier } from '@/server/auth/rate-limit';
import { ApiError } from '@/server/http/api-error';

/*
 * Alertes provocables (relecture 11.5 point 2). Module : src/server/admin/login.ts, signature de adminLogin inchangée.
 *   - une tentative REFUSÉE par le limiteur (AUTH_LOCKED / RATE_LIMITED) n'est ni comptée dans la clé
 *     `admin-login:failures` ni alertée : seules les tentatives que le limiteur laisse passer comptent ;
 *   - UNE seule alerte `admin_login_failed` par fenêtre de 15 min (au 5e échec), pas de 2e alerte au 10e.
 */

const ADMIN_PATH = 'k7q2-test-path-9f3a';
const FAILURES_HASH = hashIdentifier('admin-login:failures');
type Input = {
  identifier: string;
  password: string;
  ip: string;
  turnstile_token: string;
  admin_path: string | undefined;
};
type Mod = { adminLogin: (input: Input, deps: unknown) => Promise<unknown> };

function makeDeps(limiter?: unknown) {
  const mem = memoryStore();
  return {
    mem,
    deps: {
      limiter: limiter ?? { begin: vi.fn(async () => ({ succeed: async () => {} })) },
      findEmailByPhone: vi.fn(async () => null),
      signIn: vi.fn(async () => null),
      isAdmin: vi.fn(async () => false),
      signOut: vi.fn(async () => {}),
      store: mem.store,
    },
  };
}
const attempt = async (deps: unknown, identifier: string): Promise<unknown> =>
  (await load<Mod>('@/server/admin/login'))
    .adminLogin(
      {
        identifier,
        password: 'mauvais-mdp-123',
        ip: '203.0.113.9',
        turnstile_token: 'tok',
        admin_path: ADMIN_PATH,
      },
      deps,
    )
    .then(
      () => null,
      (e: unknown) => e,
    );

beforeEach(() => {
  process.env.ADMIN_PATH = ADMIN_PATH;
  notify.fn.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.ADMIN_PATH;
});

describe('adminLogin : tentatives refusées par le limiteur', () => {
  it('ne sont ni comptées dans admin-login:failures ni alertées (limiteur réel, même identifiant x12)', async () => {
    const { mem, deps } = makeDeps();
    deps.limiter = createLoginLimiter({ store: mem.store });
    const results: unknown[] = [];
    for (let i = 0; i < 12; i++) results.push(await attempt(deps, 'proprietaire@lyonpanel.test'));
    const locked = results.filter((e) => e instanceof ApiError && e.code === 'AUTH_LOCKED');
    const passed = results.filter((e) => e instanceof ApiError && e.code === 'INVALID_CREDENTIALS');
    expect(locked.length).toBeGreaterThan(0);
    const counted = mem.rows.filter((r) => r.identifierHash === FAILURES_HASH && !r.success);
    expect(counted).toHaveLength(passed.length);
    expect(notify.fn).not.toHaveBeenCalled();
  });

  it('un limiteur qui refuse toujours (RATE_LIMITED) : rien d’enregistré, aucune alerte', async () => {
    const refusing = {
      begin: vi.fn(async () => {
        throw new ApiError('RATE_LIMITED', 429, { retry_after_seconds: 60 });
      }),
    };
    const { mem, deps } = makeDeps(refusing);
    for (let i = 0; i < 10; i++) {
      expect(await attempt(deps, `id-${i}@lyonpanel.test`)).toMatchObject({ code: 'RATE_LIMITED' });
    }
    expect(mem.rows.filter((r) => r.identifierHash === FAILURES_HASH)).toHaveLength(0);
    expect(notify.fn).not.toHaveBeenCalled();
  });
});

describe('adminLogin : une seule alerte par fenêtre de 15 minutes', () => {
  it('12 échecs (identifiants différents) : une alerte au 5e, aucune autre', async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 12; i++) await attempt(deps, `id-${i}@lyonpanel.test`);
    expect(notify.fn).toHaveBeenCalledTimes(1);
    expect(notify.fn).toHaveBeenCalledWith('admin_login_failed', { failures: 5 });
  });

  it('une nouvelle fenêtre (16 min plus tard) permet une nouvelle alerte', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    const { deps } = makeDeps();
    for (let i = 0; i < 6; i++) await attempt(deps, `a-${i}@lyonpanel.test`);
    expect(notify.fn).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-11-16T10:16:00Z'));
    for (let i = 0; i < 5; i++) await attempt(deps, `b-${i}@lyonpanel.test`);
    expect(notify.fn).toHaveBeenCalledTimes(2);
  });
});
