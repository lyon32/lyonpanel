import type {
  CatalogSettings,
  CatalogStore,
  MultiplierRule,
  PriceHistoryRow,
  StoredService,
} from '@/server/catalog/sync-services';

/**
 * Base simulée en mémoire pour syncServices / recomputePrices.
 * `writes` compte chaque ligne écrite (insertion, mise à jour, historique) : 0 = rien n'a changé.
 */
export interface MemoryCatalogStore extends CatalogStore {
  settings: CatalogSettings;
  rules: MultiplierRule[];
  services: Map<number, StoredService>;
  history: PriceHistoryRow[];
  writes: number;
}

export function defaultSettings(): CatalogSettings {
  return { usdXafRate: 600, defaultMultiplier: 3, priceAlertPct: 20 };
}

export function makeStoredService(overrides: Partial<StoredService> = {}): StoredService {
  return {
    id: 1000,
    platform: 'tiktok',
    category: 'followers',
    name_fr: 'Abonnés TikTok #1000',
    provider_name: 'TikTok - Followers | MQ 100K',
    provider_type: 'Default',
    cost_usd_1000: 1.5,
    multiplier: null,
    price_xaf_1000: 2700,
    min_qty: 10,
    max_qty: 100000,
    refill: false,
    cancel: false,
    dripfeed: false,
    active: true,
    available: true,
    ...overrides,
  };
}

export function createMemoryStore(
  init: {
    settings?: Partial<CatalogSettings>;
    rules?: MultiplierRule[];
    services?: StoredService[];
  } = {},
): MemoryCatalogStore {
  const store: MemoryCatalogStore = {
    settings: { ...defaultSettings(), ...init.settings },
    rules: init.rules ?? [],
    services: new Map((init.services ?? []).map((s) => [s.id, structuredClone(s)])),
    history: [],
    writes: 0,
    async getSettings() {
      return { ...store.settings };
    },
    async getMultiplierRules() {
      return store.rules.map((r) => ({ ...r }));
    },
    async listServices() {
      return [...store.services.values()].map((s) => structuredClone(s));
    },
    async insertServices(rows) {
      for (const row of rows) {
        if (store.services.has(row.id)) throw new Error(`doublon d'identifiant ${row.id}`);
        store.services.set(row.id, structuredClone(row));
        store.writes += 1;
      }
    },
    async updateService(id, patch) {
      const current = store.services.get(id);
      if (!current) throw new Error(`service ${id} introuvable`);
      store.services.set(id, { ...current, ...patch });
      store.writes += 1;
    },
    async addPriceHistory(rows) {
      store.history.push(...structuredClone(rows));
      store.writes += rows.length;
    },
  };
  return store;
}
