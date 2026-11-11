import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TransactionsFilter } from '@/components/wallet/transactions-filter';
import { EmptyState } from '@/components/shared/empty-state';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { formatCatalogMoney } from '@/lib/money';
import { requireUser } from '@/server/auth/require-user';
import { getUsdXafRateCached } from '@/server/catalog/public-catalog';
import { TX_TYPES, listTransactions, type TxType } from '@/server/wallet/list-transactions';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string; cursor?: string }>;
};

const PAGE_SIZE = 20;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('transactions'), robots: { index: false, follow: false } };
}

export default async function TransactionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requireUser(locale === 'en' ? 'en' : 'fr');
  const t = await getTranslations({ locale, namespace: 'transactions' });
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  const type: TxType | undefined = TX_TYPES.find((x) => x === query.type);
  // Un curseur illisible fait lever une erreur 400 côté serveur : on repart du début.
  let page;
  try {
    page = await listTransactions(user.id, { type, limit: PAGE_SIZE, cursor: query.cursor });
  } catch {
    page = await listTransactions(user.id, { type, limit: PAGE_SIZE });
  }
  const usdXafRate = currency === 'USD' ? await getUsdXafRateCached() : 1;
  const money = (xaf: number) => formatCatalogMoney(xaf, currency, locale, usdXafRate);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="text-encre text-2xl font-bold md:text-3xl">{t('title')}</h1>
        <TransactionsFilter value={type ?? ''} />
      </div>
      {page.data.length === 0 ? (
        <EmptyState
          title={type ? t('emptyFiltered') : t('empty')}
          description={type ? undefined : t('emptyHint')}
        />
      ) : (
        <Card>
          <ul className="divide-gris-200 divide-y">
            {page.data.map((tx) => (
              <li
                key={tx.id}
                data-testid="transaction-row"
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="text-encre font-medium">{t(`types.${tx.type}`)}</p>
                  <p className="text-gris-600 text-sm">
                    {date.format(new Date(tx.created_at))}
                    {tx.order_short_id ? ` · ${t('orderRef', { id: tx.order_short_id })}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p
                    className={`font-semibold ${tx.amount_xaf >= 0 ? 'text-succes' : 'text-encre'}`}
                  >
                    {tx.amount_xaf > 0 ? '+' : ''}
                    {money(tx.amount_xaf)}
                  </p>
                  <p className="text-gris-600 text-sm">
                    {t('balanceAfter', { amount: money(tx.balance_after_xaf) })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <nav aria-label={t('paging')} className="flex flex-wrap items-center gap-3">
        {query.cursor ? (
          <Link
            href={{ pathname: '/transactions', query: type ? { type } : {} }}
            className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-2 font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-4"
          >
            {t('first')}
          </Link>
        ) : null}
        {page.next_cursor ? (
          <Link
            href={{
              pathname: '/transactions',
              query: { ...(type ? { type } : {}), cursor: page.next_cursor },
            }}
            className="border-gris-200 text-encre hover:bg-gris-50 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold outline-none focus-visible:ring-4"
          >
            {t('next')}
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
