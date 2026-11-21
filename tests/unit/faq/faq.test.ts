import { describe, expect, it } from 'vitest';
import { exists, flatten, listFiles, messages, read } from '../home/helpers';

const PAGE = 'src/app/[locale]/(public)/faq/page.tsx';
const GROUPS = ['payment', 'orders', 'accounts', 'security'] as const;
const sources = () =>
  [PAGE, ...listFiles('src/components/faq')].filter(exists).map(read).join('\n');
const h1Count = (src: string) => (src.match(/<h1[\s>]/g) ?? []).length;
const faqFlat = (loc: 'fr' | 'en') => {
  const m = messages(loc).faq;
  return m ? flatten(m, 'faq') : {};
};
// Questions et réponses : faq.groups.<groupe>.items.<n>.question | answer
const pairs = (loc: 'fr' | 'en') => {
  const f = faqFlat(loc);
  return Object.keys(f)
    .filter((k) => /^faq\.groups\.\w+\.items\.\d+\.question$/.test(k))
    .map((k) => ({ key: k, question: f[k], answer: f[k.replace(/question$/, 'answer')] }));
};

describe('page FAQ', () => {
  it('la page existe', () => {
    expect(exists(PAGE)).toBe(true);
  });
  it('a un seul h1 (page + composants de src/components/faq)', () => {
    expect(h1Count(sources())).toBe(1);
  });
  it('porte la palette via le layout public (pas de layout propre)', () => {
    expect(read('src/app/[locale]/(public)/layout.tsx')).toContain('lp-app');
    expect(exists('src/app/[locale]/(public)/faq/layout.tsx')).toBe(false);
  });
  it('injecte le JSON-LD via buildFaqJsonLd', () => {
    expect(sources()).toContain('buildFaqJsonLd');
  });
});

describe('messages faq', () => {
  it.each(['fr', 'en'] as const)('%s : au moins 8 questions avec réponse', (loc) => {
    const p = pairs(loc);
    expect(p.length).toBeGreaterThanOrEqual(8);
    p.forEach((x) => expect(x.answer?.trim().length).toBeGreaterThan(0));
  });
  it.each(['fr', 'en'] as const)('%s : les 4 groupes ont un titre et une question', (loc) => {
    const f = faqFlat(loc);
    for (const g of GROUPS) {
      expect(f[`faq.groups.${g}.title`], `titre ${g}`).toBeTruthy();
      expect(
        Object.keys(f).some((k) => k.startsWith(`faq.groups.${g}.items.`)),
        g,
      ).toBe(true);
    }
  });
  it('parité FR/EN des clés faq', () => {
    expect(Object.keys(faqFlat('fr')).length).toBeGreaterThan(0);
    expect(Object.keys(faqFlat('fr')).sort()).toEqual(Object.keys(faqFlat('en')).sort());
  });
  it('faq.title (h1) et faq.intro existent en FR et EN', () => {
    for (const loc of ['fr', 'en'] as const) {
      expect(faqFlat(loc)['faq.title']).toBeTruthy();
      expect(faqFlat(loc)['faq.intro']).toBeTruthy();
    }
  });
  it.each(['fr', 'en'] as const)('%s : aucun nom de fournisseur', (loc) => {
    const text = Object.values(faqFlat(loc)).join(' ');
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/justanotherpanel|\bJAP\b|fournisseur|provider|supplier/i);
  });
  it.each(['fr', 'en'] as const)('%s : aucune promesse de délai ni de résultat garanti', (loc) => {
    const answers = pairs(loc)
      .map((p) => p.answer)
      .join(' ');
    expect(answers.length).toBeGreaterThan(0);
    expect(answers).not.toMatch(
      /\d+\s?(secondes?|seconds?|minutes?|mins?|heures?|hours?|h\b|jours?|days?)|instantan|immédiat|immediate|garanti|guarantee|100\s?%|à vie|lifetime|résultat assuré/i,
    );
  });
});

describe('buildFaqJsonLd', () => {
  const MODULE = '@/components/faq/faq-jsonld';
  const items = [
    { question: 'Comment recharger ?', answer: 'Par Mobile Money.' },
    { question: 'Où voir ma commande ?', answer: 'Dans <b>Commandes</b> & suivi.' },
  ];
  it('produit un FAQPage avec Question / acceptedAnswer', async () => {
    const { buildFaqJsonLd } = await import(/* @vite-ignore */ MODULE);
    const ld = buildFaqJsonLd(items);
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Comment recharger ?',
      acceptedAnswer: { '@type': 'Answer', text: 'Par Mobile Money.' },
    });
  });
  it('met les réponses en texte brut (aucune balise HTML)', async () => {
    const { buildFaqJsonLd } = await import(/* @vite-ignore */ MODULE);
    const text = buildFaqJsonLd(items).mainEntity[1].acceptedAnswer.text;
    expect(text).not.toMatch(/<[^>]+>/);
    expect(text).toContain('Commandes');
  });
  it('est sérialisable en JSON sans perte et refuse une liste vide', async () => {
    const { buildFaqJsonLd } = await import(/* @vite-ignore */ MODULE);
    const ld = buildFaqJsonLd(items);
    expect(JSON.parse(JSON.stringify(ld))).toEqual(ld);
    expect(() => buildFaqJsonLd([])).toThrow();
  });
});
