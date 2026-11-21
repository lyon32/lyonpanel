import { describe, expect, it } from 'vitest';
import {
  MIN_SERVICES_FOR_PAGE,
  RICH_NETWORKS,
  fromPriceXaf,
  isRichNetwork,
  splitNetworks,
} from '@/components/platform/network-summary';
import { buildServiceJsonLd } from '@/lib/seo/service-jsonld';
import { safeLoad } from '@/components/platform/safe-load';

const svc = (priceXaf1000: number) => ({ priceXaf1000 });
const net = (network: string, n: number, price = 1000) => ({
  network,
  label: network,
  types: [{ type: 'followers', label: 'f', services: Array.from({ length: n }, () => svc(price)) }],
});

describe('réseaux riches', () => {
  it('liste exactement instagram, tiktok, youtube, facebook, telegram, x', () => {
    expect([...RICH_NETWORKS].sort()).toEqual(
      ['facebook', 'instagram', 'telegram', 'tiktok', 'x', 'youtube'].sort(),
    );
  });
  it('le seuil de contenu est 10 services', () => {
    expect(MIN_SERVICES_FOR_PAGE).toBe(10);
  });
  it('isRichNetwork refuse un réseau mince connu même avec beaucoup de services', () => {
    for (const n of ['whatsapp', 'spotify', 'twitch', 'linkedin']) {
      expect(isRichNetwork(n, 50)).toBe(false);
    }
  });
  it('isRichNetwork refuse un réseau riche sous 10 services', () => {
    expect(isRichNetwork('instagram', 9)).toBe(false);
  });
  it('isRichNetwork accepte instagram à 10 services', () => {
    expect(isRichNetwork('instagram', 10)).toBe(true);
  });
});

describe('fromPriceXaf', () => {
  it('renvoie le plus petit prix XAF pour 1000, en entier', () => {
    const p = fromPriceXaf([svc(1500), svc(800), svc(2200)]);
    expect(p).toBe(800);
    expect(Number.isInteger(p)).toBe(true);
  });
  it('renvoie null sans service (jamais de prix inventé)', () => {
    expect(fromPriceXaf([])).toBeNull();
  });
});

describe('splitNetworks', () => {
  it('sépare riches (page propre) et autres (section Autres réseaux)', () => {
    const { rich, others } = splitNetworks([
      net('instagram', 12),
      net('whatsapp', 3),
      net('tiktok', 4),
      net('spotify', 30),
    ]);
    expect(rich.map((n) => n.network)).toEqual(['instagram']);
    expect(others.map((n) => n.network)).toEqual(['whatsapp', 'tiktok', 'spotify']);
  });
  it('ne perd et ne duplique aucun réseau', () => {
    const all = [net('instagram', 12), net('whatsapp', 3), net('x', 11)];
    const { rich, others } = splitNetworks(all);
    expect(rich.length + others.length).toBe(all.length);
  });
});

describe('buildServiceJsonLd', () => {
  const ld = buildServiceJsonLd({
    lang: 'fr',
    network: 'instagram',
    name: 'Services Instagram',
    description: 'Abonnés, likes et vues Instagram.',
    fromPriceXaf: 800,
  });
  it('est un Service avec une Offer en XAF au prix entier', () => {
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Service');
    expect(ld.offers['@type']).toBe('Offer');
    expect(ld.offers.priceCurrency).toBe('XAF');
    expect(ld.offers.price).toBe(800);
    expect(Number.isInteger(ld.offers.price)).toBe(true);
  });
  it('porte un nom et une URL du site pour la langue', () => {
    expect(ld.name).toBe('Services Instagram');
    expect(ld.url).toMatch(/\/fr\/services\/instagram$/);
  });
  it('ne contient aucun coût fournisseur ni nom de fournisseur', () => {
    const json = JSON.stringify(ld);
    expect(json).not.toMatch(/justanotherpanel|\bJAP\b|provider|fournisseur|cost|margin|marge/i);
  });
  it('refuse un prix non entier ou négatif', () => {
    const base = { lang: 'en' as const, network: 'tiktok', name: 'n', description: 'd' };
    expect(() => buildServiceJsonLd({ ...base, fromPriceXaf: 12.5 })).toThrow();
    expect(() => buildServiceJsonLd({ ...base, fromPriceXaf: -1 })).toThrow();
  });
});

describe('safeLoad (défaillance de la base)', () => {
  it('renvoie ok et la valeur quand le chargement réussit', async () => {
    expect(await safeLoad(async () => 42)).toEqual({ ok: true, value: 42 });
  });
  it('renvoie ok:false sans lever quand la base échoue', async () => {
    const r = await safeLoad(async () => {
      throw new Error('services_public: connection refused');
    });
    expect(r).toEqual({ ok: false });
  });
});
