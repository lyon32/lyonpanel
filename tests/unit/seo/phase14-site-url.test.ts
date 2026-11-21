import { describe, expect, it } from 'vitest';
import { getSiteUrl } from '@/lib/seo/site-url';

const prod = (url?: string) => ({ NEXT_PUBLIC_SITE_URL: url, NODE_ENV: 'production' });

describe('getSiteUrl', () => {
  it('renvoie le défaut sans variable', () => {
    expect(getSiteUrl(prod())).toBe('https://lyonpanel.com');
  });
  it('utilise la variable valide', () => {
    expect(getSiteUrl(prod('https://staging.lyonpanel.com'))).toBe('https://staging.lyonpanel.com');
  });
  it('retire le slash final', () => {
    expect(getSiteUrl(prod('https://lyonpanel.com/'))).toBe('https://lyonpanel.com');
  });
  it('revient au défaut si la valeur est vide ou invalide', () => {
    expect(getSiteUrl(prod(''))).toBe('https://lyonpanel.com');
    expect(getSiteUrl(prod('pas une url'))).toBe('https://lyonpanel.com');
  });
  it('refuse http en production', () => {
    expect(getSiteUrl(prod('http://lyonpanel.com'))).toBe('https://lyonpanel.com');
  });
  it('accepte http://localhost hors production', () => {
    expect(
      getSiteUrl({ NEXT_PUBLIC_SITE_URL: 'http://localhost:3000', NODE_ENV: 'development' }),
    ).toBe('http://localhost:3000');
  });
});
