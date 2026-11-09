import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/catalog/breadcrumb';
import { CardLink } from '@/components/catalog/card-link';
import { NetworkIcon } from '@/components/catalog/network-icon';
import { JsonLd } from '@/components/seo/json-ld';
import { asLang, breadcrumbLd, catalogMetadata, itemListLd } from '@/lib/seo/catalog-seo';
import { EmptyState } from '@/components/shared/empty-state';
import { loadCatalogView } from '@/server/catalog/load-catalog';
import { asCatalogLocale } from '@/server/catalog/page-params';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'catalog' });
  return catalogMetadata({
    lang: asLang(locale),
    path: '/services',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function ServicesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('catalog');
  const { catalog } = await loadCatalogView(asCatalogLocale(locale));

  const lang = asLang(locale);
  const crumbs = [{ name: t('allServices'), path: '/services' }];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <JsonLd data={breadcrumbLd(lang, crumbs)} />
      <JsonLd
        data={itemListLd(
          lang,
          catalog.networks.map((n) => ({ name: n.label, path: `/services/${n.network}` })),
        )}
      />
      <Breadcrumb items={[{ label: t('allServices') }]} />
      <h1 className="text-encre text-[28px] leading-tight font-bold md:text-[40px]">
        {t('title')}
      </h1>
      <p className="text-gris-600 mt-2 mb-6">{t('intro')}</p>
      {catalog.networks.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyText')} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.networks.map((n) => (
            <li key={n.network}>
              <CardLink
                testId="network-card"
                href={{ pathname: '/services/[network]', params: { network: n.network } }}
                title={n.label}
                icon={<NetworkIcon network={n.network} />}
                detail={t('servicesCount', {
                  count: n.types.reduce((sum, ty) => sum + ty.services.length, 0),
                })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
