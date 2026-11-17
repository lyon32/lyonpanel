'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { FavoriteToggle } from './favorite-toggle';
import { OrderForm } from './order-form';
import { WalletBalance } from './order-parts';
import { NetworkIcon } from '@/components/catalog/network-icon';
import { Input } from '@/components/ui/input';
import type { Currency } from '@/lib/currency';
import { formatCatalogMoney } from '@/lib/money';
import { filterServices, MAX_OPTIONS } from '@/lib/workbench-filter';

// Forme de toWorkbench() (src/server/catalog/workbench.ts) ; TypeScript la vérifie dans la page.
interface WService {
  id: number;
  name: string;
  description: string;
  type: string;
  priceXaf1000: number;
  minQty: number;
  maxQty: number;
  needsComments: boolean;
}
interface WNetwork {
  network: string;
  label: string;
  types: { type: string; label: string }[];
  services: WService[];
}

type Props = {
  networks: WNetwork[];
  currency: Currency;
  usdXafRate: number;
  balanceXaf: number;
  favoriteIds: number[];
  initialServiceId?: number;
  initialQuantity?: number;
};

const selectClass =
  'border-gris-200 bg-blanc text-encre focus-visible:ring-bleu-100 min-h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-4';

// Commande en une seule page : réseau -> recherche / catégorie -> service -> formulaire.
// Aucun changement de page : le choix se fait ici, dans l'espace client.
export function OrderWorkbench(props: Props) {
  const { networks, currency, usdXafRate, balanceXaf, favoriteIds } = props;
  const t = useTranslations('order');
  const locale = useLocale();
  const money = (xaf: number) => formatCatalogMoney(xaf, currency, locale, usdXafRate);

  const byId = useMemo(() => {
    const map = new Map<number, { service: WService; network: string }>();
    for (const n of networks) {
      for (const s of n.services) map.set(s.id, { service: s, network: n.network });
    }
    return map;
  }, [networks]);

  const start = props.initialServiceId ? byId.get(props.initialServiceId) : undefined;
  const [network, setNetwork] = useState<string>(start?.network ?? '');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [serviceId, setServiceId] = useState<number | null>(start?.service.id ?? null);

  const current = networks.find((n) => n.network === network);
  const pool = useMemo(
    () => (current ? current.services : networks.flatMap((n) => n.services)),
    [current, networks],
  );
  const matches = useMemo(() => filterServices(pool, type, q), [pool, type, q]);
  const shown = matches.slice(0, MAX_OPTIONS);
  const selected = serviceId === null ? undefined : byId.get(serviceId);
  // Le service choisi reste dans la liste même si la recherche change.
  const options =
    selected && !shown.some((s) => s.id === selected.service.id)
      ? [selected.service, ...shown]
      : shown;

  function pickNetwork(next: string) {
    setNetwork(next);
    setType('');
    setServiceId(null);
  }

  return (
    <div className="flex flex-col gap-4" data-testid="order-workbench">
      <section aria-labelledby="wb-networks" className="flex flex-col gap-3">
        <h2 id="wb-networks" className="text-encre text-lg font-semibold">
          {t('pickerNetworks')}
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {[{ network: '', label: t('pickerAll') }, ...networks].map((n) => (
            <li key={n.network || 'all'}>
              <button
                type="button"
                data-testid="picker-network"
                aria-pressed={network === n.network}
                onClick={() => pickNetwork(n.network)}
                className={`focus-visible:ring-bleu-100 flex min-h-12 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold outline-none focus-visible:ring-4 ${
                  network === n.network
                    ? 'border-bleu-600 bg-bleu-50 text-bleu-600'
                    : 'border-gris-200 bg-blanc text-encre hover:border-bleu-600'
                }`}
              >
                {n.network ? <NetworkIcon network={n.network} /> : null}
                <span className="min-w-0 break-words">{n.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-gris-200 bg-blanc flex max-w-3xl flex-col gap-4 rounded-xl border p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="wb-q" className="text-encre text-sm font-semibold">
            {t('pickerSearchLabel')}
          </label>
          <Input
            id="wb-q"
            type="search"
            enterKeyHint="search"
            value={q}
            maxLength={60}
            placeholder={t('pickerSearchPlaceholder')}
            onChange={(e) => {
              setQ(e.target.value);
              setServiceId(null);
            }}
          />
        </div>
        {current ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="wb-type" className="text-encre text-sm font-semibold">
              {t('pickerTypes')}
            </label>
            <select
              id="wb-type"
              className={selectClass}
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setServiceId(null);
              }}
            >
              <option value="">{t('pickerAllTypes')}</option>
              {current.types.map((ty) => (
                <option key={ty.type} value={ty.type}>
                  {ty.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <label htmlFor="wb-service" className="text-encre text-sm font-semibold">
            {t('serviceLabel')}
          </label>
          <select
            id="wb-service"
            data-testid="picker-service-select"
            className={selectClass}
            value={serviceId ?? ''}
            onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">{t('pickerChooseService')}</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {`${money(s.priceXaf1000)} — ${s.name}`}
              </option>
            ))}
          </select>
          <p className="text-gris-600 text-sm" aria-live="polite">
            {matches.length === 0
              ? t('pickerNoResults')
              : matches.length > MAX_OPTIONS
                ? t('pickerTruncated', { shown: MAX_OPTIONS, total: matches.length })
                : t('pickerCount', { count: matches.length })}
          </p>
        </div>
      </section>

      {selected ? (
        <>
          <div className="flex justify-end">
            <FavoriteToggle
              key={selected.service.id}
              serviceId={selected.service.id}
              initialFavorite={favoriteIds.includes(selected.service.id)}
            />
          </div>
          <OrderForm
            key={selected.service.id}
            service={{
              id: selected.service.id,
              name: selected.service.name,
              description: selected.service.description,
              platform: selected.network,
              priceXaf1000: selected.service.priceXaf1000,
              minQty: selected.service.minQty,
              maxQty: selected.service.maxQty,
              needsComments: selected.service.needsComments,
            }}
            currency={currency}
            usdXafRate={usdXafRate}
            balanceXaf={balanceXaf}
            initialQuantity={
              selected.service.id === props.initialServiceId ? props.initialQuantity : undefined
            }
          />
        </>
      ) : (
        <WalletBalance amount={money(balanceXaf)} />
      )}
    </div>
  );
}
