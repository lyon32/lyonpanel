import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CheckCircle2, ListOrdered, Wallet, Banknote } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StatCard } from '@/components/dashboard/stat-card';
import { SuggestionSlot } from '@/components/dashboard/suggestion-slot';
import { OrdersList } from '@/components/order/orders-list';
import { Greeting } from '@/components/shared/greeting';
import { Link } from '@/i18n/navigation';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { firstNameFromEmail } from '@/lib/first-name';
import { formatCatalogMoney } from '@/lib/money';
import { requireUser } from '@/server/auth/require-user';
import { getUsdXafRateCached } from '@/server/catalog/public-catalog';
import { listOrders } from '@/server/orders/list-orders';
import { suggestOrder } from '@/server/orders/suggest-order';
import { getWallet } from '@/server/wallet/wallet';

type Props = { params: Promise<{ locale: string }> };

// Les chiffres sont calculés sur les 100 dernières commandes ; au-delà, la carte l'indique.
const STATS_LIMIT = 100;
const RECENT = 5;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('dashboard'), robots: { index: false, follow: false } };
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'fr';
  const user = await requireUser(lang);
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  const nav = await getTranslations({ locale, namespace: 'nav' });
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  const [wallet, orders, suggestion, usdXafRate] = await Promise.all([
    getWallet(user.id),
    listOrders(user.id, { limit: STATS_LIMIT }, lang),
    suggestOrder(user.id, lang),
    currency === 'USD' ? getUsdXafRateCached() : Promise.resolve(1),
  ]);
  const money = (xaf: number) => formatCatalogMoney(xaf, currency, locale, usdXafRate);
  const count = new Intl.NumberFormat(locale);
  const more = orders.next_cursor !== null;
  const completed = orders.data.filter((o) => o.status === 'completed').length;
  const spentXaf = orders.data
    .filter((o) => o.status !== 'refunded')
    .reduce((sum, o) => sum + o.charged_xaf, 0);
  const total = orders.data.length;
  const scope = more ? t('stats.lastOrders', { count: STATS_LIMIT }) : undefined;
  const suffix = more ? '+' : '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Greeting name={firstNameFromEmail(user.email)} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/order"
            data-testid="new-order-button"
            className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-5 font-semibold whitespace-nowrap outline-none focus-visible:ring-4 sm:w-auto"
          >
            {nav('newOrder')}
          </Link>
          <Link
            href="/add-funds"
            className="border-gris-200 text-encre hover:bg-gris-50 focus-visible:ring-bleu-100 inline-flex min-h-11 w-full items-center justify-center rounded-lg border px-5 font-semibold whitespace-nowrap outline-none focus-visible:ring-4 sm:w-auto"
          >
            {nav('addFunds')}
          </Link>
        </div>
      </div>

      {suggestion ? (
        <SuggestionSlot service={suggestion.service} quantity={suggestion.quantity} />
      ) : null}

      <section aria-label={t('stats.label')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label={t('stats.balance')}
          value={money(wallet.balance_xaf)}
          hint={
            wallet.discount_pct > 0 ? t('stats.discount', { pct: wallet.discount_pct }) : undefined
          }
        />
        <StatCard
          icon={ListOrdered}
          label={t('stats.orders')}
          value={`${count.format(total)}${suffix}`}
          hint={scope}
        />
        <StatCard icon={Banknote} label={t('stats.spent')} value={money(spentXaf)} hint={scope} />
        <StatCard
          icon={CheckCircle2}
          label={t('stats.completed')}
          value={`${count.format(completed)}${suffix}`}
          hint={
            total > 0
              ? [t('stats.completedRate', { pct: Math.round((completed / total) * 100) }), scope]
                  .filter(Boolean)
                  .join(' · ')
              : scope
          }
        />
      </section>

      <section aria-labelledby="recent-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-title" className="text-encre text-lg font-bold md:text-xl">
            {t('recent')}
          </h2>
          {total > 0 ? (
            <Link
              href="/orders"
              className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-4"
            >
              {t('seeAll')}
            </Link>
          ) : null}
        </div>
        <OrdersList
          orders={orders.data.slice(0, RECENT).map((o) => ({
            id: o.id,
            shortId: o.short_id,
            serviceName: o.service.name,
            quantity: o.quantity,
            chargedXaf: o.charged_xaf,
            status: o.status,
            remains: o.remains,
          }))}
        />
      </section>
    </div>
  );
}
