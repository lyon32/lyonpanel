import { describe, expect, it } from 'vitest';
import { exists, flatten, messages, read } from '../home/helpers';

const PAGE = 'src/app/[locale]/(public)/services/[network]/page.tsx';
const LIST = 'src/app/[locale]/(public)/services/page.tsx';
const NETS = ['instagram', 'tiktok', 'youtube', 'facebook', 'telegram', 'x'];
const PROVIDER = /justanotherpanel|\bJAP\b|fournisseur|provider/i;

describe('page réseau /services/[network]', () => {
  const src = () => read(PAGE);
  it('un seul h1', () => {
    expect(src().match(/<h1[\s>]/g)?.length).toBe(1);
  });
  it('réseau inconnu ou mince : notFound() via isRichNetwork', () => {
    expect(src()).toMatch(/notFound\(\)/);
    expect(src()).toMatch(/isRichNetwork/);
  });
  it('JSON-LD Service construit par buildServiceJsonLd avec le prix calculé côté serveur', () => {
    expect(src()).toMatch(/buildServiceJsonLd/);
    expect(src()).toMatch(/fromPriceXaf/);
    expect(src()).not.toMatch(/'use client'/);
  });
  it('lie vers l inscription et vers les types de services', () => {
    expect(src()).toMatch(/register/);
    expect(src()).toMatch(/\/services\/\[network\]\/\[type\]/);
  });
  it('affiche la FAQ courte', () => {
    expect(src()).toMatch(/faq/i);
  });
  it('aucun nom ni coût fournisseur', () => {
    expect(src()).not.toMatch(PROVIDER);
  });
});

describe('messages platform : prix, FAQ, erreur', () => {
  const fr = flatten(messages('fr') as never);
  const en = flatten(messages('en') as never);
  const keys = (m: Record<string, string>, p: string) =>
    Object.keys(m).filter((k) => k.startsWith(p));

  it.each(NETS)('FAQ %s : 3 à 5 questions avec réponse', (n) => {
    const qs = keys(fr, `platform.faq.${n}.`).filter((k) => /\.q\d+\.question$/.test(k));
    expect(qs.length).toBeGreaterThanOrEqual(3);
    expect(qs.length).toBeLessThanOrEqual(5);
    for (const q of qs) {
      expect(fr[q]).toBeTruthy();
      expect(fr[q.replace(/question$/, 'answer')]).toBeTruthy();
    }
  });
  it('mêmes clés platform.* en FR et en EN (parité)', () => {
    const f = keys(fr, 'platform.').sort();
    const e = keys(en, 'platform.').sort();
    expect(f.length).toBeGreaterThan(0);
    expect(e).toEqual(f);
  });
  it('platform.fromPrice contient {price} (dès / from)', () => {
    expect(fr['platform.fromPrice']).toMatch(/dès.*\{price\}/);
    expect(en['platform.fromPrice']).toMatch(/from.*\{price\}/i);
  });
  it('platform.otherNetworks existe', () => {
    expect(fr['platform.otherNetworks']).toBe('Autres réseaux');
    expect(en['platform.otherNetworks']).toBe('Other networks');
  });
  it('platform.error.title et platform.error.text en FR et EN', () => {
    for (const m of [fr, en]) {
      expect(m['platform.error.title']).toBeTruthy();
      expect(m['platform.error.text']).toBeTruthy();
    }
  });
  it('aucun nom de fournisseur dans platform.*', () => {
    const all = [
      ...keys(fr, 'platform.').map((k) => fr[k]),
      ...keys(en, 'platform.').map((k) => en[k]),
    ];
    expect(all.length).toBeGreaterThan(0);
    expect(all.join(' ')).not.toMatch(PROVIDER);
  });
});

describe('liste /services', () => {
  it('regroupe les réseaux minces sous Autres réseaux via splitNetworks', () => {
    expect(read(LIST)).toMatch(/splitNetworks/);
    expect(read(LIST)).toMatch(/otherNetworks/);
  });
  it('affiche un message propre si la base échoue (safeLoad + CatalogError)', () => {
    expect(read(LIST)).toMatch(/safeLoad/);
    expect(read(LIST)).toMatch(/CatalogError/);
  });
  it('CatalogError existe, rôle alert, sombre, sans détail technique', () => {
    const p = 'src/components/platform/catalog-error.tsx';
    expect(exists(p)).toBe(true);
    const s = read(p);
    expect(s).toMatch(/role="alert"/);
    expect(s).not.toMatch(/text-encre|bg-white|#1D4ED8/i);
    expect(s).not.toMatch(/error\.message|\.stack/);
  });
});
