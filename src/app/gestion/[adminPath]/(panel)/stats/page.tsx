import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STATS_RANGES, formatInt, formatUsd, formatXaf, parseRange } from '@/lib/admin-format';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminStats } from '@/server/admin/stats';

type Props = {
  params: Promise<{ adminPath: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
};

export default async function AdminStatsPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { adminPath } = await params;
  const range = parseRange((await searchParams).range);
  const { t, locale } = await getAdminTranslator();
  const stats = await getAdminStats(range);

  const cards = [
    { label: t('stats.sales'), value: formatXaf(stats.sales_xaf, locale), hint: null },
    { label: t('stats.profit'), value: formatXaf(stats.profit_xaf, locale), hint: null },
    { label: t('stats.orders'), value: formatInt(stats.orders_count, locale), hint: null },
    {
      label: t('stats.recharges'),
      value: formatXaf(stats.recharges_xaf, locale),
      hint: t('stats.rechargesCount', { count: formatInt(stats.recharges_count, locale) }),
    },
    { label: t('stats.newUsers'), value: formatInt(stats.new_users_count, locale), hint: null },
  ];

  const low = stats.provider_low;
  const unit = 'text-encre text-2xl font-bold tabular-nums';
  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('stats.title')}</h1>

      {low ? (
        <div
          role="alert"
          data-testid="provider-low"
          className="border-erreur bg-erreur-fond flex items-start gap-3 rounded-xl border-2 p-4"
        >
          <TriangleAlert className="text-erreur mt-0.5 size-6 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <p className="text-erreur text-base font-bold">{t('stats.providerLowTitle')}</p>
            <p className="text-encre text-sm">{t('stats.providerLow')}</p>
          </div>
        </div>
      ) : null}

      <nav
        aria-label={t('stats.range.label')}
        className="bg-blanc border-gris-200 flex w-full gap-1 rounded-xl border p-1 sm:w-fit"
      >
        {STATS_RANGES.map((r) => (
          <Link
            key={r}
            href={`/${adminPath}/stats?range=${r}`}
            aria-current={r === range ? 'page' : undefined}
            className={
              r === range
                ? 'bg-bleu-600 text-blanc focus-visible:ring-bleu-100 inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-4 sm:flex-none'
                : 'text-encre hover:bg-gris-50 focus-visible:ring-bleu-100 inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-4 sm:flex-none'
            }
          >
            {t(`stats.range.${r}`)}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="p-4 pb-1">
              <CardTitle className="text-gris-600 text-sm font-semibold">{c.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className={`${unit} break-words`}>{c.value}</p>
              {c.hint ? <p className="text-gris-600 text-sm">{c.hint}</p> : null}
            </CardContent>
          </Card>
        ))}
        <Card
          data-testid="provider-balance"
          className={low ? 'border-erreur bg-erreur-fond border-2' : undefined}
        >
          <CardHeader className="p-4 pb-1">
            <CardTitle className={`${low ? 'text-erreur' : 'text-gris-600'} text-sm font-semibold`}>
              {t('stats.provider')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className={`${low ? 'text-erreur' : 'text-encre'} text-2xl font-bold tabular-nums`}>
              {stats.provider_balance_usd === null
                ? t('stats.providerUnknown')
                : formatUsd(stats.provider_balance_usd, locale)}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-encre text-lg font-bold">{t('stats.byCountry')}</h2>
        {stats.by_country.length === 0 ? (
          <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
            {t('stats.noSales')}
          </p>
        ) : (
          <div className="border-gris-200 bg-blanc overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gris-50 text-gris-600">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    {t('stats.country')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    {t('stats.orders')}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    {t('stats.sales')}
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {stats.by_country.map((c) => (
                  <tr key={c.country} className="border-gris-200 border-t">
                    <td className="px-4 py-3 font-semibold">{c.country}</td>
                    <td className="px-4 py-3 text-right">{formatInt(c.orders_count, locale)}</td>
                    <td className="px-4 py-3 text-right">{formatXaf(c.sales_xaf, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
