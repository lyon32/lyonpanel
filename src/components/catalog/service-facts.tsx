import { Check, X } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Currency } from '@/lib/currency';
import { formatCatalogMoney } from '@/lib/money';

// Champs publics du service, déjà calculés par le serveur.
interface FactsService {
  priceXaf1000: number;
  minQty: number;
  maxQty: number;
  minOrderXaf: number;
  refill: boolean;
  cancel: boolean;
}

interface FactsProps {
  service: FactsService;
  currency: Currency;
  usdXafRate: number;
}

// Prix, quantités et options : le même bloc sert à la liste et à la fiche.
// Le prix pour 1 000 et la commande minimum sont côte à côte, en gros ; le reste est secondaire.
export async function ServiceFacts({ service, currency, usdXafRate }: FactsProps) {
  const t = await getTranslations('catalog');
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale);
  const money = (xaf: number) => formatCatalogMoney(xaf, currency, locale, usdXafRate);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="bg-bleu-50 grid grid-cols-2 gap-3 rounded-lg p-3">
        <p className="flex flex-col gap-0.5">
          <span className="text-gris-600">{t('per1000')}</span>
          <strong data-testid="service-price" className="text-encre text-lg font-bold tabular-nums">
            {money(service.priceXaf1000)}
          </strong>
        </p>
        <p data-testid="service-min-order" className="flex flex-col gap-0.5">
          <span className="text-gris-600">{t('minOrderLabel')}</span>
          <strong className="text-encre text-lg font-bold tabular-nums">
            {money(service.minOrderXaf)}
          </strong>
        </p>
      </div>
      <p className="text-gris-600 tabular-nums">
        {t('quantity', { min: nf.format(service.minQty), max: nf.format(service.maxQty) })}
      </p>
      <ul className="text-encre flex flex-wrap gap-x-4 gap-y-1">
        <Flag on={service.refill} label={t(service.refill ? 'refill' : 'noRefill')} />
        <Flag on={service.cancel} label={t(service.cancel ? 'cancel' : 'noCancel')} />
      </ul>
    </div>
  );
}

// L'icône ne porte pas seule le sens : le texte dit « possible » ou « sans ».
function Flag({ on, label }: { on: boolean; label: string }) {
  const Icon = on ? Check : X;
  return (
    <li className={on ? 'flex items-center gap-1.5' : 'text-gris-600 flex items-center gap-1.5'}>
      <Icon size={16} aria-hidden="true" className={on ? 'text-succes' : 'text-gris-400'} />
      {label}
    </li>
  );
}
