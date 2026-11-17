import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CopyButton } from '@/components/admin/copy-button';
import { OrderActions } from '@/components/admin/order-actions';
import { Badge } from '@/components/ui/badge';
import {
  formatDateTime,
  formatInt,
  formatUsd,
  formatXaf,
  orderBadgeStatus,
  orderStatusLabel,
  ORDER_STATUSES,
} from '@/lib/admin-format';
import { getAdminOrder } from '@/server/admin/orders';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { ApiError } from '@/server/http/api-error';

type Props = { params: Promise<{ adminPath: string; id: string }> };

async function load(id: string) {
  try {
    return (await getAdminOrder(id)).order;
  } catch (error) {
    // Commande inconnue ou identifiant mal formé : 404, comme le reste de l'admin.
    if (error instanceof ApiError) notFound();
    throw error;
  }
}

export default async function AdminOrderPage({ params }: Props) {
  await requireAdminPage();
  const { adminPath, id } = await params;
  const { t, locale } = await getAdminTranslator();
  const o = await load(id);
  const money = (n: number) => formatXaf(n, locale);
  const statusLabels = Object.fromEntries(
    ORDER_STATUSES.map((s) => [s, t(`user.orderStatuses.${s}`)]),
  );
  const customer = o.user_email ?? o.user_phone ?? '-';
  const maxRefundXaf = Math.max(0, o.charged_xaf - o.refunded_xaf);

  const rows: [string, string][] = [
    [t('orders.customer'), customer],
    [t('orders.service'), o.service_name ?? `#${o.service_id}`],
    [t('orders.quantity'), formatInt(o.quantity, locale)],
    [t('orders.remains'), o.remains === null ? '-' : formatInt(o.remains, locale)],
    [t('orders.startCount'), o.start_count === null ? '-' : formatInt(o.start_count, locale)],
    [t('orders.charged'), money(o.charged_xaf)],
    [t('orders.refunded'), money(o.refunded_xaf)],
    [t('orders.refundable'), money(o.refundable_xaf)],
    [t('orders.cost'), o.cost_usd === null ? '-' : formatUsd(o.cost_usd, locale)],
    [t('orders.profit'), o.profit_xaf === null ? '-' : money(o.profit_xaf)],
    [t('orders.created'), formatDateTime(o.created_at, locale)],
  ];
  const panel = 'border-gris-200 bg-blanc flex flex-col gap-3 rounded-xl border p-4 sm:p-5';

  return (
    <>
      <Link
        href={`/${adminPath}/orders`}
        className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg font-semibold outline-none focus-visible:ring-4"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('orders.back')}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-encre text-2xl font-bold tabular-nums">#{o.short_id}</h1>
        <Badge status={orderBadgeStatus(o.status)}>
          {orderStatusLabel(o.status, statusLabels)}
        </Badge>
      </div>

      <section aria-labelledby="order-info" className={panel}>
        <h2 id="order-info" className="sr-only">
          {t('orders.title')}
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-gris-600 text-sm">{label}</dt>
              <dd className="text-encre font-semibold break-words tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="min-w-0">
          <p className="text-gris-600 text-sm">{t('orders.link')}</p>
          <p className="text-encre font-semibold break-all">{o.link}</p>
        </div>
        {o.error ? (
          <div className="min-w-0">
            <p className="text-gris-600 text-sm">{t('orders.error')}</p>
            <p className="text-erreur text-sm break-words">{o.error}</p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="order-provider" className={panel}>
        <h2 id="order-provider" className="text-encre text-lg font-bold">
          {t('orders.providerId')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-encre text-xl font-bold tabular-nums">
            {o.provider_order_id ?? t('orders.providerIdNone')}
          </span>
          {o.provider_order_id === null ? null : <CopyButton value={String(o.provider_order_id)} />}
        </div>
        <p className="text-gris-600 text-sm">{t('orders.providerIdHint')}</p>
      </section>

      <section aria-labelledby="order-actions" className="flex flex-col gap-3">
        <h2 id="order-actions" className="text-encre text-lg font-bold">
          {t('orders.actions')}
        </h2>
        <OrderActions
          orderId={o.id}
          status={o.status}
          customer={customer}
          locale={locale}
          maxRefundXaf={maxRefundXaf}
          suggestedRefundXaf={o.remains === null ? null : o.refundable_xaf}
          resent={o.resent}
        />
      </section>
    </>
  );
}
