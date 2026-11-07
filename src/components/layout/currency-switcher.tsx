'use client';

import { useTranslations } from 'next-intl';
import { CURRENCIES, parseCurrency, type Currency } from '@/lib/currency';

type Props = {
  value: Currency;
  // Server action : écrit le cookie devise (affichage seulement).
  setCurrencyCookie: (currency: Currency) => void | Promise<void>;
};

export function CurrencySwitcher({ value, setCurrencyCookie }: Props) {
  const t = useTranslations('currency');
  return (
    <select
      aria-label={t('label')}
      value={value}
      onChange={(e) => void setCurrencyCookie(parseCurrency(e.target.value))}
      className="border-gris-200 bg-blanc text-encre focus-visible:ring-bleu-100 min-h-11 rounded-lg border px-2 text-sm font-semibold outline-none focus-visible:ring-4"
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
