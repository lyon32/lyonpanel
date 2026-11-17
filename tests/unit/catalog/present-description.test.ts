import { describe, expect, it } from 'vitest';
import { toPublicService } from '@/server/catalog/present-catalog';
import type { PublicServiceRow } from '@/server/catalog/public-catalog';

// Contrat attendu : PublicServiceRow (ligne de la vue services_public) gagne des champs nullables
//   name_en, description_fr, description_en (textes générés à la synchro, stockés),
//   custom_name_fr, custom_name_en, custom_description_fr, custom_description_en (saisis par l'admin).
// PublicService gagne `description: string` ; un texte personnalisé remplace le texte généré.
const row = {
  id: 36784,
  platform: 'tiktok',
  category: 'likes',
  name_fr: 'Likes TikTok · Garantie 90 j #36784',
  name_en: 'TikTok Likes · 90-day refill #36784',
  description_fr: 'Description générée FR',
  description_en: 'Generated description EN',
  custom_name_fr: null,
  custom_name_en: null,
  custom_description_fr: null,
  custom_description_en: null,
  price_xaf_1000: 1500,
  min_qty: 10,
  max_qty: 10000,
  refill: true,
  cancel: false,
  dripfeed: false,
  sort_order: 0,
} as unknown as PublicServiceRow;
const opts = (locale: 'fr' | 'en') => ({ currency: 'XAF' as const, locale, usdXafRate: 600 });
const FORBIDDEN_KEYS = [
  'cost_usd',
  'cost_usd_1000',
  'jap_name',
  'provider_name',
  'multiplier',
  'provider_order_id',
];

describe('toPublicService : description', () => {
  it.each([
    ['fr', 'Description générée FR'],
    ['en', 'Generated description EN'],
  ] as const)('expose le champ description généré (%s)', (l, expected) => {
    const p = toPublicService(row, opts(l)) as unknown as Record<string, unknown>;
    expect(p.description).toBe(expected);
  });

  it('un texte personnalisé remplace le nom et la description générés', () => {
    const custom = {
      ...row,
      custom_name_fr: 'Nom perso FR',
      custom_description_fr: 'Description perso FR',
    } as PublicServiceRow;
    const p = toPublicService(custom, opts('fr')) as unknown as Record<string, unknown>;
    expect(p.name).toBe('Nom perso FR');
    expect(p.description).toBe('Description perso FR');
    const en = toPublicService(custom, opts('en')) as unknown as Record<string, unknown>;
    expect(en.description).toBe('Generated description EN');
  });

  it('ne renvoie aucun champ interdit (liste blanche stricte)', () => {
    const leaky = {
      ...row,
      cost_usd_1000: 1.2,
      jap_name: 'PEAKERR secret',
      provider_name: 'PEAKERR secret',
      multiplier: 3,
      provider_order_id: '123',
    } as unknown as PublicServiceRow;
    const p = toPublicService(leaky, opts('fr'));
    const keys = Object.keys(p);
    for (const k of FORBIDDEN_KEYS) expect(keys).not.toContain(k);
    expect(keys).toContain('description');
    expect(JSON.stringify(p)).not.toMatch(/peakerr/i);
  });
});
