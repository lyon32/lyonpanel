import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CopyButton } from '@/components/referral/copy-button';
import { Card } from '@/components/ui/card';
import { requireUser } from '@/server/auth/require-user';
import { computeReferralBonusXaf } from '@/server/pricing/compute-referral-bonus';
import { getReferral } from '@/server/referral/referral';
import { getWallet } from '@/server/wallet/wallet';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('referral'), robots: { index: false, follow: false } };
}

const EXAMPLE_XAF = 10_000;

export default async function ReferralPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'fr';
  const user = await requireUser(lang);
  const t = await getTranslations({ locale, namespace: 'referral' });
  const [referral, wallet] = await Promise.all([getReferral(user.id), getWallet(user.id)]);
  const num = new Intl.NumberFormat(locale);
  const xaf = (n: number) => `${num.format(n)} XAF`;
  const threshold = wallet.next_discount_threshold_xaf;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-encre text-2xl font-bold">{t('title')}</h1>

      <Card className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-gris-600 text-sm font-medium">{t('code')}</span>
          <div className="flex flex-wrap items-center gap-3">
            <p
              data-testid="referral-code"
              className="text-encre text-2xl font-bold tracking-widest break-all"
            >
              {referral.code}
            </p>
            <CopyButton
              value={referral.code}
              label={t('copy')}
              copiedLabel={t('copied')}
              testId="referral-copy-code"
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-gris-600 text-sm font-medium">{t('link')}</span>
          <p data-testid="referral-link" className="text-encre text-sm break-all">
            {referral.link}
          </p>
          <div>
            <CopyButton
              value={referral.link}
              label={t('copyLink')}
              copiedLabel={t('copied')}
              testId="referral-copy-link"
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
          <span className="text-gris-600 text-sm font-medium">{t('count')}</span>
          <p data-testid="referral-count" className="text-encre text-2xl font-bold tabular-nums">
            {referral.referred_count}
          </p>
          {referral.referred_count === 0 ? (
            <p className="text-gris-600 text-sm">{t('countEmpty')}</p>
          ) : null}
        </Card>
        <Card className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
          <span className="text-gris-600 text-sm font-medium">{t('earned')}</span>
          <p data-testid="referral-earned" className="text-encre text-2xl font-bold tabular-nums">
            {xaf(referral.total_earned_xaf)}
          </p>
          {referral.total_earned_xaf === 0 ? (
            <p className="text-gris-600 text-sm">{t('earnedEmpty')}</p>
          ) : null}
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <p data-testid="referral-explainer" className="text-gris-600 text-sm">
          {t('explainer', {
            pct: referral.pct,
            example: xaf(EXAMPLE_XAF),
            bonus: xaf(computeReferralBonusXaf(EXAMPLE_XAF, referral.pct)),
          })}
        </p>
      </Card>

      {threshold !== null ? (
        <Card className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
          <h2 className="text-encre text-lg font-bold">{t('discountTitle')}</h2>
          <div
            data-testid="discount-progress"
            role="progressbar"
            aria-label={t('discountTitle')}
            aria-valuemin={0}
            aria-valuemax={threshold}
            aria-valuenow={wallet.total_recharged_xaf}
            className="bg-gris-200 h-3 w-full overflow-hidden rounded-full"
          >
            <div
              className="bg-bleu-600 h-full rounded-full"
              style={{ width: `${Math.min(100, (wallet.total_recharged_xaf / threshold) * 100)}%` }}
            />
          </div>
          <p data-testid="discount-remaining" className="text-gris-600 text-sm">
            {t('discountRemaining', {
              amount: xaf(Math.max(0, threshold - wallet.total_recharged_xaf)),
            })}
          </p>
        </Card>
      ) : (
        <Card className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
          <h2 className="text-encre text-lg font-bold">{t('discountTitle')}</h2>
          <p data-testid="discount-reached" className="text-gris-600 text-sm">
            {t('discountReached')}
          </p>
        </Card>
      )}
    </div>
  );
}
