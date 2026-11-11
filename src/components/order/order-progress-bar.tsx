import { useTranslations } from 'next-intl';

/** Avancement = (quantité − reste) / quantité, borné entre 0 et 100 (valeurs fournisseur parfois incohérentes). */
export function OrderProgressBar({ quantity, remains }: { quantity: number; remains: number }) {
  const t = useTranslations('orderTracking');
  const raw = quantity > 0 ? ((quantity - remains) / quantity) * 100 : 0;
  const percent = Math.min(100, Math.max(0, Math.round(raw)));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={t('progressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="bg-gris-200 h-2 min-w-0 flex-1 overflow-hidden rounded-full"
      >
        <div className="bg-bleu-600 h-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-gris-600 w-10 shrink-0 text-right text-xs font-medium tabular-nums">
        {percent} %
      </span>
    </div>
  );
}
