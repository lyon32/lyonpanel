'use client';

import { Check, CircleX, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FormAlert } from '@/components/auth/form-alert';
import { usePaymentStatus } from '@/hooks/use-payment-status';
import { Link } from '@/i18n/navigation';

export type PaymentView = 'pending' | 'succeeded' | 'failed';

type Props = { status: PaymentView; amountXaf: number; balanceXaf: number };

const linkBase =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bleu-600';

// Le statut vient du serveur ; la page se met à jour d'elle-même tant que le paiement est en attente.
export function PaymentStatus({ status, amountXaf, balanceXaf }: Props) {
  const t = useTranslations('wallet');
  const locale = useLocale();
  const { timedOut } = usePaymentStatus(status !== 'pending');
  const xaf = (value: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} XAF`;
  const pending = status === 'pending';

  return (
    <div className="border-gris-200 bg-blanc flex max-w-md flex-col gap-5 rounded-xl border p-4 sm:p-6">
      <ol className="flex flex-col gap-3" aria-label={t('stepsLabel')}>
        <li className="flex items-center gap-3 text-sm">
          <span className="bg-succes-fond text-succes flex size-8 items-center justify-center rounded-full">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <span className="text-encre font-semibold">{t('stepPaid')}</span>
        </li>
        <li className="flex items-center gap-3 text-sm">
          <span
            className={
              status === 'succeeded'
                ? 'bg-succes-fond text-succes flex size-8 items-center justify-center rounded-full'
                : status === 'failed'
                  ? 'bg-erreur-fond text-erreur flex size-8 items-center justify-center rounded-full'
                  : 'bg-bleu-50 text-bleu-600 flex size-8 items-center justify-center rounded-full'
            }
          >
            {status === 'succeeded' ? (
              <Check className="size-5" aria-hidden="true" />
            ) : status === 'failed' ? (
              <CircleX className="size-5" aria-hidden="true" />
            ) : (
              <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden="true" />
            )}
          </span>
          <span className={pending ? 'text-gris-600' : 'text-encre font-semibold'}>
            {status === 'failed'
              ? t('stepFailed')
              : status === 'succeeded'
                ? t('stepCredited')
                : t('stepWaiting')}
          </span>
        </li>
      </ol>
      <div
        data-testid="payment-status"
        data-status={status}
        aria-live="polite"
        className="flex flex-col gap-3"
      >
        {status === 'succeeded' ? (
          <FormAlert kind="success">{t('statusSucceeded', { amount: xaf(amountXaf) })}</FormAlert>
        ) : status === 'failed' ? (
          <FormAlert kind="error">{t('statusFailed')}</FormAlert>
        ) : (
          <>
            <p role="status" className="text-gris-600 text-sm">
              {timedOut ? t('statusTimedOut') : t('statusPending')}
            </p>
            <p className="bg-jaune-50 text-encre rounded-lg p-3 text-sm">{t('doNotPayTwice')}</p>
          </>
        )}
      </div>
      <p className="border-gris-200 flex items-baseline justify-between border-t pt-4 text-sm">
        <span className="text-gris-600">{t('balance')}</span>
        <strong data-testid="wallet-balance" className="text-xl tabular-nums">
          {xaf(balanceXaf)}
        </strong>
      </p>
      <div className="flex flex-col gap-2">
        {status === 'succeeded' ? (
          <Link
            href="/dashboard"
            className={`${linkBase} bg-bleu-600 hover:bg-bleu-700 text-blanc`}
          >
            {t('toDashboard')}
          </Link>
        ) : (
          <>
            <Link
              href="/add-funds"
              className={
                status === 'failed'
                  ? `${linkBase} bg-bleu-600 hover:bg-bleu-700 text-blanc`
                  : `${linkBase} text-bleu-600 hover:bg-bleu-50`
              }
            >
              {status === 'failed' ? t('retry') : t('newTopUp')}
            </Link>
            <Link href="/dashboard" className={`${linkBase} text-bleu-600 hover:bg-bleu-50`}>
              {t('toDashboard')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
