import { describe, expect, it } from 'vitest';
import { buildReferralLink } from '@/server/referral/referral';

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
});
