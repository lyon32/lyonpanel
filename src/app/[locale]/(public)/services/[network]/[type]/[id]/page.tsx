import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/catalog/breadcrumb';
import { ServiceFacts } from '@/components/catalog/service-facts';
import { JsonLd } from '@/components/seo/json-ld';
import { asLang, breadcrumbLd, catalogMetadata, fitTitle } from '@/lib/seo/catalog-seo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatCatalogMoney } from '@/lib/money';
import { networkLabel, typeLabel } from '@/server/catalog/labels';
import { loadServiceView } from '@/server/catalog/load-catalog';
import {
  asCatalogLocale,
  parseNetwork,
  parseServiceId,
  parseType,
} from '@/server/catalog/page-params';

type Props = { params: Promise<{ locale: string; network: string; type: string; id: string }> };

// Le réseau et le type de l'adresse doivent être ceux du service, sinon 404.
async function loadMatching({ locale, network, type, id }: Awaited<Props['params']>) {
  const view = await loadServiceView(parseServiceId(id), asCatalogLocale(locale));
  const ok =
    view && view.service.network === parseNetwork(network) && view.service.type === parseType(type);
  return ok ? view : notFound();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const t = await getTranslations({ locale: p.locale, namespace: 'catalog' });
  const { service, currency, usdXafRate } = await loadMatching(p);
  const price = formatCatalogMoney(service.priceXaf1000, currency, p.locale, usdXafRate);
  // Fiche : lisible mais hors résultats Google (2 000 fiches proches = contenu mince).
  return catalogMetadata({
    lang: asLang(p.locale),
    path: `/services/${service.network}/${service.type}/${service.id}`,
    title: fitTitle(service.name),
    description: t('detailMeta', { name: service.name, price }),
    noindex: true,
  });
}

export default async function ServicePage({ params }: Props) {
  const p = await params;
  setRequestLocale(p.locale);
  const t = await getTranslations('catalog');
  const locale = await getLocale();
  const { service, currency, usdXafRate } = await loadMatching(p);
  const l = asCatalogLocale(p.locale);
  const networkId = service.network;
  const typeId = service.type;

  const crumbs = [
    { name: t('allServices'), path: '/services' },
    { name: networkLabel(networkId, l), path: `/services/${networkId}` },
    { name: typeLabel(typeId, l), path: `/services/${networkId}/${typeId}` },
    { name: `#${service.id}`, path: `/services/${networkId}/${typeId}/${service.id}` },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <JsonLd data={breadcrumbLd(asLang(p.locale), crumbs)} />
      <Breadcrumb
        items={[
          { label: t('allServices'), href: '/services' },
          {
            label: networkLabel(networkId, l),
            href: { pathname: '/services/[network]', params: { network: networkId } },
          },
          {
            label: typeLabel(typeId, l),
            href: {
              pathname: '/services/[network]/[type]',
              params: { network: networkId, type: typeId },
            },
          },
          { label: `#${service.id}` },
        ]}
      />
      <h1 className="text-encre text-[28px] leading-tight font-bold break-words md:text-[40px]">
        {service.name}
      </h1>
      <Card className="mt-6 flex flex-col gap-5 p-5">
        <ServiceFacts service={service} currency={currency} usdXafRate={usdXafRate} />
        <p className="text-gris-600 text-sm">
          {t('example', {
            price: formatCatalogMoney(service.priceXaf1000, currency, locale, usdXafRate),
          })}
        </p>
        {currency === 'USD' ? <p className="text-gris-600 text-sm">{t('indicative')}</p> : null}
        <div>
          {/* Le formulaire de commande arrive en phase 6 : bouton éteint en attendant. */}
          <Button disabled aria-describedby="order-soon">
            {t('order')}
          </Button>
          <p id="order-soon" className="text-gris-600 mt-2 text-sm">
            {t('orderSoon')}
          </p>
        </div>
      </Card>
    </div>
  );
}
