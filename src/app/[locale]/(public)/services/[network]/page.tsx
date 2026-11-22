import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Breadcrumb } from '@/components/catalog/breadcrumb';
import { CatalogError } from '@/components/platform/catalog-error';
import { safeLoad } from '@/components/platform/safe-load';
import { NetworkCard, PlatformLogo } from '@/components/platform/network-card';
import { countServices, fromPriceXaf, isRichNetwork } from '@/components/platform/network-summary';
import { buildServiceJsonLd } from '@/lib/seo/service-jsonld';
import { buildFaqJsonLd, serializeJsonLd, type FaqItem } from '@/components/faq/faq-jsonld';
import { Link } from '@/i18n/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { asLang, catalogMetadata, fitTitle, gateIndexing } from '@/lib/seo/catalog-seo';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { seoHomeCrumb } from '@/lib/seo/public-meta';
import { buildBreadcrumbJsonLd } from '@/lib/seo/site-jsonld';
import { networkLabel } from '@/server/catalog/labels';
import { loadCatalogView } from '@/server/catalog/load-catalog';
import { asCatalogLocale, parseNetwork } from '@/server/catalog/page-params';

type Props = { params: Promise<{ locale: string; network: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, network } = await params;
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const name = networkLabel(parseNetwork(network), asCatalogLocale(locale));
  const seo = await getTranslations({ locale, namespace: 'seo' });
  const key = `networks.${parseNetwork(network)}`;
  // Réseaux riches : textes SEO rédigés ; sinon repli sur le modèle générique du catalogue.
  if (seo.has(`${key}.title`)) {
    return buildPageMetadata({
      lang: asLang(locale),
      path: `/services/${parseNetwork(network)}`,
      title: seo(`${key}.title`),
      description: seo(`${key}.description`),
    });
  }
  return gateIndexing(
    catalogMetadata({
      lang: asLang(locale),
      path: `/services/${parseNetwork(network)}`,
      title: fitTitle(t('networkMetaTitle', { network: name }), ''),
      description: t('networkMetaDescription', { network: name }),
    }),
  );
}

export default async function NetworkPage({ params }: Props) {
  const { locale, network: raw } = await params;
  setRequestLocale(locale);
  const network = parseNetwork(raw);
  const t = await getTranslations('catalog');
  const loaded = await safeLoad(() => loadCatalogView(asCatalogLocale(locale)));
  if (!loaded.ok) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <CatalogError />
      </div>
    );
  }
  const { catalog } = loaded.value;
  const entry = catalog.networks.find((n) => n.network === network);
  // Réseau inconnu ou au contenu trop mince : pas de page propre.
  if (!entry || !isRichNetwork(network, countServices(entry))) notFound();
  const p = await getTranslations('platform');
  const fromPrice = fromPriceXaf(entry.types.flatMap((ty) => ty.services));
  const faq = Array.from({ length: 5 }, (_, i): FaqItem | null =>
    p.has(`faq.${network}.q${i + 1}.question`)
      ? {
          question: p(`faq.${network}.q${i + 1}.question`),
          answer: p(`faq.${network}.q${i + 1}.answer`),
        }
      : null,
  ).filter((x): x is FaqItem => x !== null);

  const lang = asLang(locale);
  const crumbs = [
    await seoHomeCrumb(locale),
    { name: t('allServices'), url: `/${lang}/services` },
    { name: entry.label, url: `/${lang}/services/${network}` },
  ];
  const intro = t.has(`networkIntros.${network}`)
    ? t(`networkIntros.${network}`)
    : t('networkIntro');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <JsonLd data={buildBreadcrumbJsonLd(crumbs)} />
      {fromPrice !== null ? (
        <JsonLd
          data={buildServiceJsonLd({
            lang,
            network,
            name: t('networkTitle', { network: entry.label }),
            description: p('metaDescription', { network: entry.label }),
            fromPriceXaf: fromPrice,
          })}
        />
      ) : null}
      {faq.length > 0 ? (
        <script type="application/ld+json">{serializeJsonLd(buildFaqJsonLd(faq))}</script>
      ) : null}
      <Breadcrumb
        items={[{ label: t('allServices'), href: '/services' }, { label: entry.label }]}
      />
      <header className="flex items-start gap-4">
        <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)]">
          <PlatformLogo network={network} size={30} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-bold text-balance text-[var(--lp-gray-12)] md:text-[40px]">
            {t('networkTitle', { network: entry.label })}
          </h1>
          {fromPrice !== null ? (
            <p className="mt-1 font-semibold text-[var(--lp-accent-11)] tabular-nums">
              {p('fromPrice', { price: fromPrice })}
            </p>
          ) : null}
        </div>
      </header>
      <p className="mt-4 max-w-2xl leading-relaxed text-[var(--lp-gray-11)]">{intro}</p>
      <h2 className="mt-8 mb-4 text-xl font-semibold text-[var(--lp-gray-12)]">
        {p('typesTitle')}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entry.types.map((ty) => (
          <li key={ty.type}>
            <NetworkCard
              testId="type-card"
              href={{ pathname: '/services/[network]/[type]', params: { network, type: ty.type } }}
              title={ty.label}
              logo={<PlatformLogo network={network} />}
              detail={t('servicesCount', { count: ty.services.length })}
            />
          </li>
        ))}
      </ul>
      <Link
        href="/register"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--lp-accent-9)] px-7 font-medium text-white hover:bg-[var(--lp-accent-10)] active:bg-[var(--lp-app-accent-hover)] motion-safe:transition-colors motion-safe:duration-200"
      >
        {p('ctaRegister')}
      </Link>
      {faq.length > 0 ? (
        <section aria-labelledby="network-faq" className="mt-14 max-w-2xl">
          <h2 id="network-faq" className="text-xl font-semibold text-[var(--lp-gray-12)]">
            {p('faqTitle')}
          </h2>
          <div className="mt-4 space-y-3">
            {faq.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)] open:border-[var(--lp-gray-8)] motion-safe:transition-colors motion-safe:duration-200"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-3 text-base font-medium text-[var(--lp-gray-12)] marker:hidden hover:bg-[var(--lp-gray-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent-11)] active:bg-[var(--lp-gray-4)] [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    aria-hidden="true"
                    className="shrink-0 text-[var(--lp-accent-11)] group-open:rotate-45 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"
                  >
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                </summary>
                <p className="px-5 pb-5 text-base leading-relaxed text-[var(--lp-gray-11)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
