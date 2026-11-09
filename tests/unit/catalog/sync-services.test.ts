import { describe, expect, it, vi } from 'vitest';
import { makeProviderService } from '../../factories/provider-service';
import { createMemoryStore, makeStoredService } from '../../helpers/memory-catalog-store';
import { loadProviderFixture, type RawProviderService } from '../../helpers/provider-fixture';

vi.mock('server-only', () => ({}));

import { computePricePer1000Xaf } from '@/server/pricing/compute-price';
import { providerServicesSchema } from '@/server/providers/types';
import { recomputePrices, syncServices, type SyncDeps } from '@/server/catalog/sync-services';

// Module attendu : src/server/catalog/sync-services.ts (LLD §4.2, dépendances injectées)
//   syncServices(deps: SyncDeps): Promise<{ added; removed; repriced; alerts }>
//   recomputePrices(deps: { store: CatalogStore }, reason: 'taux' | 'admin'): Promise<{ repriced: number }>
//   SyncDeps = { provider: { services(): Promise<ProviderService[]> }; store: CatalogStore;
//                onPriceJump?: (e: { serviceId; oldPriceXaf1000; newPriceXaf1000; changePct }) => void | Promise<void> }
//   CatalogStore, StoredService, MultiplierRule, CatalogSettings, PriceHistoryRow : types exportés
//   (voir tests/helpers/memory-catalog-store.ts pour la forme exacte).
// Tous les services sont ACTIFS à l'import ; un service absent passe available=false, jamais supprimé.

function deps(
  store: ReturnType<typeof createMemoryStore>,
  list: RawProviderService[] | Error,
  extra: Partial<SyncDeps> = {},
): SyncDeps {
  const provider = {
    services: async () => {
      if (list instanceof Error) throw list;
      return providerServicesSchema.parse(list);
    },
  };
  return { provider, store, ...extra } as SyncDeps;
}

const tiktok = (o: Partial<RawProviderService> = {}) =>
  makeProviderService({
    service: 1000,
    name: 'TikTok - Followers | MQ 100K',
    rate: '1.50',
    refill: false,
    cancel: false,
    ...o,
  });

describe('syncServices : nouveaux services', () => {
  it('insère un nouveau service actif et disponible, avec réseau, type, nom et prix calculés', async () => {
    const store = createMemoryStore();
    const res = await syncServices(deps(store, [tiktok({ refill: true, cancel: true })]));
    const row = store.services.get(1000)!;
    expect(res).toMatchObject({ added: 1, removed: 0, repriced: 0, alerts: 0 });
    expect(row).toMatchObject({
      id: 1000,
      platform: 'tiktok',
      category: 'followers',
      provider_name: 'TikTok - Followers | MQ 100K',
      provider_type: 'Default',
      cost_usd_1000: 1.5,
      multiplier: null,
      price_xaf_1000: 2700,
      min_qty: 10,
      max_qty: 100000,
      refill: true,
      cancel: true,
      dripfeed: false,
      active: true,
      available: true,
    });
    expect(row.name_fr).toContain('Abonnés');
    expect(row.name_fr).toContain('TikTok');
    expect(row.name_fr).toContain('#1000');
  });

  it('importe toute la fixture : tous actifs et disponibles, prix entiers multiples de 5, aucun nom ne cite le fournisseur', async () => {
    const store = createMemoryStore();
    const raw = loadProviderFixture();
    const res = await syncServices(deps(store, raw));
    expect(res.added).toBe(raw.length);
    expect(store.services.size).toBe(raw.length);
    for (const row of store.services.values()) {
      expect(row.active, `service ${row.id}`).toBe(true);
      expect(row.available, `service ${row.id}`).toBe(true);
      expect(Number.isInteger(row.price_xaf_1000), `service ${row.id}`).toBe(true);
      expect(row.price_xaf_1000 % 5, `service ${row.id}`).toBe(0);
      expect(row.price_xaf_1000, `service ${row.id}`).toBeGreaterThanOrEqual(5);
      expect(row.price_xaf_1000, `service ${row.id}`).toBe(
        computePricePer1000Xaf(row.cost_usd_1000, 600, 3),
      );
      expect(row.name_fr, `service ${row.id}`).not.toMatch(/peakerr|\$|\[|\]|\|/i);
    }
    expect(new Set([...store.services.values()].map((r) => r.name_fr)).size).toBe(raw.length);
  });

  it('n écrit pas de ligne d historique à la création', async () => {
    const store = createMemoryStore();
    await syncServices(deps(store, [tiktok()]));
    expect(store.history).toEqual([]);
  });

  it('utilise le taux et le multiplicateur par défaut des réglages (jamais en dur)', async () => {
    const store = createMemoryStore({ settings: { usdXafRate: 550, defaultMultiplier: 5 } });
    await syncServices(deps(store, [tiktok({ rate: '1.00' })]));
    expect(store.services.get(1000)!.price_xaf_1000).toBe(2750);
  });

  it('applique la règle (réseau, type) quand elle existe', async () => {
    const store = createMemoryStore({
      rules: [{ platform: 'tiktok', category: 'followers', multiplier: 4 }],
    });
    await syncServices(deps(store, [tiktok({ rate: '1.00' })]));
    expect(store.services.get(1000)!.price_xaf_1000).toBe(2400);
    expect(store.services.get(1000)!.multiplier).toBeNull(); // la règle n est pas copiée sur le service
  });
});

describe('syncServices : idempotence', () => {
  it('une relance identique ne change rien (0 écriture, 0 compteur)', async () => {
    const store = createMemoryStore();
    const raw = loadProviderFixture();
    await syncServices(deps(store, raw));
    const writesAfterFirst = store.writes;
    const snapshot = JSON.stringify([...store.services.values()]);
    const res = await syncServices(deps(store, raw));
    expect(res).toEqual({ added: 0, removed: 0, repriced: 0, alerts: 0 });
    expect(store.writes).toBe(writesAfterFirst);
    expect(JSON.stringify([...store.services.values()])).toBe(snapshot);
    expect(store.history).toEqual([]);
  });
});

describe('syncServices : changement de coût', () => {
  it('recalcule le prix et écrit une ligne d historique (reason sync)', async () => {
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000, cost_usd_1000: 1, price_xaf_1000: 1800 })],
    });
    const res = await syncServices(deps(store, [tiktok({ rate: '1.10' })]));
    expect(res.repriced).toBe(1);
    expect(store.services.get(1000)).toMatchObject({ cost_usd_1000: 1.1, price_xaf_1000: 1980 });
    expect(store.history).toEqual([
      {
        service_id: 1000,
        cost_usd_1000: 1.1,
        price_xaf_1000: 1980,
        multiplier: 3,
        usd_xaf_rate: 600,
        reason: 'sync',
      },
    ]);
  });

  it('met à jour le coût sans compter de changement de prix quand le prix arrondi reste le même', async () => {
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000, cost_usd_1000: 0.0012, price_xaf_1000: 5 })],
    });
    const res = await syncServices(deps(store, [tiktok({ rate: '0.0013' })]));
    expect(res.repriced).toBe(0);
    expect(res.alerts).toBe(0);
    expect(store.services.get(1000)).toMatchObject({ cost_usd_1000: 0.0013, price_xaf_1000: 5 });
  });

  it('compte une alerte quand le prix change de plus de price_alert_pct, et prévient une fois', async () => {
    const onPriceJump = vi.fn();
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000, cost_usd_1000: 1, price_xaf_1000: 1800 })],
    });
    const res = await syncServices(deps(store, [tiktok({ rate: '1.30' })], { onPriceJump }));
    expect(res).toMatchObject({ repriced: 1, alerts: 1 });
    expect(onPriceJump).toHaveBeenCalledTimes(1);
    expect(onPriceJump).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 1000, oldPriceXaf1000: 1800, newPriceXaf1000: 2340 }),
    );
  });

  it('pas d alerte à exactement price_alert_pct (20 %), ni en dessous', async () => {
    const onPriceJump = vi.fn();
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000, cost_usd_1000: 1, price_xaf_1000: 1800 })],
    });
    const res = await syncServices(deps(store, [tiktok({ rate: '1.20' })], { onPriceJump })); // 2160 = +20 %
    expect(res).toMatchObject({ repriced: 1, alerts: 0 });
    expect(onPriceJump).not.toHaveBeenCalled();
  });

  it('compte aussi une alerte quand le prix baisse de plus de price_alert_pct', async () => {
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000, cost_usd_1000: 1, price_xaf_1000: 1800 })],
    });
    const res = await syncServices(deps(store, [tiktok({ rate: '0.50' })])); // 900 = -50 %
    expect(res).toMatchObject({ repriced: 1, alerts: 1 });
  });

  it('suit le réglage price_alert_pct', async () => {
    const store = createMemoryStore({
      settings: { priceAlertPct: 5 },
      services: [makeStoredService({ id: 1000, cost_usd_1000: 1, price_xaf_1000: 1800 })],
    });
    const res = await syncServices(deps(store, [tiktok({ rate: '1.10' })])); // +10 %
    expect(res.alerts).toBe(1);
  });
});

describe('syncServices : multiplicateur', () => {
  it('respecte la surcharge du service, même quand le coût change', async () => {
    const store = createMemoryStore({
      rules: [{ platform: 'tiktok', category: 'followers', multiplier: 4 }],
      services: [
        makeStoredService({ id: 1000, cost_usd_1000: 1, multiplier: 5, price_xaf_1000: 3000 }),
      ],
    });
    await syncServices(deps(store, [tiktok({ rate: '2.00' })]));
    expect(store.services.get(1000)!.price_xaf_1000).toBe(6000);
    expect(store.services.get(1000)!.multiplier).toBe(5);
    expect(store.history[0]?.multiplier).toBe(5);
  });

  it('respecte la règle (réseau, type) pour un service existant', async () => {
    const store = createMemoryStore({
      rules: [{ platform: 'tiktok', category: 'followers', multiplier: 4 }],
      services: [makeStoredService({ id: 1000, cost_usd_1000: 1, price_xaf_1000: 1800 })],
    });
    await syncServices(deps(store, [tiktok({ rate: '1.00' })]));
    expect(store.services.get(1000)!.price_xaf_1000).toBe(2400);
    expect(store.history[0]).toMatchObject({ multiplier: 4, reason: 'sync' });
  });
});

describe('syncServices : services disparus et revenus', () => {
  it('marque indisponible un service absent de la liste, sans le supprimer', async () => {
    const store = createMemoryStore({
      services: [
        makeStoredService({ id: 1000 }),
        makeStoredService({ id: 2000, name_fr: 'Autre #2000' }),
      ],
    });
    const res = await syncServices(deps(store, [tiktok()]));
    expect(res.removed).toBe(1);
    expect(store.services.size).toBe(2);
    expect(store.services.get(2000)).toMatchObject({
      available: false,
      active: true,
      name_fr: 'Autre #2000',
    });
    expect(store.services.get(1000)!.available).toBe(true);
  });

  it('remet disponible un service qui réapparaît', async () => {
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000, available: false })],
    });
    await syncServices(deps(store, [tiktok()]));
    expect(store.services.get(1000)!.available).toBe(true);
  });

  it('ne réécrit pas un service déjà indisponible et toujours absent', async () => {
    const store = createMemoryStore({
      services: [
        makeStoredService({ id: 1000 }),
        makeStoredService({ id: 2000, available: false }),
      ],
    });
    const res = await syncServices(deps(store, [tiktok()]));
    expect(res.removed).toBe(0);
    expect(store.writes).toBe(0);
  });
});

describe('syncServices : garde-fou (erreur ou liste vide du fournisseur)', () => {
  it('une erreur du fournisseur ne change rien et est propagée', async () => {
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000 }), makeStoredService({ id: 2000 })],
    });
    const boom = new Error('fournisseur en panne');
    await expect(syncServices(deps(store, boom))).rejects.toBe(boom);
    expect(store.writes).toBe(0);
    expect([...store.services.values()].every((s) => s.available)).toBe(true);
  });

  it('une liste vide ne marque rien indisponible et lève une erreur', async () => {
    const store = createMemoryStore({
      services: [makeStoredService({ id: 1000 }), makeStoredService({ id: 2000 })],
    });
    await expect(syncServices(deps(store, []))).rejects.toThrow();
    expect(store.writes).toBe(0);
    expect([...store.services.values()].every((s) => s.available)).toBe(true);
  });

  it('une réponse invalide (Zod) ne change rien non plus', async () => {
    const store = createMemoryStore({ services: [makeStoredService({ id: 1000 })] });
    const bad = { rate: 'abc' } as unknown as RawProviderService;
    await expect(syncServices(deps(store, [bad]))).rejects.toThrow();
    expect(store.writes).toBe(0);
  });
});

describe('syncServices : ce que l administrateur a décidé reste', () => {
  it('ne réactive pas un service désactivé et ne renomme pas un nom modifié', async () => {
    const store = createMemoryStore({
      services: [
        makeStoredService({ id: 1000, active: false, name_fr: 'Nom choisi par le propriétaire' }),
      ],
    });
    await syncServices(deps(store, [tiktok()]));
    expect(store.services.get(1000)).toMatchObject({
      active: false,
      name_fr: 'Nom choisi par le propriétaire',
    });
  });

  it('met à jour les bornes et les options changées chez le fournisseur, sans historique de prix', async () => {
    const store = createMemoryStore({ services: [makeStoredService({ id: 1000 })] });
    await syncServices(
      deps(store, [tiktok({ min: 50, max: 5000, refill: true, cancel: true, dripfeed: true })]),
    );
    expect(store.services.get(1000)).toMatchObject({
      min_qty: 50,
      max_qty: 5000,
      refill: true,
      cancel: true,
      dripfeed: true,
    });
    expect(store.history).toEqual([]);
  });
});

describe('recomputePrices', () => {
  const services = () => [
    makeStoredService({ id: 1, cost_usd_1000: 1, price_xaf_1000: 1800 }),
    makeStoredService({ id: 2, cost_usd_1000: 0.756, price_xaf_1000: 1365, active: false }),
    makeStoredService({
      id: 3,
      cost_usd_1000: 2,
      multiplier: 5,
      price_xaf_1000: 6000,
      available: false,
    }),
  ];

  it('un nouveau taux met à jour tous les prix et écrit l historique (reason taux)', async () => {
    const store = createMemoryStore({ services: services() });
    store.settings.usdXafRate = 550;
    const res = await recomputePrices({ store }, 'taux');
    expect(res.repriced).toBe(3);
    expect(store.services.get(1)!.price_xaf_1000).toBe(1650);
    expect(store.services.get(2)!.price_xaf_1000).toBe(1250); // 1247.4
    expect(store.services.get(3)!.price_xaf_1000).toBe(5500); // surcharge ×5 respectée
    expect(store.history).toHaveLength(3);
    expect(store.history.every((h) => h.reason === 'taux' && h.usd_xaf_rate === 550)).toBe(true);
    expect(store.history.find((h) => h.service_id === 3)?.multiplier).toBe(5);
  });

  it('un nouveau multiplicateur par défaut met à jour les prix (reason admin) sauf les surcharges', async () => {
    const store = createMemoryStore({ services: services() });
    store.settings.defaultMultiplier = 5;
    const res = await recomputePrices({ store }, 'admin');
    expect(res.repriced).toBe(2);
    expect(store.services.get(1)!.price_xaf_1000).toBe(3000);
    expect(store.services.get(3)!.price_xaf_1000).toBe(6000);
    expect(store.history.map((h) => h.reason)).toEqual(['admin', 'admin']);
  });

  it('une règle (réseau, type) ajoutée est prise en compte', async () => {
    const store = createMemoryStore({ services: services() });
    store.rules.push({ platform: 'tiktok', category: 'followers', multiplier: 2 });
    await recomputePrices({ store }, 'admin');
    expect(store.services.get(1)!.price_xaf_1000).toBe(1200);
    expect(store.services.get(3)!.price_xaf_1000).toBe(6000); // surcharge d abord
  });

  it('ne fait rien si rien n a changé', async () => {
    const store = createMemoryStore({ services: services() });
    store.services.get(2)!.price_xaf_1000 = 1365;
    const res = await recomputePrices({ store }, 'taux');
    expect(res.repriced).toBe(0);
    expect(store.writes).toBe(0);
  });
});
