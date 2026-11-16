import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * Accès admin, parties sans base (phase 11). Modules attendus :
 *   src/server/auth/admin-path.ts     isAdminSegment(segment, adminPath): boolean
 *   src/server/auth/admin-session.ts  ADMIN_SESSION_HOURS = 12 ; isAdminSessionExpired(signedInAt, now?): boolean
 *   src/server/admin/mfa.ts           mfaSetupStatus(factors): { verified, needsMoreDevices, canEnrollMore }
 */
const load = <T>(p: string) => import(/* @vite-ignore */ p) as Promise<T>;
const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const slash = (p: string) => p.replace(/\\/g, '/');

describe('isAdminSegment : l’adresse secrète', () => {
  const SECRET = 'k7q2-9f3a1c5d8e';
  type Mod = { isAdminSegment: (s: string | undefined, p: string | undefined) => boolean };
  const fn = async () => (await load<Mod>('@/server/auth/admin-path')).isAdminSegment;

  it('accepte exactement l’adresse secrète', async () => {
    expect((await fn())(SECRET, SECRET)).toBe(true);
  });
  it('refuse /admin et toute autre adresse', async () => {
    const f = await fn();
    for (const s of ['admin', 'login', 'dashboard', 'wp-admin', '', undefined]) {
      expect(f(s, SECRET)).toBe(false);
    }
  });
  it('est sensible à la casse et refuse une adresse presque identique', async () => {
    const f = await fn();
    expect(f(SECRET.toUpperCase(), SECRET)).toBe(false);
    expect(f(`${SECRET}x`, SECRET)).toBe(false);
    expect(f(SECRET.slice(0, -1), SECRET)).toBe(false);
  });
  it('sans ADMIN_PATH (absent ou vide) : tout est refusé, même un segment vide', async () => {
    const f = await fn();
    expect(f('', '')).toBe(false);
    expect(f('', undefined)).toBe(false);
    expect(f('admin', undefined)).toBe(false);
    expect(f('undefined', undefined)).toBe(false);
  });
});

describe('session admin de 12 h', () => {
  type Mod = {
    ADMIN_SESSION_HOURS: number;
    isAdminSessionExpired: (signedInAt: string | Date, now?: Date) => boolean;
  };
  const NOW = new Date('2026-11-16T20:00:00Z');
  const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);

  it('la durée vaut 12 h', async () => {
    expect((await load<Mod>('@/server/auth/admin-session')).ADMIN_SESSION_HOURS).toBe(12);
  });
  it('valide à 11 h 59, expirée à 12 h 01', async () => {
    const { isAdminSessionExpired } = await load<Mod>('@/server/auth/admin-session');
    expect(isAdminSessionExpired(ago(11 * 60 + 59), NOW)).toBe(false);
    expect(isAdminSessionExpired(ago(12 * 60 + 1), NOW)).toBe(true);
  });
  it('accepte une date texte ISO et refuse une date illisible (considérée expirée)', async () => {
    const { isAdminSessionExpired } = await load<Mod>('@/server/auth/admin-session');
    expect(isAdminSessionExpired(ago(60).toISOString(), NOW)).toBe(false);
    expect(isAdminSessionExpired('pas-une-date', NOW)).toBe(true);
  });
  it('la configuration Supabase impose 12 h (auth.sessions timebox) et active le TOTP', () => {
    const toml = read('supabase/config.toml');
    expect(toml).toMatch(/^timebox\s*=\s*"12h"/m);
    expect(toml).toMatch(/\[auth\.mfa\.totp\][^[]*enroll_enabled\s*=\s*true/);
    expect(toml).toMatch(/\[auth\.mfa\.totp\][^[]*verify_enabled\s*=\s*true/);
  });
});

describe('mfaSetupStatus : 2 appareils TOTP', () => {
  type F = { id: string; factor_type: string; status: string };
  type Mod = {
    mfaSetupStatus: (f: F[]) => {
      verified: number;
      needsMoreDevices: boolean;
      canEnrollMore: boolean;
    };
  };
  const totp = (id: string, status = 'verified'): F => ({ id, factor_type: 'totp', status });
  const status = async (f: F[]) => (await load<Mod>('@/server/admin/mfa')).mfaSetupStatus(f);

  it('aucun appareil : il en faut 2, on peut en ajouter', async () => {
    expect(await status([])).toEqual({ verified: 0, needsMoreDevices: true, canEnrollMore: true });
  });
  it('un seul appareil vérifié : l’installation n’est pas finie', async () => {
    expect(await status([totp('a')])).toEqual({
      verified: 1,
      needsMoreDevices: true,
      canEnrollMore: true,
    });
  });
  it('deux appareils vérifiés : terminé, un 3e est refusé', async () => {
    expect(await status([totp('a'), totp('b')])).toEqual({
      verified: 2,
      needsMoreDevices: false,
      canEnrollMore: false,
    });
  });
  it('un appareil non vérifié (QR scanné sans code) ne compte pas', async () => {
    expect((await status([totp('a'), totp('b', 'unverified')])).verified).toBe(1);
  });
  it('ignore les facteurs qui ne sont pas du TOTP', async () => {
    const phone: F = { id: 'p', factor_type: 'phone', status: 'verified' };
    expect((await status([phone, totp('a')])).verified).toBe(1);
  });
});

describe('adresse secrète hors robots.txt et hors sitemap', () => {
  afterEach(() => {
    delete process.env.ADMIN_PATH;
  });
  it('robots.txt ne cite ni ADMIN_PATH ni « admin »', async () => {
    process.env.ADMIN_PATH = 'k7q2-9f3a1c5d8e';
    const { default: robots } = await import('@/app/robots');
    const text = JSON.stringify(robots()).toLowerCase();
    expect(text).not.toContain('k7q2-9f3a1c5d8e');
    expect(text).not.toContain('admin');
  });
  it('le code source du sitemap ne lit jamais ADMIN_PATH', () => {
    expect(read('src/app/sitemap.ts')).not.toMatch(/ADMIN_PATH|adminPath/);
  });
});

describe('aucun champ fournisseur hors /admin', () => {
  it('seules les routes /api/v1/admin et l’interface admin importent src/server/admin', () => {
    const offenders = walk(join(root, 'src/app'))
      .filter((p) => /\.(ts|tsx)$/.test(p))
      .filter((p) => !slash(p).includes('/api/v1/admin/'))
      .filter((p) => !slash(p).includes('/[adminPath]/'))
      .filter((p) => /@\/server\/admin\//.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
  it('les composants clients n’importent jamais le code serveur', () => {
    const offenders = walk(join(root, 'src/components'))
      .filter((p) => /\.(ts|tsx)$/.test(p))
      .filter((p) => !slash(p).includes('/components/admin/'))
      .filter((p) => /@\/server\//.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('purge des fichiers orphelins : jamais automatique', () => {
  it('aucune route cron ni tâche planifiée n’appelle la purge', () => {
    const cron = walk(join(root, 'src/app/api/cron'))
      .map((p) => readFileSync(p, 'utf8'))
      .join('\n');
    expect(cron.toLowerCase()).not.toMatch(/purge|orphan/);
    const workers = walk(join(root, 'workers'))
      .filter((p) => /\.(ts|toml|json)$/.test(slash(p)) && !slash(p).includes('node_modules'))
      .map((p) => readFileSync(p, 'utf8'))
      .join('\n');
    expect(workers.toLowerCase()).not.toMatch(/purge|orphan/);
  });
});
