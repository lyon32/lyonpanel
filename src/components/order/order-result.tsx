import { useTranslations } from 'next-intl';
import type { OrderOutcome } from './order-client';
import { Link } from '@/i18n/navigation';

// 201 = en cours (vert). 202 = en cours de vérification (jaune, jamais « erreur »).
export function OrderResult({ outcome }: { outcome: OrderOutcome }) {
  const t = useTranslations('order');
  const ok = outcome.status === 'in_progress';
  return (
    <div
      data-testid="order-result"
      data-status={outcome.status}
      role="status"
      className={
        ok
          ? 'text-succes bg-succes-fond flex flex-col gap-3 rounded-lg p-3 text-sm'
          : 'text-encre bg-jaune-50 flex flex-col gap-3 rounded-lg p-3 text-sm'
      }
    >
      <p className="font-semibold">
        {ok
          ? t('resultInProgress', { id: outcome.shortId })
          : t('resultToReview', { id: outcome.shortId })}
      </p>
      <p>{ok ? t('resultInProgressHelp') : t('resultToReviewHelp')}</p>
      <Link href="/orders" className="text-bleu-600 min-h-11 py-2.5 font-semibold underline">
        {t('seeOrders')}
      </Link>
    </div>
  );
}
