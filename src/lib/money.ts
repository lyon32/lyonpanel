import type { Currency } from '@/lib/currency';

// Affichage seulement : le serveur débite toujours en XAF entiers.

export function convertFromXaf(amountXaf: number, currency: Currency, usdXafRate: number): number {
  if (!Number.isInteger(amountXaf)) throw new Error('amountXaf doit être un entier');
  if (currency !== 'USD') return amountXaf;
  if (!Number.isFinite(usdXafRate) || usdXafRate <= 0) throw new Error('Taux USD/XAF invalide');
  // Centimes en entiers, arrondi demi vers le haut : xaf*100/taux, taux en 1/1 000.
  const rate = BigInt(Math.round(usdXafRate * 1000));
  if (rate <= 0n) throw new Error('Taux USD/XAF invalide');
  const cents = (BigInt(amountXaf) * 100_000n * 2n + rate) / (2n * rate);
  return Number(cents) / 100;
}

export function formatCatalogMoney(
  amountXaf: number,
  currency: Currency,
  locale: string,
  usdXafRate: number,
): string {
  const value = convertFromXaf(amountXaf, currency, usdXafRate);
  if (currency === 'USD') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} ${currency}`;
}
