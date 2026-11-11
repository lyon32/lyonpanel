import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FavoriteToggle } from '@/components/order/favorite-toggle';
import { WalletBalance } from '@/components/order/order-parts';
import { OrderForm, type OrderService } from '@/components/order/order-form';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { formatCatalogMoney } from '@/lib/money';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/server/auth/require-user';
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

// Seul un booléen sort d'ici : le type technique du service ne va jamais au navigateur.
async function needsComments(id: number): Promise<boolean> {
  const { data } = await createAdminClient()
    .from('services')
    .select('provider_type')
    .eq('id', id)
    .maybeSingle();
  return data?.provider_type === 'Custom Comments';
}

async function loadService(raw: string | undefined): Promise<OrderService | null> {
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) return null;
  const [row, comments] = await Promise.all([getPublicService(id), needsComments(id)]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name_fr,
    platform: row.platform,
    priceXaf1000: row.price_xaf_1000,
    minQty: row.min_qty,
    maxQty: row.max_qty,
    needsComments: comments,
  };
}

// Quantité d'adresse acceptée seulement si c'est un entier dans les bornes du service.
function initialQuantity(raw: string | undefined, service: OrderService): number | undefined {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n)) return undefined;
  return n >= service.minQty && n <= service.maxQty ? n : undefined;
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { service: serviceParam, quantity: quantityParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'order' });
  const user = await requireUser(locale === 'en' ? 'en' : 'fr');
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  const supabase = await createSessionClient();
  const [service, wallet, usdXafRate] = await Promise.all([
    loadService(serviceParam),
    supabase.from('wallets').select('balance_xaf').eq('user_id', user.id).maybeSingle(),
    currency === 'USD' ? getUsdXafRateCached() : Promise.resolve(1),
  ]);
  const balanceXaf = wallet.data?.balance_xaf ?? 0;
  // État de départ du bouton Favori : lu côté serveur, pas de chargement dans le navigateur.
  const isFavorite = service
    ? (await listFavorites(user.id, locale === 'en' ? 'en' : 'fr')).some((f) => f.id === service.id)
    : false;
  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-encre text-2xl font-bold">{t('title')}</h1>
        {service ? <FavoriteToggle serviceId={service.id} initialFavorite={isFavorite} /> : null}
      </div>
      {service ? (
        <OrderForm
          service={service}
          currency={currency}
          usdXafRate={usdXafRate}
          balanceXaf={balanceXaf}
          initialQuantity={initialQuantity(quantityParam, service)}
        />
      ) : (
        <>
          <WalletBalance amount={formatCatalogMoney(balanceXaf, currency, locale, usdXafRate)} />
          <div className="border-gris-200 bg-blanc flex max-w-md flex-col gap-3 rounded-xl border p-4 sm:p-6">
            <h2 className="text-encre text-lg font-semibold">
              {serviceParam ? t('unknownService') : t('noService')}
            </h2>
            <p className="text-gris-600 text-sm">{t('noServiceHelp')}</p>
            <Link
              href="/services"
              className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-semibold outline-none focus-visible:ring-4"
            >
              {t('browseServices')}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
