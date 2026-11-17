import type { StatsRange } from '@/server/admin/stats-range';

const RANGES: readonly StatsRange[] = ['today', '7d', '30d'];

/** Période demandée dans l'adresse : toute valeur inconnue retombe sur « aujourd'hui ». */
export function parseRange(value: string | string[] | undefined): StatsRange {
  const v = Array.isArray(value) ? value[0] : value;
  return RANGES.find((r) => r === v) ?? 'today';
}

export const STATS_RANGES = RANGES;

/** Montant XAF entier, espaces entre les milliers : « 12 500 XAF ». */
export function formatXaf(amountXaf: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amountXaf)} XAF`;
}

/** Entier avec séparateur de milliers (« 1 174 »). */
export function formatInt(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatUsd(amountUsd: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(amountUsd);
}

export function formatDateTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Africa/Douala',
  }).format(new Date(iso));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

/** Libellé traduit d'un statut de commande ; un statut inconnu reste affiché tel quel. */
export function orderStatusLabel(status: string, labels: Record<string, string>): string {
  return labels[status] ?? status;
}

/** Couleur de la pastille d'après le sens du statut (terminé, échec, en cours). */
export function orderBadgeStatus(status: string): 'success' | 'failed' | 'pending' {
  if (status === 'completed') return 'success';
  if (['canceled', 'refunded', 'partial', 'to_review'].includes(status)) return 'failed';
  return 'pending';
}

export const ORDER_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'partial',
  'canceled',
  'to_review',
  'refunded',
] as const;
