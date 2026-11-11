import { useLocale, useTranslations } from 'next-intl';
import type { OrderService } from './order-form';
import { ServiceName } from '@/components/shared/service-name';

// Fiche du service à droite (sous le formulaire sur téléphone). Que des faits connus, rien d'inventé.
export function ServiceCard({
  service,
  money,
}: {
  service: OrderService;
  money: (xaf: number) => string;
}) {
  const t = useTranslations('order');
  const locale = useLocale();
  const quantities = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return (
    <aside
      aria-labelledby="order-service-card"
      className="border-gris-200 bg-blanc flex flex-col gap-4 rounded-xl border p-4 sm:p-6"
    >
      <h2 id="order-service-card" className="text-encre text-lg font-semibold">
        {t('cardTitle')}
      </h2>
      <p className="text-encre text-base">
        <ServiceName name={service.name} />
      </p>
      <dl className="flex flex-col gap-2 text-sm tabular-nums">
        <div className="flex justify-between gap-3">
          <dt className="text-gris-600">{t('pricePer1000')}</dt>
          <dd className="text-encre font-semibold">{money(service.priceXaf1000)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gris-600">{t('minimum')}</dt>
          <dd className="text-encre font-semibold">{quantities.format(service.minQty)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gris-600">{t('maximum')}</dt>
          <dd className="text-encre font-semibold">{quantities.format(service.maxQty)}</dd>
        </div>
      </dl>
      <div className="border-gris-200 border-t pt-4">
        <h3 className="text-encre text-sm font-semibold">{t('howTitle')}</h3>
        <ol className="text-gris-600 mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>{t('how1')}</li>
          <li>{t('how2')}</li>
          <li>{t('how3')}</li>
        </ol>
      </div>
    </aside>
  );
}
