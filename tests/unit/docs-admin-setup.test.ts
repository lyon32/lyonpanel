import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

/* Documentation d'installation de l'admin (relecture 11.5, sécurité failles 2 et notes). */

describe('ENV_SETUP.md : connexion admin', () => {
  const doc = read('ENV_SETUP.md');

  it('cite l’adresse de connexion /<ADMIN_PATH> et non /<ADMIN_PATH>/login', () => {
    expect(doc).toContain('/<ADMIN_PATH>');
    expect(doc).not.toContain('/<ADMIN_PATH>/login');
  });

  it('documente la variable ADMIN_ENROLL_OPEN', () => {
    expect(doc).toContain('ADMIN_ENROLL_OPEN');
  });
});

describe('consigne « 2 appareils avant utilisation »', () => {
  const text = `${read('SECURITY_NOTES.md')}\n${read('ENV_SETUP.md')}`;

  it('demande d’enrôler 2 appareils avant d’utiliser l’adresse admin', () => {
    expect(text).toMatch(/enrôler\s+(les\s+)?(2|deux)\s+appareils[^.\n]*avant/i);
  });

  it('demande de vérifier verified = 2 (mfa/status) à la mise en ligne', () => {
    expect(text).toMatch(/verified\s*[:=]?\s*2/i);
    expect(text).toMatch(/mise en ligne/i);
  });
});
