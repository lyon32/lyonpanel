import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { maskEmail, maskPhone, redactSecrets } from '@/server/http/log-mask';

describe('maskPhone', () => {
  it('garde le début et les 2 derniers chiffres', () => {
    expect(maskPhone('+237600000012')).toBe('+2376****12');
  });
  it('ne laisse jamais le numéro complet', () => {
    expect(maskPhone('+22507070707')).not.toContain('0707070');
  });
});

describe('maskEmail', () => {
  it('garde la première lettre et le domaine', () => {
    expect(maskEmail('jean.dupont@gmail.com')).toBe('j***@gmail.com');
  });
});

describe('redactSecrets', () => {
  it('masque mots de passe, jetons, cookies et Authorization, même imbriqués', () => {
    const out = redactSecrets({
      email: 'a@b.co',
      password: 'p1-secret',
      new_password: 'p2-secret',
      turnstile_token: 't-secret',
      token: 'tk-secret',
      access_token: 'a-secret',
      refresh_token: 'r-secret',
      headers: { authorization: 'Bearer x-secret', cookie: 'c=1-secret' },
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain('-secret');
    expect(json).toContain('a@b.co');
  });
  it("ne modifie pas l'objet d'origine", () => {
    const src = { password: 'p1' };
    redactSecrets(src);
    expect(src.password).toBe('p1');
  });
});
