import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { OrdersList } from '@/components/order/orders-list';
import { requireUser } from '@/server/auth/require-user';
import { listOrders } from '@/server/orders/list-orders';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('orders'), robots: { index: false, follow: false } };
}

export default async function OrdersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'fr';
  const user = await requireUser(lang);
  const t = await getTranslations({ locale, namespace: 'pages' });
  const { data } = await listOrders(user.id, { limit: 50 }, lang);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-encre text-2xl font-bold">{t('orders')}</h1>
      <OrdersList
        orders={data.map((o) => ({
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
  );
}
