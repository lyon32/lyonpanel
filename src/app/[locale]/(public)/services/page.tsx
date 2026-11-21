import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/catalog/breadcrumb';
import { JsonLd } from '@/components/seo/json-ld';
import { asLang, breadcrumbLd, catalogMetadata, itemListLd } from '@/lib/seo/catalog-seo';
import { CatalogError } from '@/components/platform/catalog-error';
import { NetworkCard, PlatformLogo } from '@/components/platform/network-card';
import { countServices, fromPriceXaf, splitNetworks } from '@/components/platform/network-summary';
import { safeLoad } from '@/components/platform/safe-load';
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
  const p = await getTranslations('platform');
  const loaded = await safeLoad(() => loadCatalogView(asCatalogLocale(locale)));
  if (!loaded.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-[28px] leading-tight font-bold text-[var(--lp-gray-12)] md:text-[40px]">
          {t('title')}
        </h1>
        <div className="mt-6">
          <CatalogError />
        </div>
      </div>
    );
  }
  const { catalog } = loaded.value;
  const { rich, others } = splitNetworks(catalog.networks);
  const card = (n: (typeof catalog.networks)[number], isRich: boolean) => {
    const price = fromPriceXaf(n.types.flatMap((ty) => ty.services));
    // Réseau mince : pas de page propre, on mène au premier type qui a des services.
    const first = isRich ? undefined : n.types.find((ty) => ty.services.length > 0);
    const href = isRich
      ? ({ pathname: '/services/[network]', params: { network: n.network } } as const)
      : first
        ? ({
            pathname: '/services/[network]/[type]',
            params: { network: n.network, type: first.type },
          } as const)
        : undefined;
    return (
      <li key={n.network}>
        <NetworkCard
          testId="network-card"
          href={href}
          title={n.label}
          logo={<PlatformLogo network={n.network} />}
          highlight={isRich && price !== null ? p('fromPrice', { price }) : undefined}
          detail={t('servicesCount', { count: countServices(n) })}
        />
      </li>
    );
  };

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
      <h1 className="text-[28px] leading-tight font-bold text-[var(--lp-gray-12)] md:text-[40px]">
        {t('title')}
      </h1>
      <p className="mt-2 mb-8 text-[var(--lp-gray-11)]">{t('intro')}</p>
      {catalog.networks.length === 0 ? (
        <EmptyState title={t('emptyTitle')} description={t('emptyText')} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rich.map((n) => card(n, true))}
          </ul>
          {others.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-xl font-semibold text-[var(--lp-gray-12)]">
                {p('otherNetworks')}
              </h2>
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((n) => card(n, false))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
