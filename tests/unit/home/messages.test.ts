import { describe, expect, it } from 'vitest';
import { flatten, messages } from './helpers';

const fr = flatten(messages('fr').home ?? {}, 'home');
const en = flatten(messages('en').home ?? {}, 'home');

describe('accueil : textes dans messages', () => {
  it('FR : titre et boutons du héros', () => {
    expect(fr['home.hero.title']).toBe('Fais grandir ta présence sur les réseaux sociaux');
    expect(fr['home.hero.ctaPrimary']).toBe('Créer un compte');
    expect(fr['home.hero.ctaSecondary']).toBe('Comment ça marche');
  });
  it('EN : titre et boutons du héros', () => {
    expect(en['home.hero.title']).toBe('Grow your presence on social media');
    expect(en['home.hero.ctaPrimary']).toBe('Create an account');
    expect(en['home.hero.ctaSecondary']).toBe('How it works');
  });
  it('plus de pastille « Exemple » ; vrais chiffres 100+ clients et 2000+ commandes (FR/EN)', () => {
    expect(fr['home.example']).toBeUndefined();
    expect(en['home.example']).toBeUndefined();
    expect(fr['home.stats.clients']).toBe('100+ clients');
    expect(fr['home.stats.orders']).toBe('2000+ commandes');
    expect(en['home.stats.clients']).toBe('100+ clients');
    expect(en['home.stats.orders']).toBe('2000+ orders');
  });
  it('le chiffre « pays servis » (non fourni) est retiré des deux langues', () => {
    expect(Object.values(fr).join('|')).not.toMatch(/pays servis/);
    expect(Object.values(en).join('|')).not.toMatch(/countries served/);
  });
  it('la mention des moyens de paiement variables est présente en FR et EN', () => {
    expect(fr['home.payments.note']).toBe(
      'Les moyens disponibles varient selon le pays, la devise et le moment du paiement',
    );
    expect(en['home.payments.note']).toMatch(/vary (by|depending on) country, currency and/i);
  });
  it('parité FR/EN : mêmes clés home.* dans les deux fichiers', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(fr).some((k) => k.startsWith('home.hero.'))).toBe(true);
  });
  it('aucune valeur home.* vide', () => {
    for (const [k, v] of [...Object.entries(fr), ...Object.entries(en)]) {
      expect(v.trim(), k).not.toBe('');
    }
  });
  it('le héros ne contient ni fournisseur, ni « n°1 », ni prix, ni devise, ni pays', () => {
    const banned =
      /\bjap\b|justanotherpanel|fournisseur|provider|n°\s?1|no\.\s?1|1er panel|1st panel|first panel|\d\s?(xaf|fcfa|eur|usd|€|\$)|\b(xaf|fcfa|usd|eur)\b|cameroun|cameroon|sénégal|senegal|côte d|ivoire|nigeria|ghana/i;
    const hero = Object.entries({ ...fr, ...en }).filter(([k]) => k.startsWith('home.hero.'));
    expect(hero.length).toBeGreaterThan(0);
    for (const [k, v] of hero) expect(v, k).not.toMatch(banned);
  });
  it('aucun « n°1 » / « 1er panel » dans tout home.*', () => {
    for (const [k, v] of Object.entries({ ...fr, ...en })) {
      expect(v, k).not.toMatch(/n°\s?1|no\.\s?1|1er panel|1st panel|first panel/i);
    }
  });
});
