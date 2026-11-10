import 'server-only';
import { buildServiceName } from '@/server/catalog/build-name';
import { classifyNetwork, classifyType } from '@/server/catalog/classify';
import { computePricePer1000Xaf } from '@/server/pricing/compute-price';
import { resolveMultiplier, type MultiplierRule } from '@/server/pricing/multipliers';
import { apiError } from '@/server/http/api-error';
import type { ProviderService } from '@/server/providers/types';

export type { MultiplierRule };

export interface CatalogSettings {
  usdXafRate: number;
  defaultMultiplier: number;
  priceAlertPct: number;
}

/** Ligne de la table services (colonnes utiles à la synchronisation). */
export interface StoredService {
  id: number;
  platform: string;
  category: string;
  name_fr: string;
  provider_name: string;
  provider_type: string;
  cost_usd_1000: number;
  multiplier: number | null;
  price_xaf_1000: number;
  min_qty: number;
  max_qty: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  active: boolean;
  available: boolean;
}

export interface PriceHistoryRow {
  service_id: number;
  cost_usd_1000: number;
  price_xaf_1000: number;
  multiplier: number;
  usd_xaf_rate: number;
  reason: 'sync' | 'taux' | 'admin';
}

/** Accès à la base, injecté pour tester sans Supabase. */
export interface CatalogStore {
  getSettings(): Promise<CatalogSettings>;
  getMultiplierRules(): Promise<MultiplierRule[]>;
  listServices(): Promise<StoredService[]>;
  insertServices(rows: StoredService[]): Promise<void>;
  updateService(id: number, patch: Partial<StoredService>): Promise<void>;
  addPriceHistory(rows: PriceHistoryRow[]): Promise<void>;
}

export interface PriceJump {
  serviceId: number;
  oldPriceXaf1000: number;
  newPriceXaf1000: number;
  changePct: number;
}

export interface SyncDeps {
  provider: { services(): Promise<ProviderService[]> };
  store: CatalogStore;
  onPriceJump?: (event: PriceJump) => void | Promise<void>;
}

export interface SyncResult {
  added: number;
  removed: number;
  repriced: number;
  alerts: number;
}

const BATCH_SIZE = 25;

/** Exécute les écritures par petits lots parallèles (2 000+ services : un par un serait trop long). */
async function inBatches<T>(items: T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    await Promise.all(items.slice(i, i + BATCH_SIZE).map(run));
  }
}

/** Alerte si le prix bouge de plus de pct % : calcul en entiers, strictement supérieur. */
function isPriceJump(oldPrice: number, newPrice: number, pct: number): boolean {
  return Math.abs(newPrice - oldPrice) * 100 > pct * oldPrice;
}

/**
 * Aligne la table services sur la liste du fournisseur. Si le fournisseur répond par une erreur
 * ou une liste vide, on n'écrit RIEN : sinon tout le catalogue passerait indisponible.
 * Un service désactivé par l'administrateur reste désactivé et garde son nom.
 */
export async function syncServices(deps: SyncDeps): Promise<SyncResult> {
  const { provider, store, onPriceJump } = deps;
  const incoming = await provider.services();
  if (incoming.length === 0) apiError('PROVIDER_ERROR');

  const [settings, rules, stored] = await Promise.all([
    store.getSettings(),
    store.getMultiplierRules(),
    store.listServices(),
  ]);
  const existing = new Map(stored.map((s) => [s.id, s]));
  const seen = new Set<number>();
  const result: SyncResult = { added: 0, removed: 0, repriced: 0, alerts: 0 };

  const toInsert: StoredService[] = [];
  const updates: { id: number; patch: Partial<StoredService> }[] = [];
  const history: PriceHistoryRow[] = [];
  const jumps: PriceJump[] = [];

  for (const item of incoming) {
    seen.add(item.service);
    const current = existing.get(item.service);

    if (!current) {
      const platform = classifyNetwork(item.name, item.category);
      const category = classifyType(item.name, item.type);
      const multiplier = resolveMultiplier({
        platform,
        category,
        rules,
        defaultMultiplier: settings.defaultMultiplier,
      });
      toInsert.push({
        id: item.service,
        platform,
        category,
        name_fr: buildServiceName(
          {
            id: item.service,
            platform,
            category,
            refill: item.refill,
            cancel: item.cancel,
            dripfeed: item.dripfeed,
            min_qty: item.min,
            max_qty: item.max,
            providerName: item.name,
            providerCategory: item.category,
          },
          'fr',
        ),
        provider_name: item.name,
        provider_type: item.type,
        cost_usd_1000: item.rate,
        multiplier: null,
        price_xaf_1000: computePricePer1000Xaf(item.rate, settings.usdXafRate, multiplier),
        min_qty: item.min,
        max_qty: item.max,
        refill: item.refill,
        cancel: item.cancel,
        dripfeed: item.dripfeed,
        active: true,
        available: true,
      });
      continue;
    }

    const multiplier = resolveMultiplier({
      override: current.multiplier,
      platform: current.platform,
      category: current.category,
      rules,
      defaultMultiplier: settings.defaultMultiplier,
    });
    const newPrice = computePricePer1000Xaf(item.rate, settings.usdXafRate, multiplier);
    const patch: Partial<StoredService> = {};
    const fresh: Partial<StoredService> = {
      provider_name: item.name,
      provider_type: item.type,
      cost_usd_1000: item.rate,
      price_xaf_1000: newPrice,
      min_qty: item.min,
      max_qty: item.max,
      refill: item.refill,
      cancel: item.cancel,
      dripfeed: item.dripfeed,
      available: true,
    };
    for (const key of Object.keys(fresh) as (keyof StoredService)[]) {
      if (fresh[key] !== current[key]) Object.assign(patch, { [key]: fresh[key] });
    }
    if (Object.keys(patch).length === 0) continue;
    updates.push({ id: current.id, patch });

    const priceChanged = newPrice !== current.price_xaf_1000;
    if (priceChanged || item.rate !== current.cost_usd_1000) {
      history.push({
        service_id: current.id,
        cost_usd_1000: item.rate,
        price_xaf_1000: newPrice,
        multiplier,
        usd_xaf_rate: settings.usdXafRate,
        reason: 'sync',
      });
    }
    if (priceChanged) {
      result.repriced += 1;
      if (isPriceJump(current.price_xaf_1000, newPrice, settings.priceAlertPct)) {
        result.alerts += 1;
        jumps.push({
          serviceId: current.id,
          oldPriceXaf1000: current.price_xaf_1000,
          newPriceXaf1000: newPrice,
          changePct: Math.round(
            ((newPrice - current.price_xaf_1000) * 100) / current.price_xaf_1000,
          ),
        });
      }
    }
  }

  // Disparu de la liste : indisponible, jamais supprimé (les commandes passées y font référence).
  for (const row of stored) {
    if (!seen.has(row.id) && row.available) {
      updates.push({ id: row.id, patch: { available: false } });
      result.removed += 1;
    }
  }

  result.added = toInsert.length;
  for (let i = 0; i < toInsert.length; i += 500) {
    await store.insertServices(toInsert.slice(i, i + 500));
  }
  await inBatches(updates, (u) => store.updateService(u.id, u.patch));
  if (history.length > 0) await store.addPriceHistory(history);
  // Prévenir en dernier : une alerte ratée ne doit pas empêcher d'enregistrer les prix.
  if (onPriceJump) for (const jump of jumps) await onPriceJump(jump);
  return result;
}

/** Recalcule tous les prix après un changement de taux ou de multiplicateur (même les services inactifs). */
export async function recomputePrices(
  deps: { store: CatalogStore },
  reason: 'taux' | 'admin',
): Promise<{ repriced: number }> {
  const { store } = deps;
  const [settings, rules, stored] = await Promise.all([
    store.getSettings(),
    store.getMultiplierRules(),
    store.listServices(),
  ]);
  const updates: { id: number; price: number }[] = [];
  const history: PriceHistoryRow[] = [];
  for (const row of stored) {
    const multiplier = resolveMultiplier({
      override: row.multiplier,
      platform: row.platform,
      category: row.category,
      rules,
      defaultMultiplier: settings.defaultMultiplier,
    });
    const price = computePricePer1000Xaf(row.cost_usd_1000, settings.usdXafRate, multiplier);
    if (price === row.price_xaf_1000) continue;
    updates.push({ id: row.id, price });
    history.push({
      service_id: row.id,
      cost_usd_1000: row.cost_usd_1000,
      price_xaf_1000: price,
      multiplier,
      usd_xaf_rate: settings.usdXafRate,
      reason,
    });
  }
  await inBatches(updates, (u) => store.updateService(u.id, { price_xaf_1000: u.price }));
  if (history.length > 0) await store.addPriceHistory(history);
  return { repriced: updates.length };
}
