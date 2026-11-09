import { buildServiceName } from '@/server/catalog/build-name';
import { classifyNetwork, classifyType } from '@/server/catalog/classify';
import {
  networkLabel,
  typeLabel,
  NETWORKS,
  SERVICE_TYPES,
  type Network,
  type ServiceType,
} from '@/server/catalog/labels';
import { computeMinOrderXaf, computePricePer1000Xaf } from '@/server/pricing/compute-price';
import type { ProviderService } from '@/server/providers/types';

export const USD_XAF_RATE = 600;
export const DEFAULT_MULTIPLIER = 3;

export interface CatalogueRow {
  id: number;
  platform: Network;
  category: ServiceType;
  name: string;
  minQty: number;
  maxQty: number;
  costUsd1000: number;
  costXaf1000: number;
  multiplier: number;
  priceXaf1000: number;
  minOrderXaf: number;
  refill: boolean;
  cancel: boolean;
}

/** Applique exactement les fonctions du projet (même calcul que la synchronisation). */
export function buildRows(services: ProviderService[]): CatalogueRow[] {
  return services.map((s) => {
    const platform = classifyNetwork(s.name, s.category);
    const category = classifyType(s.name, s.type);
    const priceXaf1000 = computePricePer1000Xaf(s.rate, USD_XAF_RATE, DEFAULT_MULTIPLIER);
    return {
      id: s.service,
      platform,
      category,
      name: buildServiceName(
        {
          id: s.service,
          platform,
          category,
          refill: s.refill,
          cancel: s.cancel,
          dripfeed: s.dripfeed,
          min_qty: s.min,
          max_qty: s.max,
          providerName: s.name,
          providerCategory: s.category,
        },
        'fr',
      ),
      minQty: s.min,
      maxQty: s.max,
      costUsd1000: s.rate,
      costXaf1000: Math.round(s.rate * USD_XAF_RATE * 100) / 100,
      multiplier: DEFAULT_MULTIPLIER,
      priceXaf1000,
      minOrderXaf: computeMinOrderXaf(priceXaf1000, s.min),
      refill: s.refill,
      cancel: s.cancel,
    };
  });
}

const HEADER = [
  'numéro',
  'réseau',
  'type',
  'nom',
  'quantité minimum',
  'quantité maximum',
  'prix fournisseur pour 1000 (USD)',
  'prix fournisseur pour 1000 (XAF)',
  'multiplicateur',
  'prix de vente pour 1000 (XAF)',
  'prix de la commande minimum (XAF)',
  'recharge',
  'annulation',
];

function cell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

/** CSV UTF-8 avec BOM (Excel). Jamais le nom d'origine du fournisseur. */
export function toCsv(rows: CatalogueRow[]): string {
  const lines = rows.map((r) =>
    [
      r.id,
      networkLabel(r.platform, 'fr'),
      typeLabel(r.category, 'fr'),
      r.name,
      r.minQty,
      r.maxQty,
      r.costUsd1000,
      r.costXaf1000,
      r.multiplier,
      r.priceXaf1000,
      r.minOrderXaf,
      r.refill ? 'oui' : 'non',
      r.cancel ? 'oui' : 'non',
    ]
      .map(cell)
      .join(','),
  );
  return `﻿${[HEADER.map(cell).join(','), ...lines].join('\r\n')}\r\n`;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

const fmt = (n: number) => n.toLocaleString('fr-FR').replaceAll(' ', ' ').replaceAll(' ', ' ');

export function buildSummary(rows: CatalogueRow[]) {
  const counts: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    counts[r.platform] ??= {};
    counts[r.platform]![r.category] = (counts[r.platform]![r.category] ?? 0) + 1;
  }
  const byPrice = [...rows].sort((a, b) => a.priceXaf1000 - b.priceXaf1000);
  const pick = (r: CatalogueRow) => ({ id: r.id, name: r.name, priceXaf1000: r.priceXaf1000 });
  return {
    total: rows.length,
    countsByNetworkAndType: counts,
    cheapest: byPrice.slice(0, 5).map(pick),
    mostExpensive: byPrice.slice(-5).reverse().map(pick),
  };
}

/** Tableaux Markdown pour docs/01. */
export function buildMarkdown(rows: CatalogueRow[]) {
  const networks = NETWORKS.filter((n) => rows.some((r) => r.platform === n));
  const types = SERVICE_TYPES.filter((t) => rows.some((r) => r.category === t));
  const recap = [
    `| Réseau | ${types.map((t) => typeLabel(t, 'fr')).join(' | ')} | Total |`,
    `|---|${types.map(() => '---:').join('|')}|---:|`,
    ...networks.map((n) => {
      const mine = rows.filter((r) => r.platform === n);
      const cells = types.map((t) => mine.filter((r) => r.category === t).length);
      return `| ${networkLabel(n, 'fr')} | ${cells.join(' | ')} | ${mine.length} |`;
    }),
    `| **Total** | ${types.map((t) => rows.filter((r) => r.category === t).length).join(' | ')} | **${rows.length}** |`,
  ].join('\n');

  const perNetwork = networks.map((n) => {
    const mine = rows.filter((r) => r.platform === n);
    const lines = types
      .map((t) => ({ t, list: mine.filter((r) => r.category === t) }))
      .filter((x) => x.list.length > 0)
      .map(
        ({ t, list }) =>
          `| ${typeLabel(t, 'fr')} | ${list.length} | ${fmt(median(list.map((r) => r.priceXaf1000)))} | ${fmt(median(list.map((r) => r.minOrderXaf)))} |`,
      );
    return [
      `#### ${networkLabel(n, 'fr')} (${mine.length} services)`,
      '',
      '| Type | Services | Prix de vente médian pour 1 000 (XAF) | Commande minimum médiane (XAF) |',
      '|---|---:|---:|---:|',
      ...lines,
    ].join('\n');
  });

  const expensive = rows
    .filter((r) => r.costUsd1000 > 100)
    .sort((a, b) => b.costUsd1000 - a.costUsd1000);
  const bigMin = rows
    .filter((r) => r.minOrderXaf > 5000)
    .sort((a, b) => b.minOrderXaf - a.minOrderXaf);
  const list = (items: CatalogueRow[], limit: number) =>
    [
      '| Numéro | Nom | Prix de vente pour 1 000 (XAF) | Commande minimum (XAF) |',
      '|---:|---|---:|---:|',
      ...items
        .slice(0, limit)
        .map((r) => `| ${r.id} | ${r.name} | ${fmt(r.priceXaf1000)} | ${fmt(r.minOrderXaf)} |`),
    ].join('\n');

  return {
    recap,
    perNetwork: perNetwork.join('\n\n'),
    expensive: { count: expensive.length, table: list(expensive, 30) },
    bigMin: { count: bigMin.length, table: list(bigMin, 30) },
  };
}
