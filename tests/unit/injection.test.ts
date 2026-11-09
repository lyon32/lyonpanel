import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@/lib/schemas/auth';

const XSS = '<script>alert(1)</script>';
const valid = {
  email: 'client-1@lyonpanel.test',
  password: 'Cf9!vQ2#zLm7-rTa84',
  phone: '+237600000001',
  country: 'CM',
  display_currency: 'XAF',
  language: 'fr',
  turnstile_token: 'tok',
};

function fieldsInError(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}) {
  return (result.error?.issues ?? []).map((i) => String(i.path[0]));
}

describe('schémas Zod : un script est refusé', () => {
  it("email d'inscription", () => {
    const r = registerSchema.safeParse({ ...valid, email: `${XSS}@lyonpanel.test` });
    expect(r.success).toBe(false);
    expect(fieldsInError(r)).toContain('email');
  });
  it("téléphone d'inscription", () => {
    const r = registerSchema.safeParse({ ...valid, phone: XSS });
    expect(r.success).toBe(false);
    expect(fieldsInError(r)).toContain('phone');
  });
  it('code de parrainage : lettres, chiffres, tiret et souligné seulement', () => {
    for (const bad of [XSS, "x' OR 1=1 --", 'abc def', 'a/b', '%3Cscript%3E']) {
      const r = registerSchema.safeParse({ ...valid, referral_code: bad });
      expect(r.success, bad).toBe(false);
      expect(fieldsInError(r), bad).toContain('referral_code');
    }
    expect(registerSchema.safeParse({ ...valid, referral_code: 'ABC_123-x' }).success).toBe(true);
  });
  it('identifiant de connexion', () => {
    const r = loginSchema.safeParse({
      identifier: XSS,
      password: 'x',
      turnstile_token: 'tok',
    });
    expect(r.success).toBe(false);
  });
  it('email de mot de passe oublié', () => {
    expect(
      forgotPasswordSchema.safeParse({ email: `${XSS}@b.co`, turnstile_token: 'tok' }).success,
    ).toBe(false);
  });
  it('jeton de réinitialisation : une chaîne vide ou démesurée est refusée', () => {
    expect(resetPasswordSchema.safeParse({ token: '', new_password: valid.password }).success).toBe(
      false,
    );
    expect(
      resetPasswordSchema.safeParse({ token: 'a'.repeat(5000), new_password: valid.password })
        .success,
    ).toBe(false);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('code serveur : aucune requête assemblée par concaténation', () => {
  const files = sourceFiles(join(process.cwd(), 'src', 'server'));
  const templates = (src: string) => src.match(/`[^`]*`/g) ?? [];
  const SQL =
    /\b(select\s[\s\S]+\sfrom|insert\s+into|update\s+\w+\s+set|delete\s+from|where\s+\w+\s*(=|in\b))/i;

  it('trouve bien des fichiers à analyser', () => {
    expect(files.length).toBeGreaterThan(5);
  });
  it('aucune chaîne SQL avec ${...} dans src/server', () => {
    const bad = files.flatMap((f) =>
      templates(readFileSync(f, 'utf8'))
        .filter((t) => t.includes('${') && SQL.test(t))
        .map((t) => `${f}: ${t.slice(0, 60)}`),
    );
    expect(bad).toEqual([]);
  });
  it('aucune concaténation "+" avec un mot SQL dans src/server', () => {
    const bad = files.filter((f) =>
      /['"]\s*(select|insert|update|delete)\b[^'"]*['"]\s*\+/i.test(readFileSync(f, 'utf8')),
    );
    expect(bad).toEqual([]);
  });
  it('aucun filtre PostgREST (.or / .filter / .not) construit avec ${...}', () => {
    const bad = files.filter((f) =>
      /\.(or|filter|not)\(\s*`[^`]*\$\{/.test(readFileSync(f, 'utf8')),
    );
    expect(bad).toEqual([]);
  });
  it("n'envoie jamais de SQL brut au client Supabase (pas de .rpc avec une chaîne construite)", () => {
    const bad = files.filter((f) => /\.rpc\(\s*`/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
