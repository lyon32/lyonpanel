export const CURRENCIES = ['XAF', 'XOF', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_COOKIE = 'NEXT_CURRENCY';
// 1 an, sans donnée personnelle.
export const CURRENCY_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
  path: '/',
} as const;

// Taux de démonstration (1 XAF = x devise), pour l'affichage seulement.
// Les vrais taux viendront des réglages ; le serveur débite toujours en XAF.
export const DEMO_RATES: Record<Currency, number> = {
  XAF: 1,
  XOF: 1,
  USD: 0.0016,
};

export function parseCurrency(value: unknown): Currency {
  return CURRENCIES.find((c) => c === value) ?? 'XAF';
}

// Entrée toujours en XAF entiers ; XAF/XOF sans décimales, USD à 2 décimales.
export function formatMoney(amountXaf: number, currency: Currency, locale: string): string {
  if (!Number.isInteger(amountXaf)) throw new Error('amountXaf doit être un entier');
  const converted = amountXaf * DEMO_RATES[currency];
  if (currency === 'USD') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(converted);
  }
  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    Math.round(converted),
  );
  return `${amount} ${currency}`;
}
