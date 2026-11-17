import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ServiceEditForm } from '@/components/admin/service-edit-form';
import { Badge } from '@/components/ui/badge';
import { formatUsd, formatXaf } from '@/lib/admin-format';
import { networkLabel, toNetwork } from '@/server/catalog/labels';
import { getAdminService } from '@/server/admin/services';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminTranslator } from '@/server/admin/page-i18n';

type Props = { params: Promise<{ adminPath: string; id: string }> };

export default async function AdminServicePage({ params }: Props) {
  await requireAdminPage();
  const { adminPath, id } = await params;
  const { t, locale } = await getAdminTranslator();
  // Identifiant mal formé ou inconnu : 404, comme le reste de l'admin.
  if (!/^\d{1,9}$/.test(id)) notFound();
  const s = await getAdminService(Number(id));
  if (!s) notFound();

  return (
    <>
      <Link
        href={`/${adminPath}/services`}
        className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 w-fit items-center gap-2 font-semibold outline-none focus-visible:ring-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('services.back')}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-encre text-2xl font-bold">
          {t('services.edit')} #{s.id}
        </h1>
        <Badge status={s.active ? 'success' : 'failed'}>
          {s.active ? t('services.active') : t('services.hidden')}
        </Badge>
      </div>
      <dl className="border-gris-200 bg-blanc grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2 sm:p-5">
        <div>
          <dt className="text-gris-600">{t('services.provider')}</dt>
          <dd className="text-encre font-semibold break-words">{s.provider_name}</dd>
        </div>
        <div>
          <dt className="text-gris-600">{t('services.cost')}</dt>
          <dd className="text-encre font-semibold tabular-nums">
            {s.cost_usd_1000 === null ? '—' : formatUsd(s.cost_usd_1000, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-gris-600">{t('services.price')}</dt>
          <dd className="text-encre font-semibold tabular-nums">
            {formatXaf(s.price_xaf_1000, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-gris-600">{t('services.network')}</dt>
          <dd className="text-encre font-semibold">
            {networkLabel(toNetwork(s.platform), locale === 'en' ? 'en' : 'fr')}
          </dd>
        </div>
      </dl>
      <ServiceEditForm
        locale={locale}
        service={{
          id: s.id,
          nameFr: s.name_fr,
          nameEn: s.name_en,
          descriptionFr: s.description_fr,
          descriptionEn: s.description_en,
          customNameFr: s.custom_name_fr,
          customNameEn: s.custom_name_en,
          customDescriptionFr: s.custom_description_fr,
          customDescriptionEn: s.custom_description_en,
          multiplier: s.multiplier,
          sortOrder: s.sort_order,
        }}
      />
    </>
  );
}
