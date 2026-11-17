import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrderWorkbench } from '@/components/order/order-workbench';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { requireUser } from '@/server/auth/require-user';
import { loadCatalogView } from '@/server/catalog/load-catalog';
import { asCatalogLocale } from '@/server/catalog/page-params';
import { toPublicService } from '@/server/catalog/present-catalog';
import { toWorkbench } from '@/server/catalog/workbench';
import { getPublicService, getUsdXafRateCached } from '@/server/catalog/public-catalog';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';
import { listFavorites } from '@/server/favorites/favorites';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ service?: string; quantity?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('order'), robots: { index: false, follow: false } };
}

// Seuls des numéros sortent d'ici : le type technique du service ne va jamais au navigateur.
async function commentServiceIds(): Promise<Set<number>> {
  const { data } = await createAdminClient()
    .from('services')
    .select('id')
    .eq('provider_type', 'Custom Comments');
  return new Set((data ?? []).map((r) => r.id));
}

function positiveInt(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'order' });
  const lang = locale === 'en' ? 'en' : 'fr';
  const user = await requireUser(lang);
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  const supabase = await createSessionClient();
  const [view, comments, wallet, favorites, usdXafRate] = await Promise.all([
    loadCatalogView(asCatalogLocale(locale)),
    commentServiceIds(),
    supabase.from('wallets').select('balance_xaf').eq('user_id', user.id).maybeSingle(),
    listFavorites(user.id, lang),
    currency === 'USD' ? getUsdXafRateCached() : Promise.resolve(1),
  ]);
  const networks = toWorkbench(view.catalog, comments);
  const wanted = positiveInt(sp.service);
  let known = wanted !== undefined && networks.some((n) => n.services.some((s) => s.id === wanted));
  // Le catalogue est en cache 5 min : un service tout neuf est lu directement et ajouté.
  if (wanted !== undefined && !known) {
    const row = await getPublicService(wanted);
    if (row) {
      const shown = toPublicService(row, {
        currency: 'XAF',
        locale: asCatalogLocale(locale),
        usdXafRate: 1,
      });
      const extra = {
        id: row.id,
        name: shown.name,
        description: shown.description,
        type: row.category,
        priceXaf1000: row.price_xaf_1000,
        minQty: row.min_qty,
        maxQty: row.max_qty,
        needsComments: comments.has(row.id),
      };
      const home = networks.find((n) => n.network === row.platform);
      if (home) home.services.push(extra);
      else {
        networks.push({
          network: row.platform,
          label: row.platform,
          types: [],
          services: [extra],
        });
      }
      known = true;
    }
  }
  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <h1 className="text-encre text-2xl font-bold">{t('title')}</h1>
      {sp.service && !known ? (
        <p role="status" className="text-gris-600 text-sm">
          {t('unknownService')}
        </p>
      ) : null}
      <OrderWorkbench
        networks={networks}
        currency={currency}
        usdXafRate={usdXafRate}
        balanceXaf={wallet.data?.balance_xaf ?? 0}
        favoriteIds={favorites.map((f) => f.id)}
        initialServiceId={known ? wanted : undefined}
        initialQuantity={positiveInt(sp.quantity)}
      />
    </section>
  );
}
