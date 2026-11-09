import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isCommonPassword } from '@/server/auth/password-policy';

describe('liste des mots de passe courants', () => {
  it('existe dans le dépôt (data/common-passwords.txt) avec 10 000 entrées', () => {
    const lines = readFileSync(resolve('data/common-passwords.txt'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '');
    expect(lines.length).toBeGreaterThanOrEqual(10_000);
  });
  it('refuse les classiques', () => {
    for (const p of ['password', '12345678', 'qwerty123', 'azerty123', 'iloveyou'])
      expect(isCommonPassword(p), p).toBe(true);
  });
  it('ignore la casse', () => {
    expect(isCommonPassword('PASSWORD')).toBe(true);
    expect(isCommonPassword('PassWord')).toBe(true);
  });
  it('accepte un mot de passe long et aléatoire', () => {
    expect(isCommonPassword('Cf9!vQ2#zLm7-rTa84')).toBe(false);
  });
});
