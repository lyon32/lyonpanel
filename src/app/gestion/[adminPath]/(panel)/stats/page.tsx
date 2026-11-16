import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormAlert } from '@/components/auth/form-alert';
import { STATS_RANGES, formatUsd, formatXaf, parseRange } from '@/lib/admin-format';
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
    { label: t('stats.orders'), value: String(stats.orders_count), hint: null },
    {
      label: t('stats.recharges'),
      value: formatXaf(stats.recharges_xaf, locale),
      hint: t('stats.rechargesCount', { count: stats.recharges_count }),
    },
    { label: t('stats.newUsers'), value: String(stats.new_users_count), hint: null },
  ];

  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('stats.title')}</h1>
      <nav aria-label={t('stats.range.label')} className="flex gap-2">
        {STATS_RANGES.map((r) => (
          <Link
            key={r}
            href={`/${adminPath}/stats?range=${r}`}
            aria-current={r === range ? 'page' : undefined}
            className={
              r === range
                ? 'bg-bleu-600 text-blanc rounded-lg px-4 py-2 text-sm font-semibold'
                : 'border-gris-200 text-encre rounded-lg border px-4 py-2 text-sm font-semibold'
            }
          >
            {t(`stats.range.${r}`)}
          </Link>
        ))}
      </nav>

      {stats.provider_low ? <FormAlert kind="error">{t('stats.providerLow')}</FormAlert> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader>
              <CardTitle className="text-gris-600 text-sm font-semibold">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-encre text-2xl font-bold">{c.value}</p>
              {c.hint ? <p className="text-gris-600 text-sm">{c.hint}</p> : null}
            </CardContent>
          </Card>
        ))}
        <Card data-testid="provider-balance">
          <CardHeader>
            <CardTitle className="text-gris-600 text-sm font-semibold">
              {t('stats.provider')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-encre text-2xl font-bold">
              {stats.provider_balance_usd === null
                ? t('stats.providerUnknown')
                : formatUsd(stats.provider_balance_usd, locale)}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-encre text-lg font-bold">{t('stats.byCountry')}</h2>
        {stats.by_country.length === 0 ? (
          <p className="text-gris-600">{t('stats.noSales')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gris-600">
                <th className="py-2">{t('stats.country')}</th>
                <th className="py-2">{t('stats.orders')}</th>
                <th className="py-2">{t('stats.sales')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.by_country.map((c) => (
                <tr key={c.country} className="border-gris-200 border-t">
                  <td className="py-2">{c.country}</td>
                  <td className="py-2">{c.orders_count}</td>
                  <td className="py-2">{formatXaf(c.sales_xaf, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
