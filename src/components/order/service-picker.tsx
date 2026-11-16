import { getTranslations } from 'next-intl/server';
import { NetworkIcon } from '@/components/catalog/network-icon';
import { Pagination } from '@/components/catalog/pagination';
import { ServiceTitle } from '@/components/catalog/service-title';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/navigation';
import type { Currency } from '@/lib/currency';
import { formatCatalogMoney } from '@/lib/money';

// Forme attendue de buildPicker() (src/server/catalog/picker.ts) ; déclarée ici car un composant
// n'importe pas @/server. TypeScript vérifie la correspondance à l'appel dans la page.
interface PickerView {
  network: string | null;
  type: string | null;
  q: string;
  page: number;
  totalPages: number;
  total: number;
  networks: { network: string; label: string; count: number }[];
  types: { type: string; label: string; count: number }[];
  services: { id: number; name: string; priceXaf1000: number; minQty: number; maxQty: number }[];
}

type Query = { network?: string; type?: string; q?: string; page?: number };

const chip =
  'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-bleu-100';
const chipOn = 'border-bleu-600 bg-bleu-600 text-blanc';
const chipOff = 'border-gris-200 bg-blanc text-encre hover:border-bleu-600';

// Choix du service dans l'espace client : réseau -> type -> service, tout côté serveur (liens et
// formulaire GET, sans JavaScript). Seul le prix de vente sort ; rien du fournisseur.
export async function ServicePicker({
  view,
  locale,
  currency,
  usdXafRate,
}: {
  view: PickerView;
  locale: string;
  currency: Currency;
  usdXafRate: number;
}) {
  const t = await getTranslations('order');
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const href = (query: Query) => ({ pathname: '/order' as const, query });
  const base = { network: view.network ?? undefined, type: view.type ?? undefined };
  const browsing = view.network !== null || view.q !== '';
  const q = view.q || undefined;

  return (
    <div className="flex flex-col gap-4" data-testid="service-picker">
      <form method="get" role="search" className="flex max-w-lg gap-2">
        {view.network ? <input type="hidden" name="network" value={view.network} /> : null}
        {view.type ? <input type="hidden" name="type" value={view.type} /> : null}
        <label htmlFor="picker-q" className="sr-only">
          {t('pickerSearchLabel')}
        </label>
        <Input
          id="picker-q"
          name="q"
          type="search"
          enterKeyHint="search"
          defaultValue={view.q}
          placeholder={t('pickerSearchPlaceholder')}
          maxLength={60}
        />
        <Button type="submit" variant="secondary">
          {t('pickerSearchButton')}
        </Button>
      </form>

      {view.network === null ? (
        <section aria-labelledby="picker-networks" className="flex flex-col gap-3">
          <h2 id="picker-networks" className="text-encre text-lg font-semibold">
            {t('pickerNetworks')}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.networks.map((n) => (
              <li key={n.network}>
                <Link
                  href={href({ network: n.network })}
                  data-testid="picker-network"
                  className="border-gris-200 bg-blanc hover:border-bleu-600 focus-visible:ring-bleu-100 flex min-h-14 items-center gap-3 rounded-xl border p-3 outline-none focus-visible:ring-4"
                >
                  <NetworkIcon network={n.network} />
                  <span className="min-w-0">
                    <span className="text-encre block font-bold">{n.label}</span>
                    <span className="text-gris-600 block text-sm">
                      {t('pickerCount', { count: n.count })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <nav aria-label={t('pickerTypes')} className="flex flex-wrap items-center gap-2">
          <Link href={href({ q })} className={`${chip} ${chipOff}`}>
            {t('pickerBack')}
          </Link>
          <Link
            href={href({ network: view.network, q })}
            aria-current={view.type === null ? 'true' : undefined}
            className={`${chip} ${view.type === null ? chipOn : chipOff}`}
          >
            {t('pickerAll')}
          </Link>
          {view.types.map((ty) => (
            <Link
              key={ty.type}
              href={href({ network: view.network ?? undefined, type: ty.type, q })}
              aria-current={view.type === ty.type ? 'true' : undefined}
              className={`${chip} ${view.type === ty.type ? chipOn : chipOff}`}
            >
              {ty.label} ({ty.count})
            </Link>
          ))}
        </nav>
      )}

      {browsing ? (
        view.services.length === 0 ? (
          <EmptyState title={t('pickerNoResults')} description={t('pickerNoResultsText')} />
        ) : (
          <>
            <p className="text-gris-600 text-sm" aria-live="polite">
              {t('pickerCount', { count: view.total })}
            </p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {view.services.map((s) => (
                <li key={s.id}>
                  <Card
                    data-testid="picker-service"
                    className="focus-within:ring-bleu-100 hover:border-bleu-600 relative flex h-full flex-col gap-2 p-4 focus-within:ring-4"
                  >
                    {/* Lien étendu : toute la carte est cliquable sans imbriquer de liens. */}
                    <Link
                      href={{ pathname: '/order', query: { service: s.id } }}
                      className="hover:text-bleu-600 block min-h-11 rounded-lg outline-none after:absolute after:inset-0 after:rounded-xl"
                    >
                      <ServiceTitle name={s.name} />
                    </Link>
                    <p className="text-encre text-sm font-semibold tabular-nums">
                      {t('pickerPricePer1000', {
                        price: formatCatalogMoney(s.priceXaf1000, currency, locale, usdXafRate),
                      })}
                    </p>
                    <p className="text-gris-600 text-sm tabular-nums">
                      {t('pickerRange', { min: nf.format(s.minQty), max: nf.format(s.maxQty) })}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination
              page={view.page}
              totalPages={view.totalPages}
              q={view.q}
              hrefFor={(query) => ({ pathname: '/order', query: { ...base, ...query } })}
            />
          </>
        )
      ) : null}
    </div>
  );
}
