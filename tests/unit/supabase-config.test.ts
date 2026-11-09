import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Lit une clé d'une section TOML exacte (ex. « auth » ou « auth.email »), sans bibliothèque. */
function tomlValue(section: string, key: string): string | undefined {
  const text = readFileSync(join(process.cwd(), 'supabase', 'config.toml'), 'utf8');
  let current = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      current = header[1] ?? '';
      continue;
    }
    if (current !== section) continue;
    const m = new RegExp(`^${key}\\s*=\\s*([^#]+)`).exec(line);
    if (m) return m[1]?.trim();
  }
  return undefined;
}

describe('supabase/config.toml (règles de SECURITY_NOTES §2)', () => {
  it('[auth] enable_signup = false : les comptes se créent uniquement par notre route /register', () => {
    expect(tomlValue('auth', 'enable_signup')).toBe('false');
  });
  it('[auth] minimum_password_length est de 8 ou plus', () => {
    expect(Number(tomlValue('auth', 'minimum_password_length'))).toBeGreaterThanOrEqual(8);
  });
  it('[auth.email] secure_password_change = true', () => {
    expect(tomlValue('auth.email', 'secure_password_change')).toBe('true');
  });
});
