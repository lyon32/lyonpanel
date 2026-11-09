import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonLd } from '@/components/seo/json-ld';
import {
  asLang,
  breadcrumbLd,
  catalogMetadata,
  catalogPaths,
  fitTitle,
  itemListLd,
  pickDescription,
} from '@/lib/seo/catalog-seo';
import { NETWORKS, SERVICE_TYPES, networkLabel, typeLabel } from '@/server/catalog/labels';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const fill = (tpl: string, v: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? '');

describe('catalogMetadata', () => {
  const m = catalogMetadata({ lang: 'en', path: '/services/tiktok', title: 'T', description: 'D' });
  it('canonical absolu et hreflang fr/en/x-default', () => {
    expect(m.alternates?.canonical).toBe('https://lyonpanel.com/en/services/tiktok');
    expect(m.alternates?.languages).toEqual({
      fr: 'https://lyonpanel.com/fr/services/tiktok',
      en: 'https://lyonpanel.com/en/services/tiktok',
      'x-default': 'https://lyonpanel.com/fr/services/tiktok',
    });
  });
  it('Open Graph et Twitter', () => {
    expect(m.openGraph).toMatchObject({
      locale: 'en_US',
      siteName: 'LyonPanel',
      url: 'https://lyonpanel.com/en/services/tiktok',
    });
    expect(m.twitter).toMatchObject({ card: 'summary_large_image' });
  });
  it('indexable par défaut, noindex sur demande', () => {
    expect(m.robots).toEqual({ index: true, follow: true });
    const n = catalogMetadata({
      lang: 'fr',
      path: '/services',
      title: 'T',
      description: 'D',
      noindex: true,
    });
    expect(n.robots).toEqual({ index: false, follow: true });
    expect((n.openGraph as { locale: string }).locale).toBe('fr_FR');
  });
  it('asLang', () => {
    expect(asLang('en')).toBe('en');
    expect(asLang('xx')).toBe('fr');
  });
});

describe('fitTitle', () => {
  it('garde les titres courts et coupe les longs avec la marque', () => {
    expect(fitTitle('Court')).toBe('Court – LyonPanel');
    const long = fitTitle('x'.repeat(100));
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('– LyonPanel')).toBe(true);
    expect(fitTitle('a', '')).toBe('a');
  });
});

describe('textes des pages réseau et liste (FR et EN)', () => {
  for (const [lang, msgs] of [
    ['fr', fr],
    ['en', en],
  ] as const) {
    const c = msgs.catalog;
    it(`${lang} : titres <= 60 et descriptions 140-160`, () => {
      expect(c.metaTitle.length).toBeLessThanOrEqual(60);
      expect(c.metaDescription.length).toBeGreaterThanOrEqual(140);
      expect(c.metaDescription.length).toBeLessThanOrEqual(160);
      const seen = new Set<string>();
      for (const network of NETWORKS) {
        const nv = { network: networkLabel(network, lang) };
        const nt = fill(c.networkMetaTitle, nv);
        const nd = fill(c.networkMetaDescription, nv);
        expect(nt.length).toBeLessThanOrEqual(60);
        expect(nd.length).toBeGreaterThanOrEqual(140);
        expect(nd.length).toBeLessThanOrEqual(160);
        for (const type of SERVICE_TYPES) {
          const v = { ...nv, type: typeLabel(type, lang) };
          const t = fill(c.typeMetaTitle, v);
          const d = pickDescription([
            fill(c.typeMetaDescription, v),
            fill(c.typeMetaDescriptionLong, v),
            fill(c.typeMetaDescriptionLonger, v),
            fill(c.typeMetaDescriptionLongest, v),
          ]);
          expect(t.length).toBeLessThanOrEqual(60);
          expect(d.length).toBeGreaterThanOrEqual(140);
          expect(d.length).toBeLessThanOrEqual(160);
          expect(seen.has(t)).toBe(false);
          seen.add(t);
        }
      }
    });
    it(`${lang} : aucun nom de fournisseur`, () => {
      expect(JSON.stringify(c)).not.toMatch(/peakerr|\bjap\b|justanotherpanel/i);
    });
  }
});

describe('JSON-LD', () => {
  it('BreadcrumbList avec positions et URL absolues', () => {
    const ld = breadcrumbLd('fr', [
      { name: 'Services', path: '/services' },
      { name: 'TikTok', path: '/services/tiktok' },
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(ld.itemListElement[1]?.item).toBe('https://lyonpanel.com/fr/services/tiktok');
  });
  it('ItemList', () => {
    const ld = itemListLd('en', [{ name: 'A', path: '/services/a' }]);
    expect(ld.numberOfItems).toBe(1);
    expect(ld.itemListElement[0]?.url).toBe('https://lyonpanel.com/en/services/a');
  });
  it('la balise contient du JSON lisible', () => {
    const html = renderToStaticMarkup(<JsonLd data={{ a: 'b "c"' }} />);
    const body = /<script type="application\/ld\+json">([\s\S]*)<\/script>/.exec(html)?.[1] ?? '';
    expect(JSON.parse(body.replace(/&quot;/g, '"'))).toEqual({ a: 'b "c"' });
  });
});

describe('pickDescription', () => {
  it('prend la plus longue qui tient, sinon la plus courte', () => {
    expect(pickDescription(['aa', 'aaaa', 'aaaaaa'], 4)).toBe('aaaa');
    expect(pickDescription(['aaaaa', 'aaa'], 2)).toBe('aaa');
  });
});

describe('catalogPaths', () => {
  it('réseaux et listes non vides seulement', () => {
    const p = catalogPaths([
      {
        network: 'tiktok',
        types: [
          { type: 'followers', services: [1] },
          { type: 'likes', services: [] },
        ],
      },
      { network: 'kick', types: [{ type: 'views', services: [] }] },
    ]);
    expect(p).toEqual(['/services/tiktok', '/services/tiktok/followers']);
  });
});
