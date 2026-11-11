import { useTranslations } from 'next-intl';

export type OrderStatusValue =
  'pending' | 'in_progress' | 'completed' | 'partial' | 'canceled' | 'to_review' | 'refunded';

// Le client ne voit pas le détail : partiel, annulé et à vérifier = « en cours de vérification ».
const LABEL_KEY: Record<OrderStatusValue, string> = {
  pending: 'status_pending',
  in_progress: 'status_in_progress',
  completed: 'status_completed',
  partial: 'status_review',
  canceled: 'status_review',
  to_review: 'status_review',
  refunded: 'status_refunded',
};

// Texte encre sur fond jaune pâle : le jaune 700 seul n'atteint pas 4,5:1 en petit texte.
const STYLE: Record<OrderStatusValue, { pill: string; dot: string }> = {
  pending: { pill: 'bg-jaune-50 text-encre', dot: 'bg-jaune-500' },
  in_progress: { pill: 'bg-bleu-50 text-bleu-700', dot: 'bg-bleu-600' },
  completed: { pill: 'bg-succes-fond text-succes', dot: 'bg-succes' },
  partial: { pill: 'bg-jaune-50 text-encre', dot: 'bg-jaune-500' },
  canceled: { pill: 'bg-jaune-50 text-encre', dot: 'bg-jaune-500' },
  to_review: { pill: 'bg-jaune-50 text-encre', dot: 'bg-jaune-500' },
  refunded: { pill: 'bg-gris-50 text-encre', dot: 'bg-gris-600' },
};

export function OrderStatusBadge({ status }: { status: OrderStatusValue }) {
  const t = useTranslations('orderTracking');
  return (
    <span
      data-testid="order-status-badge"
      data-status={status}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLE[status].pill}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${STYLE[status].dot}`} />
      {t(LABEL_KEY[status])}
    </span>
  );
}
