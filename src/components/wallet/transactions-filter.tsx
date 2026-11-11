'use client';

import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { useRouter } from '@/i18n/navigation';

const TYPES = ['recharge', 'order', 'refund', 'referral_bonus', 'adjustment'] as const;

// Filtre par type : change l'adresse (?type=…), la liste est relue côté serveur.
export function TransactionsFilter({ value }: { value: string }) {
  const t = useTranslations('transactions');
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label htmlFor={id} className="text-gris-600 text-sm font-medium">
        {t('filterLabel')}
      </label>
      <select
        id={id}
        data-testid="transactions-filter"
        value={value}
        onChange={(e) =>
          router.replace(
            e.target.value
              ? { pathname: '/transactions', query: { type: e.target.value } }
              : { pathname: '/transactions' },
          )
        }
        className="border-gris-200 bg-blanc text-encre focus-visible:border-bleu-600 focus-visible:ring-bleu-100 min-h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-4 sm:w-60"
      >
        <option value="">{t('filterAll')}</option>
        {TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`types.${type}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
