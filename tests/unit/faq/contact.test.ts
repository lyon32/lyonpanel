import { describe, expect, it } from 'vitest';
import { exists, flatten, listFiles, messages, read } from '../home/helpers';

const PAGE = 'src/app/[locale]/(public)/contact/page.tsx';
const sources = () =>
  [PAGE, ...listFiles('src/components/contact')].filter(exists).map(read).join('\n');
const contactFlat = (loc: 'fr' | 'en') => {
  const m = messages(loc).contact;
  return m ? flatten(m, 'contact') : {};
};
const KEYS = ['title', 'intro', 'ticketsCta', 'loginCta', 'emailLabel'];

describe('page contact', () => {
  it('la page existe', () => {
    expect(exists(PAGE)).toBe(true);
  });
  it('a un seul h1', () => {
    expect((sources().match(/<h1[\s>]/g) ?? []).length).toBe(1);
  });
  it('renvoie vers les tickets et la connexion via les routes i18n', () => {
    const s = sources();
    expect(s).toMatch(/['"]\/tickets['"]/);
    expect(s).toMatch(/['"]\/login['"]/);
  });
  it("lit l'adresse de support dans NEXT_PUBLIC_SUPPORT_EMAIL, jamais en dur", () => {
    const s = sources();
    expect(s).toContain('NEXT_PUBLIC_SUPPORT_EMAIL');
    expect(s).not.toMatch(/[\w.+-]+@lyonpanel\.com/i);
  });
  it("n'envoie aucune donnée : ni form, ni fetch, ni action serveur", () => {
    const s = sources();
    expect(s.length).toBeGreaterThan(0);
    expect(s).not.toMatch(/<form[\s>]|\bfetch\(|['"]use server['"]|<textarea/);
  });
  it('NEXT_PUBLIC_SUPPORT_EMAIL est documentée dans .env.example', () => {
    expect(read('.env.example')).toContain('NEXT_PUBLIC_SUPPORT_EMAIL');
  });
  it('ne crée pas de layout propre (palette lp-app du layout public)', () => {
    expect(exists('src/app/[locale]/(public)/contact/layout.tsx')).toBe(false);
  });
});

describe('messages contact', () => {
  it.each(['fr', 'en'] as const)('%s : clés contact.* requises présentes', (loc) => {
    const f = contactFlat(loc);
    for (const k of KEYS) expect(f[`contact.${k}`], k).toBeTruthy();
  });
  it('parité FR/EN des clés contact', () => {
    expect(Object.keys(contactFlat('fr')).length).toBeGreaterThan(0);
    expect(Object.keys(contactFlat('fr')).sort()).toEqual(Object.keys(contactFlat('en')).sort());
  });
  it.each(['fr', 'en'] as const)('%s : aucun fournisseur ni promesse de délai', (loc) => {
    const text = Object.values(contactFlat(loc)).join(' ');
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(
      /justanotherpanel|\bJAP\b|fournisseur|provider|\d+\s?(minutes?|heures?|hours?|h\b|jours?|days?)|24\s?\/\s?7|instantan|immédiat/i,
    );
  });
});

describe('messages faq et contact : forme', () => {
  it.each(['fr', 'en'] as const)('%s : aucun tableau, aucune valeur vide', (loc) => {
    const m = messages(loc);
    const bad: string[] = [];
    const walk = (v: unknown, p: string) => {
      if (Array.isArray(v)) bad.push(`${p} (tableau)`);
      else if (v && typeof v === 'object')
        Object.entries(v).forEach(([k, x]) => walk(x, `${p}.${k}`));
      else if (typeof v !== 'string' || !v.trim()) bad.push(`${p} (vide)`);
    };
    expect(m.faq, 'faq absent').toBeDefined();
    expect(m.contact, 'contact absent').toBeDefined();
    walk(m.faq, 'faq');
    walk(m.contact, 'contact');
    expect(bad).toEqual([]);
  });
});
