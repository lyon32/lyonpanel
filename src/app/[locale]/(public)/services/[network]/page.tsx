import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/catalog/breadcrumb';
import { CardLink } from '@/components/catalog/card-link';
import { JsonLd } from '@/components/seo/json-ld';
import { asLang, breadcrumbLd, catalogMetadata, fitTitle } from '@/lib/seo/catalog-seo';
import { networkLabel } from '@/server/catalog/labels';
import { loadCatalogView } from '@/server/catalog/load-catalog';
import { asCatalogLocale, parseNetwork } from '@/server/catalog/page-params';

type Props = { params: Promise<{ locale: string; network: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, network } = await params;
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const name = networkLabel(parseNetwork(network), asCatalogLocale(locale));
  return catalogMetadata({
    lang: asLang(locale),
    path: `/services/${parseNetwork(network)}`,
    title: fitTitle(t('networkMetaTitle', { network: name }), ''),
    description: t('networkMetaDescription', { network: name }),
  });
}

export default async function NetworkPage({ params }: Props) {
  const { locale, network: raw } = await params;
  setRequestLocale(locale);
  const network = parseNetwork(raw);
  const t = await getTranslations('catalog');
  const { catalog } = await loadCatalogView(asCatalogLocale(locale));
  const entry = catalog.networks.find((n) => n.network === network);
  if (!entry) notFound();

  const lang = asLang(locale);
  const crumbs = [
    { name: t('allServices'), path: '/services' },
    { name: entry.label, path: `/services/${network}` },
  ];
  const intro = t.has(`networkIntros.${network}`)
    ? t(`networkIntros.${network}`)
    : t('networkIntro');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <JsonLd data={breadcrumbLd(lang, crumbs)} />
      <Breadcrumb
        items={[{ label: t('allServices'), href: '/services' }, { label: entry.label }]}
      />
      <h1 className="text-encre text-[28px] leading-tight font-bold md:text-[40px]">
        {t('networkTitle', { network: entry.label })}
      </h1>
      <p className="text-gris-600 mt-2 mb-6">{intro}</p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {entry.types.map((ty) => (
          <li key={ty.type}>
            <CardLink
              testId="type-card"
              href={{ pathname: '/services/[network]/[type]', params: { network, type: ty.type } }}
              title={ty.label}
              detail={t('servicesCount', { count: ty.services.length })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
