import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSecurityHeaders } from '@/lib/security-headers';

/**
 * Contrat : buildSecurityHeaders({ isProd, supabaseUrl, sentryDsn? }): { key: string; value: string }[]
 * (module pur, sans import de Next). next.config.ts l'utilise dans headers() pour la source '/(.*)'.
 */

const SUPABASE = 'https://abcd1234.supabase.co';
const DSN = 'https://clepublique@o123456.ingest.de.sentry.io/789';

function headers(over: { isProd?: boolean; sentryDsn?: string; supabaseUrl?: string } = {}) {
  const list = buildSecurityHeaders({
    isProd: true,
    supabaseUrl: SUPABASE,
    sentryDsn: DSN,
    ...over,
  });
  return Object.fromEntries(list.map((h) => [h.key.toLowerCase(), h.value]));
}
function directive(csp: string, name: string): string[] {
  const part = csp.split(';').find((d) => d.trim().startsWith(`${name} `) || d.trim() === name);
  return part ? part.trim().split(/\s+/).slice(1) : [];
}

describe('buildSecurityHeaders (production)', () => {
  const h = headers();
  const csp = h['content-security-policy'] ?? '';

  it('pose les en-têtes simples attendus', () => {
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['permissions-policy']).toBeTruthy();
    expect(h['permissions-policy']).toMatch(/camera=\(\)/);
    expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/);
  });
  it("CSP : pas d'unsafe-eval, objets interdits, pas d'encadrement, formulaires vers soi", () => {
    expect(csp).not.toContain("'unsafe-eval'");
    expect(directive(csp, 'default-src')).toContain("'self'");
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
  });
  it('CSP : autorise le widget Turnstile (script et cadre)', () => {
    expect(directive(csp, 'script-src')).toContain('https://challenges.cloudflare.com');
    expect(directive(csp, 'frame-src')).toContain('https://challenges.cloudflare.com');
  });
  it("CSP : autorise l'API Supabase (https) et Sentry, rien de plus large", () => {
    const connect = directive(csp, 'connect-src');
    expect(connect).toContain("'self'");
    expect(connect).toContain(SUPABASE);
    expect(connect).toContain('https://o123456.ingest.de.sentry.io');
    expect(connect).not.toContain('*');
    expect(connect).not.toContain('https:');
  });
  it('CSP : polices et images du design system (auto-hébergées)', () => {
    expect(directive(csp, 'font-src')).toContain("'self'");
    expect(directive(csp, 'img-src')).toEqual(expect.arrayContaining(["'self'", 'data:']));
    expect(directive(csp, 'style-src')).toContain("'self'");
  });
  it("CSP : aucun joker sur script-src ni 'unsafe-eval' nulle part", () => {
    expect(directive(csp, 'script-src')).not.toContain('*');
    expect(directive(csp, 'script-src')).not.toContain('https:');
  });
  it('sans DSN Sentry : aucune adresse Sentry dans la CSP', () => {
    const noSentry = headers({ sentryDsn: '' })['content-security-policy'] ?? '';
    expect(noSentry).not.toContain('sentry.io');
  });
});

describe('buildSecurityHeaders (développement)', () => {
  it("n'envoie pas HSTS et reste utilisable en local (CSP présente)", () => {
    const h = headers({ isProd: false, supabaseUrl: 'http://127.0.0.1:54321' });
    expect(h['strict-transport-security']).toBeUndefined();
    expect(h['content-security-policy']).toContain('http://127.0.0.1:54321');
    expect(h['x-content-type-options']).toBe('nosniff');
  });
});

describe('next.config.ts', () => {
  it('déclare headers() avec buildSecurityHeaders pour toutes les pages', () => {
    const src = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
    expect(src).toMatch(/buildSecurityHeaders/);
    expect(src).toMatch(/async headers\s*\(/);
    expect(src).toMatch(/source:\s*'\/\(\.\*\)'/);
  });
});

describe('zone privée : Cache-Control no-store', () => {
  it('chaque adresse privée (FR et EN) reçoit no-store', async () => {
    const { buildPrivateCacheRules } = await import('@/lib/security-headers');
    const rules = buildPrivateCacheRules();
    const sources = rules.map((rule) => rule.source);
    expect(sources).toContain('/fr/tableau-de-bord');
    expect(sources).toContain('/en/dashboard');
    for (const rule of rules) {
      expect(rule.headers).toEqual([
        { key: 'Cache-Control', value: expect.stringContaining('no-store') },
      ]);
    }
  });
  it('reste aligné sur les adresses traduites du routage', async () => {
    const { PRIVATE_PATHS } = await import('@/lib/security-headers');
    const { pathnames } = await import('@/i18n/routing');
    const translated = Object.values(pathnames).map((p) => `${p.fr}|${p.en}`);
    for (const [fr, en] of PRIVATE_PATHS) expect(translated).toContain(`${fr}|${en}`);
  });
  it("les pages publiques et de compte n'ont pas no-store", async () => {
    const { buildPrivateCacheRules } = await import('@/lib/security-headers');
    const sources = buildPrivateCacheRules().map((rule) => rule.source);
    for (const open of ['/fr', '/fr/connexion', '/fr/inscription', '/en/login', '/fr/services']) {
      expect(sources).not.toContain(open);
    }
  });
});

describe('captures de tickets et compression (phase 9)', () => {
  const csp = headers()['content-security-policy'] ?? '';
  it('img-src autorise l’origine Supabase précise, jamais https:', () => {
    const img = directive(csp, 'img-src');
    expect(img).toContain(SUPABASE);
    expect(img).not.toContain('https:');
    expect(img).not.toContain('*');
  });
  it('worker-src autorise self et blob: seulement', () => {
    expect(directive(csp, 'worker-src').sort()).toEqual(["'self'", 'blob:']);
  });
  it('sans adresse Supabase valide, img-src ne reçoit pas de valeur vide', () => {
    const img = directive(headers({ supabaseUrl: '' })['content-security-policy'] ?? '', 'img-src');
    expect(img).toEqual(["'self'", 'data:', 'blob:']);
  });
});
