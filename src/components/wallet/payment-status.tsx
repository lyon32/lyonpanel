'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormAlert } from '@/components/auth/form-alert';
import { usePaymentStatus } from '@/hooks/use-payment-status';
import { Link } from '@/i18n/navigation';

export type PaymentView = 'pending' | 'succeeded' | 'failed';

type Props = { status: PaymentView; amountXaf: number; balanceXaf: number };

// Le statut vient du serveur ; la page se met à jour d'elle-même tant que le paiement est en attente.
export function PaymentStatus({ status, amountXaf, balanceXaf }: Props) {
  const t = useTranslations('wallet');
  const locale = useLocale();
  const { timedOut } = usePaymentStatus(status !== 'pending');
  const xaf = (value: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} XAF`;

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div data-testid="payment-status" data-status={status} className="flex flex-col gap-3">
        {status === 'succeeded' ? (
          <FormAlert kind="success">{t('statusSucceeded', { amount: xaf(amountXaf) })}</FormAlert>
        ) : status === 'failed' ? (
          <FormAlert kind="error">{t('statusFailed')}</FormAlert>
        ) : (
          <p role="status" className="text-gris-600 text-sm">
            {timedOut ? t('statusTimedOut') : t('statusPending')}
          </p>
        )}
      </div>
      <p className="text-sm">
        {t('balance')} <strong data-testid="wallet-balance">{xaf(balanceXaf)}</strong>
      </p>
      <Link
        href="/add-funds"
        className="text-bleu-600 hover:text-bleu-700 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
      >
        {status === 'failed' ? t('retry') : t('newTopUp')}
      </Link>
    </div>
  );
}
