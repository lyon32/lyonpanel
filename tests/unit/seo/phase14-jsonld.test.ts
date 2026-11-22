import { describe, expect, it } from 'vitest';
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
} from '@/lib/seo/site-jsonld';

const FORBIDDEN = /provider|fournisseur|\bJAP\b|cost|margin|marge/i;
const SITE = 'https://lyonpanel.com';

describe('JSON-LD du site', () => {
  it('Organization valide, url et logo absolus', () => {
    const o = buildOrganizationJsonLd() as Record<string, unknown>;
    expect(o['@context']).toBe('https://schema.org');
    expect(o['@type']).toBe('Organization');
    expect(o.name).toBe('LyonPanel');
    expect(o.url).toBe(SITE);
    expect(String(o.logo)).toMatch(/^https:\/\/lyonpanel\.com\//);
  });
  it('WebSite valide avec url, nom et langue', () => {
    const w = buildWebSiteJsonLd('fr') as Record<string, unknown>;
    expect(w['@context']).toBe('https://schema.org');
    expect(w['@type']).toBe('WebSite');
    expect(w.name).toBe('LyonPanel');
    expect(String(w.url)).toMatch(/^https:\/\/lyonpanel\.com/);
    expect(w.inLanguage).toBe('fr');
  });
  it('BreadcrumbList : positions 1..n et urls absolues', () => {
    const b = buildBreadcrumbJsonLd([
      { name: 'Accueil', url: `${SITE}/fr` },
      { name: 'Services', url: `${SITE}/fr/services` },
    ]) as { '@type': string; itemListElement: { position: number; item: string }[] };
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement.every((i) => i.item.startsWith(`${SITE}/`))).toBe(true);
  });
  it('BreadcrumbList : un chemin relatif devient absolu', () => {
    const b = buildBreadcrumbJsonLd([{ name: 'Services', url: '/fr/services' }]) as {
      itemListElement: { item: string }[];
    };
    expect(b.itemListElement[0]?.item).toBe(`${SITE}/fr/services`);
  });
  it('aucun mot interdit dans les trois blocs', () => {
    const all = JSON.stringify([
      buildOrganizationJsonLd(),
      buildWebSiteJsonLd('en'),
      buildBreadcrumbJsonLd([{ name: 'Home', url: '/en' }]),
    ]);
    expect(all).not.toMatch(FORBIDDEN);
  });
});
