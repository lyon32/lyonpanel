import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Heart } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FavoriteRow } from '@/components/order/favorite-row';
import { EmptyState } from '@/components/shared/empty-state';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { formatCatalogMoney } from '@/lib/money';
import { requireUser } from '@/server/auth/require-user';
import { getUsdXafRateCached } from '@/server/catalog/public-catalog';
import { listFavorites } from '@/server/favorites/favorites';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('favorites'), robots: { index: false, follow: false } };
}

export default async function FavoritesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'fr';
  const user = await requireUser(lang);
  const t = await getTranslations({ locale, namespace: 'favorites' });
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  const [favorites, usdXafRate] = await Promise.all([
    listFavorites(user.id, lang),
    currency === 'USD' ? getUsdXafRateCached() : Promise.resolve(1),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-encre text-2xl font-bold md:text-3xl">{t('title')}</h1>
      {favorites.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Link
              href="/services"
              className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-4 font-semibold outline-none focus-visible:ring-4"
            >
              {t('emptyCta')}
            </Link>
          }
        />
      ) : (
        <Card>
          <ul className="divide-gris-200 divide-y">
            {favorites.map((s) => (
              <FavoriteRow
                key={s.id}
                id={s.id}
                name={s.name}
                priceLabel={formatCatalogMoney(s.priceXaf1000, currency, locale, usdXafRate)}
              />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
