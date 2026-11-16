import { describe, expect, it } from 'vitest';
import { buildPicker, PICKER_PAGE_SIZE } from '@/server/catalog/picker';
import type { PublicCatalog, PublicService } from '@/server/catalog/present-catalog';

function svc(id: number, network: PublicService['network'], type: PublicService['type']) {
  return {
    id,
    name: `Service ${network} ${type} #${id}`,
    network,
    type,
    priceXaf1000: 1000,
    minQty: 10,
    maxQty: 1000,
    minOrderXaf: 10,
    refill: false,
    cancel: false,
    dripfeed: false,
    displayPrice1000: 1000,
    displayMinOrder: 10,
  } satisfies PublicService;
}

const many = Array.from({ length: 100 }, (_, i) => svc(i + 1, 'tiktok', 'followers'));
const catalog: PublicCatalog = {
  currency: 'XAF',
  locale: 'fr',
  networks: [
    {
      network: 'tiktok',
      label: 'TikTok',
      types: [
        { type: 'followers', label: 'Abonnés', services: many },
        { type: 'likes', label: "J'aime", services: [svc(500, 'tiktok', 'likes')] },
      ],
    },
    {
      network: 'instagram',
      label: 'Instagram',
      types: [{ type: 'views', label: 'Vues', services: [svc(900, 'instagram', 'views')] }],
    },
  ],
};

describe('buildPicker', () => {
  it('sans filtre : donne le nombre de services par réseau, aucune liste', () => {
    const v = buildPicker(catalog, {});
    expect(v.networks.map((n) => [n.network, n.count])).toEqual([
      ['tiktok', 101],
      ['instagram', 1],
    ]);
    expect(v.services).toEqual([]);
  });

  it('un réseau choisi : liste ses services et ses types', () => {
    const v = buildPicker(catalog, { network: 'tiktok' });
    expect(v.types.map((t) => [t.type, t.count])).toEqual([
      ['followers', 100],
      ['likes', 1],
    ]);
    expect(v.total).toBe(101);
  });

  it('découpe par pages sans jamais perdre de service', () => {
    const seen: number[] = [];
    const first = buildPicker(catalog, { network: 'tiktok', type: 'followers' });
    for (let p = 1; p <= first.totalPages; p += 1) {
      const v = buildPicker(catalog, { network: 'tiktok', type: 'followers', page: String(p) });
      seen.push(...v.services.map((s) => s.id));
    }
    expect(seen).toHaveLength(100);
    expect(new Set(seen).size).toBe(100);
    expect(first.services).toHaveLength(PICKER_PAGE_SIZE);
  });

  it('la recherche couvre tous les réseaux quand aucun n’est choisi', () => {
    expect(buildPicker(catalog, { q: '#900' }).services.map((s) => s.id)).toEqual([900]);
    expect(buildPicker(catalog, { q: 'instagram' }).total).toBe(1);
  });

  it('réseau ou type inconnu : ignoré, jamais d’erreur', () => {
    const v = buildPicker(catalog, { network: 'nope', type: 'zzz', page: '-4' });
    expect(v.network).toBeNull();
    expect(v.type).toBeNull();
    expect(v.page).toBe(1);
  });

  it('une page trop grande retombe sur la dernière', () => {
    const v = buildPicker(catalog, { network: 'tiktok', page: '999' });
    expect(v.page).toBe(v.totalPages);
  });
});
