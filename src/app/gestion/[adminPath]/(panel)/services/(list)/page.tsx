import Link from 'next/link';
import { ServiceActiveToggle } from '@/components/admin/service-active-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/native-select';
import { formatInt, formatUsd, formatXaf } from '@/lib/admin-format';
import { listAdminServices } from '@/server/admin/services';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { networkLabel, NETWORKS, toNetwork } from '@/server/catalog/labels';
import { listServicesQuerySchema } from '@/server/schemas/admin-services';

type Props = {
  params: Promise<{ adminPath: string }>;
  searchParams: Promise<{ platform?: string; active?: string; q?: string; page?: string }>;
};

const LIMIT = 25;

export default async function AdminServicesPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { adminPath } = await params;
  const sp = await searchParams;
  const { t, locale } = await getAdminTranslator();
  const lang = locale === 'en' ? 'en' : 'fr';
  const pick = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);
  // Même validation que la route API ; une adresse trafiquée retombe sur la liste sans filtre.
  const parsed = listServicesQuerySchema.safeParse({
    platform: pick(sp.platform),
    active: pick(sp.active),
    q: pick(sp.q),
    page: pick(sp.page),
    limit: LIMIT,
  });
  const query = parsed.success ? parsed.data : listServicesQuerySchema.parse({ limit: LIMIT });
  const result = await listAdminServices(query);
  const href = (page: number) => {
    const p = new URLSearchParams();
    if (query.platform) p.set('platform', query.platform);
    if (query.active) p.set('active', query.active);
    if (query.q) p.set('q', query.q);
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    return `/${adminPath}/services${qs ? `?${qs}` : ''}`;
  };
  const pageLink =
    'border-gris-200 bg-blanc text-bleu-600 hover:bg-bleu-50 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold outline-none focus-visible:ring-4';

  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('services.title')}</h1>
      <form method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <label htmlFor="platform" className="text-encre text-sm font-semibold">
            {t('services.network')}
          </label>
          <NativeSelect
            id="platform"
            name="platform"
            defaultValue={query.platform ?? ''}
            className="h-11"
          >
            <option value="">{t('services.allNetworks')}</option>
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {networkLabel(n, lang)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="active" className="text-encre text-sm font-semibold">
            {t('services.visibility')}
          </label>
          <NativeSelect
            id="active"
            name="active"
            defaultValue={query.active ?? ''}
            className="h-11"
          >
            <option value="">{t('services.all')}</option>
            <option value="true">{t('services.activeOnly')}</option>
            <option value="false">{t('services.hiddenOnly')}</option>
          </NativeSelect>
        </div>
        <Field
          name="q"
          type="search"
          label={t('services.search')}
          defaultValue={query.q ?? ''}
          maxLength={100}
          className="flex-1"
        />
        <Button type="submit">{t('services.searchSubmit')}</Button>
      </form>

      <p className="text-gris-600 text-sm tabular-nums">
        {t('services.count', { count: formatInt(result.total, locale) })}
      </p>

      {result.items.length === 0 ? (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
          {t('services.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.items.map((s) => {
            const name =
              (lang === 'en' ? s.custom_name_en : s.custom_name_fr) ||
              (lang === 'en' ? s.name_en : s.name_fr);
            return (
              <li
                key={s.id}
                className="border-gris-200 bg-blanc flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/${adminPath}/services/${s.id}`}
                    className="text-bleu-600 focus-visible:ring-bleu-100 min-h-11 font-semibold break-words outline-none hover:underline focus-visible:ring-4"
                  >
                    {name}
                  </Link>
                  <Badge status={s.active ? 'success' : 'failed'}>
                    {s.active ? t('services.active') : t('services.hidden')}
                  </Badge>
                </div>
                <p className="text-gris-600 text-sm tabular-nums">
                  #{s.id} · {networkLabel(toNetwork(s.platform), lang)} · {s.provider_name}
                </p>
                <p className="text-gris-600 text-sm tabular-nums">
                  {t('services.cost')} :{' '}
                  {s.cost_usd_1000 === null ? '—' : formatUsd(s.cost_usd_1000, locale)} ·{' '}
                  {t('services.price')} : {formatXaf(s.price_xaf_1000, locale)} · ×{s.multiplier}
                </p>
                <ServiceActiveToggle serviceId={s.id} active={s.active} />
              </li>
            );
          })}
        </ul>
      )}

      <nav aria-label={t('services.pages')} className="flex flex-wrap gap-2">
        {query.page > 1 ? (
          <Link href={href(query.page - 1)} className={pageLink}>
            {t('common.previous')}
          </Link>
        ) : null}
        {result.hasMore ? (
          <Link href={href(query.page + 1)} className={pageLink}>
            {t('common.next')}
          </Link>
        ) : null}
      </nav>
    </>
  );
}
