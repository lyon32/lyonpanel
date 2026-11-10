'use client';

import { useLocale, useTranslations } from 'next-intl';
import { OrderProgressBar } from './order-progress-bar';
import { OrderStatusBadge, type OrderStatusValue } from './order-status-badge';
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
      <div className="border-gris-200 bg-gris-50 flex flex-col items-start gap-3 rounded-lg border p-6">
        <p className="text-encre font-medium">{t('empty')}</p>
        <p className="text-gris-600 text-sm tabular-nums">{t('emptyHint')}</p>
        <Link
          href="/order"
          className="bg-bleu-600 hover:bg-bleu-700 focus-visible:outline-bleu-600 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t('emptyCta')}
        </Link>
      </div>
    );
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <li
          key={o.id}
          className="border-gris-200 bg-blanc flex flex-col gap-3 rounded-lg border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-encre min-w-0 font-medium break-words">{o.serviceName}</span>
            <OrderStatusBadge status={o.status} />
          </div>
          <p className="text-gris-600 text-sm tabular-nums">
            #{o.shortId} · {t('quantity', { count: nf.format(o.quantity) })} ·{' '}
            {nf.format(o.chargedXaf)} XAF
          </p>
          {o.status === 'in_progress' && o.remains !== null ? (
            <OrderProgressBar quantity={o.quantity} remains={o.remains} />
          ) : null}
          {REVIEW.has(o.status) ? <p className="text-gris-600 text-sm">{t('reviewHint')}</p> : null}
        </li>
      ))}
    </ul>
  );
}
