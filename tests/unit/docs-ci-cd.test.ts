import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('CI_CD.md : contrôle de mise en ligne du captcha Supabase', () => {
  const doc = read('CI_CD.md');

  it('contient une case de mise en ligne « CAPTCHA Supabase activé »', () => {
    expect(doc).toMatch(/^\s*[-*] \[ \].*CAPTCHA Supabase activé/im);
  });

  it('précise qu’un appel direct à /auth/v1/token sans jeton doit échouer', () => {
    const line = doc.split(/\r?\n/).find((l) => /CAPTCHA Supabase activé/i.test(l)) ?? '';
    const block = doc
      .split(/\r?\n/)
      .slice(doc.split(/\r?\n/).indexOf(line), doc.split(/\r?\n/).indexOf(line) + 4)
      .join(' ');
    expect(block).toContain('/auth/v1/token');
    expect(block).toMatch(/sans jeton/i);
    expect(block).toMatch(/échec|échoue|refus/i);
  });
});

describe('ENV_SETUP.md : variables du captcha Supabase', () => {
  it('documente SUPABASE_AUTH_CAPTCHA_SECRET', () => {
    expect(read('ENV_SETUP.md')).toContain('SUPABASE_AUTH_CAPTCHA_SECRET');
  });
});
