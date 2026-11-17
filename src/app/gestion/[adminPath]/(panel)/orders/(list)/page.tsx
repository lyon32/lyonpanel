import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import {
  formatDateTime,
  formatXaf,
  ORDER_STATUSES,
  orderBadgeStatus,
  orderStatusLabel,
} from '@/lib/admin-format';
import { listAdminOrders } from '@/server/admin/orders';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { requireAdminPage } from '@/server/admin/page-guard';
import { listAdminOrdersQuerySchema } from '@/server/schemas/admin-orders';

type Props = {
  params: Promise<{ adminPath: string }>;
  searchParams: Promise<{ q?: string; status?: string; cursor?: string }>;
};

const chip =
  'focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4';

export default async function AdminOrdersPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { adminPath } = await params;
  const sp = await searchParams;
  const { t, locale } = await getAdminTranslator();
  const pick = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);
  // Même validation que la route API ; une adresse trafiquée retombe sur la liste sans filtre.
  const parsed = listAdminOrdersQuerySchema.safeParse({
    q: pick(sp.q),
    status: pick(sp.status),
    cursor: pick(sp.cursor),
  });
  const query = parsed.success ? parsed.data : listAdminOrdersQuerySchema.parse({});
  let result;
  try {
    result = await listAdminOrders(query);
  } catch {
    // Curseur invalide (adresse modifiée à la main) : retour à la première page.
    result = await listAdminOrders({ ...query, cursor: undefined });
  }
  const statusLabels = Object.fromEntries(
    ORDER_STATUSES.map((s) => [s, t(`user.orderStatuses.${s}`)]),
  );
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { q: query.q, status: query.status, ...extra };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    const qs = p.toString();
    return `/${adminPath}/orders${qs ? `?${qs}` : ''}`;
  };

  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('orders.title')}</h1>
      <form method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {query.status ? <input type="hidden" name="status" value={query.status} /> : null}
        <Field
          name="q"
          type="search"
          inputMode="numeric"
          label={t('orders.search')}
          defaultValue={query.q ?? ''}
          maxLength={9}
          className="flex-1"
        />
        <Button type="submit">{t('orders.searchSubmit')}</Button>
      </form>
      <nav aria-label={t('orders.filterLabel')} className="-mx-1 flex gap-1 overflow-x-auto">
        {[undefined, ...ORDER_STATUSES].map((s) => {
          const active = query.status === s;
          return (
            <Link
              key={s ?? 'all'}
              href={href({ status: s, cursor: undefined })}
              aria-current={active ? 'true' : undefined}
              className={`${chip} ${active ? 'bg-bleu-50 text-bleu-600' : 'text-gris-600 hover:bg-gris-50'}`}
            >
              {s ? statusLabels[s] : t('orders.filterAll')}
            </Link>
          );
        })}
      </nav>

      {result.items.length === 0 ? (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
          {t('orders.empty')}
        </p>
      ) : (
        <ul className="border-gris-200 bg-blanc divide-gris-200 divide-y overflow-hidden rounded-xl border">
          {result.items.map((o) => (
            <li key={o.id}>
              <Link
                href={`/${adminPath}/orders/${o.id}`}
                aria-label={`${t('orders.open')} #${o.short_id}`}
                className="hover:bg-bleu-50 focus-visible:ring-bleu-100 flex min-h-11 flex-col gap-1 px-4 py-3 outline-none focus-visible:ring-4 focus-visible:ring-inset"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-encre font-semibold tabular-nums">#{o.short_id}</span>
                  <Badge status={orderBadgeStatus(o.status)}>
                    {orderStatusLabel(o.status, statusLabels)}
                  </Badge>
                </span>
                <span className="text-gris-600 text-sm break-all">
                  {o.user_email ?? o.user_phone}
                </span>
                <span className="text-gris-600 flex flex-wrap justify-between gap-x-4 text-sm tabular-nums">
                  <span className="text-encre font-semibold">
                    {formatXaf(o.charged_xaf, locale)}
                  </span>
                  <span>{formatDateTime(o.created_at, locale)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.next_cursor ? (
        <Link
          href={href({ cursor: result.next_cursor })}
          className="border-gris-200 bg-blanc text-bleu-600 hover:bg-bleu-50 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold outline-none focus-visible:ring-4 sm:w-fit"
        >
          {t('common.next')}
        </Link>
      ) : null}
    </>
  );
}
