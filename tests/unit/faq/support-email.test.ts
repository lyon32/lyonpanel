import { describe, expect, it } from 'vitest';
import { validSupportEmail } from '@/components/contact/support-email';

describe('validSupportEmail', () => {
  it('accepte une adresse valide', () => {
    expect(validSupportEmail(' aide@lyonpanel.com ')).toBe('aide@lyonpanel.com');
  });
  it('refuse une adresse invalide', () => {
    expect(validSupportEmail('pas un mail')).toBeUndefined();
    expect(validSupportEmail('a@b')).toBeUndefined();
    expect(validSupportEmail('x"@y.com')).toBeUndefined();
  });
  it('refuse une valeur vide ou absente', () => {
    expect(validSupportEmail('')).toBeUndefined();
    expect(validSupportEmail(undefined)).toBeUndefined();
  });
});
