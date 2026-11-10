import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/catalog/breadcrumb';
import { JsonLd } from '@/components/seo/json-ld';
import {
  asLang,
  breadcrumbLd,
  catalogMetadata,
  fitTitle,
  itemListLd,
  pickDescription,
} from '@/lib/seo/catalog-seo';
import { Pagination } from '@/components/catalog/pagination';
import { ServiceTitle } from '@/components/catalog/service-title';
import { ServiceFacts } from '@/components/catalog/service-facts';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link, redirect } from '@/i18n/navigation';
import { networkLabel, typeLabel } from '@/server/catalog/labels';
import { loadCatalogView } from '@/server/catalog/load-catalog';
import { asCatalogLocale, parseNetwork, parseType } from '@/server/catalog/page-params';
import { resolvePage } from '@/server/catalog/resolve-page';
import { searchServices } from '@/server/catalog/search';

type Props = {
  params: Promise<{ locale: string; network: string; type: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
};

const PAGE_SIZE = 24;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, network, type } = await params;
  const { q } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const l = asCatalogLocale(locale);
  const values = {
    network: networkLabel(parseNetwork(network), l),
    type: typeLabel(parseType(type), l),
  };
  // Canonical sans paramètre ; une recherche (?q=) n'est jamais indexée.
  return catalogMetadata({
    lang: asLang(locale),
    path: `/services/${parseNetwork(network)}/${parseType(type)}`,
    title: fitTitle(t('typeMetaTitle', values), ''),
    description: pickDescription([
      t('typeMetaDescription', values),
      t('typeMetaDescriptionLong', values),
      t('typeMetaDescriptionLonger', values),
      t('typeMetaDescriptionLongest', values),
    ]),
    noindex: Boolean(q?.trim()),
  });
}

export default async function TypePage({ params, searchParams }: Props) {
  const { locale, network: rawNetwork, type: rawType } = await params;
  setRequestLocale(locale);
  const network = parseNetwork(rawNetwork);
  const type = parseType(rawType);
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().slice(0, 60);
  const t = await getTranslations('catalog');

  const { catalog, currency, usdXafRate } = await loadCatalogView(asCatalogLocale(locale));
  const networkEntry = catalog.networks.find((n) => n.network === network);
  const typeEntry = networkEntry?.types.find((ty) => ty.type === type);
  if (!networkEntry || !typeEntry) notFound();

  // Recherche et découpage en pages faits ici, côté serveur.
  const matches = searchServices(typeEntry.services, q);
  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const { page, canonical } = resolvePage(sp.page, totalPages);
  // Adresse en double (page=0, abc, page 1, trop grande) : 307 vers l'adresse canonique.
  if (!canonical && sp.page !== undefined) {
    redirect({
      href: {
        pathname: '/services/[network]/[type]',
        params: { network, type },
        // Seulement les paramètres utiles : une valeur undefined s'écrirait « undefined » dans l'adresse.
        query: { ...(page > 1 && { page }), ...(q && { q }) },
      },
      locale,
    });
  }
  const visible = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const lang = asLang(locale);
  const crumbs = [
    { name: t('allServices'), path: '/services' },
    { name: networkEntry.label, path: `/services/${network}` },
    { name: typeEntry.label, path: `/services/${network}/${type}` },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <JsonLd data={breadcrumbLd(lang, crumbs)} />
      <JsonLd
        data={itemListLd(
          lang,
          visible.map((s) => ({ name: s.name, path: `/services/${network}/${type}/${s.id}` })),
        )}
      />
      <Breadcrumb
        items={[
          { label: t('allServices'), href: '/services' },
          {
            label: networkEntry.label,
            href: { pathname: '/services/[network]', params: { network } },
          },
          { label: typeEntry.label },
        ]}
      />
      <h1 className="text-encre text-[28px] leading-tight font-bold md:text-[40px]">
        {t('typeTitle', { type: typeEntry.label, network: networkEntry.label })}
      </h1>
      <p className="text-gris-600 mt-2">{t('servicesCount', { count: matches.length })}</p>
      {currency === 'USD' ? <p className="text-gris-600 mt-1 text-sm">{t('indicative')}</p> : null}

      <form method="get" role="search" className="mt-5 mb-6 flex max-w-lg gap-2">
        <label htmlFor="catalog-q" className="sr-only">
          {t('searchLabel')}
        </label>
        <Input
          id="catalog-q"
          name="q"
          type="search"
          enterKeyHint="search"
          defaultValue={q}
          placeholder={t('searchPlaceholder')}
          maxLength={60}
        />
        <Button type="submit" variant="secondary">
          {t('searchButton')}
        </Button>
      </form>

      {visible.length === 0 ? (
        <EmptyState title={t('noResultsTitle')} description={t('noResultsText')} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((s) => (
            <li key={s.id}>
              <Card
                data-testid="service-row"
                className="focus-within:ring-bleu-100 hover:border-bleu-600 relative flex h-full flex-col gap-3 p-4 transition-colors duration-150 focus-within:ring-4"
              >
                {/* Lien étendu : after:inset-0 rend toute la carte cliquable sans imbriquer de liens. */}
                <Link
                  href={{
                    pathname: '/services/[network]/[type]/[id]',
                    params: { network, type, id: s.id },
                  }}
                  className="hover:text-bleu-600 block min-h-11 rounded-lg outline-none after:absolute after:inset-0 after:rounded-xl"
                >
                  <ServiceTitle name={s.name} />
                </Link>
                <ServiceFacts service={s} currency={currency} usdXafRate={usdXafRate} />
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        q={q}
        hrefFor={(query) => ({
          pathname: '/services/[network]/[type]',
          params: { network, type },
          query,
        })}
      />
    </div>
  );
}
