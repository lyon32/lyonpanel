import { describe, expect, it } from 'vitest';
import { filterServices, MAX_OPTIONS } from '@/lib/workbench-filter';
import type { PublicCatalog, PublicService } from '@/server/catalog/present-catalog';
import { toWorkbench } from '@/server/catalog/workbench';

const list = [
  { id: 1, name: "Abonnés Instagram · J'aime #1", type: 'followers' },
  { id: 22, name: 'Followers TikTok #22', type: 'followers' },
  { id: 333, name: 'Vues YouTube #333', type: 'views' },
];

describe('filterServices', () => {
  it('sans type ni recherche : tout', () => {
    expect(filterServices(list, '', '')).toHaveLength(3);
  });

  it('filtre par type', () => {
    expect(filterServices(list, 'views', '').map((s) => s.id)).toEqual([333]);
  });

  it.each([
    ['abonnes', [1]],
    ['JAIME', [1]],
    ['#22', [22]],
    ['333', [333]],
    ['tiktok', [22]],
  ])('recherche « %s »', (q, ids) => {
    expect(filterServices(list, '', q).map((s) => s.id)).toEqual(ids);
  });

  it('type et recherche se combinent', () => {
    expect(filterServices(list, 'views', 'tiktok')).toEqual([]);
  });

  it('la limite d’options reste raisonnable pour un petit téléphone', () => {
    expect(MAX_OPTIONS).toBeLessThanOrEqual(500);
  });
});

function svc(id: number, network: PublicService['network'], type: PublicService['type']) {
  return {
    id,
    name: `S ${id}`,
    network,
    type,
    priceXaf1000: 1155,
    minQty: 10,
    maxQty: 1000,
    minOrderXaf: 12,
    refill: true,
    cancel: true,
    dripfeed: false,
    description: 'Description de test',
    displayPrice1000: 1155,
    displayMinOrder: 12,
  } satisfies PublicService;
}

describe('toWorkbench', () => {
  const catalog: PublicCatalog = {
    currency: 'XAF',
    locale: 'fr',
    networks: [
      {
        network: 'tiktok',
        label: 'TikTok',
        types: [
          { type: 'followers', label: 'Abonnés', services: [svc(1, 'tiktok', 'followers')] },
          { type: 'comments', label: 'Commentaires', services: [svc(2, 'tiktok', 'comments')] },
        ],
      },
    ],
  };

  it('aplatit les services d’un réseau et marque ceux à commentaires', () => {
    const [tiktok] = toWorkbench(catalog, new Set([2]));
    expect(tiktok?.services.map((s) => [s.id, s.needsComments])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(tiktok?.types.map((t) => t.type)).toEqual(['followers', 'comments']);
  });

  it('n’expose que des champs de vente : rien du fournisseur', () => {
    const [tiktok] = toWorkbench(catalog, new Set());
    expect(Object.keys(tiktok!.services[0]!).sort()).toEqual([
      'description',
      'id',
      'maxQty',
      'minQty',
      'name',
      'needsComments',
      'priceXaf1000',
      'type',
    ]);
  });
});
