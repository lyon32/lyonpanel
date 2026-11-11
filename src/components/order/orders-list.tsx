'use client';

import { useLocale, useTranslations } from 'next-intl';
import { OrderProgressBar } from './order-progress-bar';
import { OrderStatusBadge, type OrderStatusValue } from './order-status-badge';
import { ServiceName } from '@/components/shared/service-name';
import { Link } from '@/i18n/navigation';
import { useOrderPolling } from '@/hooks/use-order-polling';

export type OrderListItem = {
  id: string;
  shortId: number;
  serviceName: string;
  quantity: number;
  chargedXaf: number;
  status: OrderStatusValue;
  remains: number | null;
};

// Statuts qui ne bougeront plus côté client (le reste est repris par le suivi serveur).
const FINAL = new Set<OrderStatusValue>([
  'completed',
  'partial',
  'canceled',
  'to_review',
  'refunded',
]);

const REVIEW = new Set<OrderStatusValue>(['partial', 'canceled', 'to_review']);

export function OrdersList({ orders }: { orders: OrderListItem[] }) {
  const t = useTranslations('orderTracking');
  const locale = useLocale();
  useOrderPolling(orders.every((o) => FINAL.has(o.status)));
  const nf = new Intl.NumberFormat(locale);

  if (orders.length === 0)
    return (
      <div className="border-gris-200 bg-blanc flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-encre font-medium">{t('empty')}</p>
        <p className="text-gris-600 text-sm">{t('emptyHint')}</p>
        <Link
          href="/order"
          className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold outline-none focus-visible:ring-4"
        >
          {t('emptyCta')}
        </Link>
      </div>
    );
  return (
    <ul className="border-gris-200 bg-blanc divide-gris-200 flex flex-col divide-y overflow-hidden rounded-xl border">
      {orders.map((o) => (
        <li
          key={o.id}
          className="flex flex-col gap-3 p-4 xl:grid xl:grid-cols-[minmax(0,1fr)_7rem_11rem_14rem] xl:items-center xl:gap-4"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <ServiceName name={o.serviceName} className="text-encre font-medium" />
            <span className="text-gris-600 text-sm tabular-nums">
              #{o.shortId} · {t('quantity', { count: nf.format(o.quantity) })}
            </span>
          </div>
          <span className="text-encre text-sm font-semibold tabular-nums xl:text-right">
            {nf.format(o.chargedXaf)} XAF
          </span>
          <div className="xl:justify-self-start">
            <OrderStatusBadge status={o.status} />
          </div>
          <div className="flex flex-col gap-2">
            {o.status === 'in_progress' && o.remains !== null ? (
              <OrderProgressBar quantity={o.quantity} remains={o.remains} />
            ) : null}
            {REVIEW.has(o.status) ? (
              <p className="text-gris-600 text-sm">{t('reviewHint')}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
