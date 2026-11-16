import { describe, expect, it } from 'vitest';
import { buildReferralLink, resolveSiteUrl } from '@/server/referral/referral';

// Fichier attendu : src/server/referral/referral.ts
//   buildReferralLink(siteUrl: string, code: string): string
// Le chemin exact (accueil ou inscription) est au choix du développeur ; le formulaire
// d'inscription lit ?ref=. Le test exige l'adresse du site, le paramètre ref et pas de « // » en trop.
describe('buildReferralLink', () => {
  it('commence par l adresse du site et finit par ref=CODE', () => {
    const link = buildReferralLink('https://lyonpanel.com', 'ABCD1234');
    expect(link.startsWith('https://lyonpanel.com')).toBe(true);
    expect(new URL(link).searchParams.get('ref')).toBe('ABCD1234');
  });

  it('ne double pas la barre finale de l adresse du site', () => {
    const link = buildReferralLink('https://lyonpanel.com/', 'ABCD1234');
    expect(link).not.toMatch(/com\/\//);
    expect(new URL(link).searchParams.get('ref')).toBe('ABCD1234');
  });

  it('suit la langue du parrain : /inscription en FR, /register en EN', () => {
    const fr = new URL(buildReferralLink('https://lyonpanel.com', 'ABCD1234', 'fr'));
    const en = new URL(buildReferralLink('https://lyonpanel.com', 'ABCD1234', 'en'));
    expect(fr.pathname).toBe('/fr/inscription');
    expect(en.pathname).toBe('/en/register');
  });
});

describe('resolveSiteUrl', () => {
  it('renvoie l adresse configurée', () => {
    expect(resolveSiteUrl('https://lyonpanel.com', 'production')).toBe('https://lyonpanel.com');
  });
  it('accepte localhost hors production', () => {
    expect(resolveSiteUrl(undefined, 'development')).toBe('http://localhost:3100');
  });
  it('échoue clairement en production sans adresse', () => {
    expect(() => resolveSiteUrl(undefined, 'production')).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});
