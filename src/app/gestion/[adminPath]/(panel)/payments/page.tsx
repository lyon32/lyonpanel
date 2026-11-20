import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatXaf } from '@/lib/admin-format';
import { emailsByUserId } from '@/server/admin/emails';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { listPayments } from '@/server/admin/payments';
import { listPaymentsQuerySchema } from '@/server/schemas/admin-payments';

type Props = {
  params: Promise<{ adminPath: string }>;
  searchParams: Promise<{ status?: string; cursor?: string }>;
};

const chip =
  'focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4';
const STATUSES = ['created', 'pending', 'succeeded', 'failed'] as const;

export default async function AdminPaymentsPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { adminPath } = await params;
  const sp = await searchParams;
  const { t, locale } = await getAdminTranslator();
  const pick = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);
  const parsed = listPaymentsQuerySchema.safeParse({
    status: pick(sp.status),
    cursor: pick(sp.cursor),
  });
  const query = parsed.success ? parsed.data : listPaymentsQuerySchema.parse({});
  let result;
  try {
    result = await listPayments(query);
  } catch {
    result = await listPayments({ ...query, cursor: undefined });
  }
  const emails = await emailsByUserId(result.items.map((i) => i.user_id));
  const href = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: query.status, ...extra })) if (v) p.set(k, v);
    const qs = p.toString();
    return `/${adminPath}/payments${qs ? `?${qs}` : ''}`;
  };
  const badge = (s: string) =>
    s === 'succeeded' ? 'success' : s === 'failed' ? 'failed' : 'pending';

  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('payments.title')}</h1>
      <nav aria-label={t('payments.filterLabel')} className="-mx-1 flex gap-1 overflow-x-auto">
        {[undefined, ...STATUSES].map((s) => {
          const active = query.status === s;
          return (
            <Link
              key={s ?? 'all'}
              href={href({ status: s, cursor: undefined })}
              aria-current={active ? 'true' : undefined}
              className={`${chip} ${active ? 'bg-bleu-50 text-bleu-600' : 'text-gris-600 hover:bg-gris-50'}`}
            >
              {s ? t(`payments.statuses.${s}`) : t('payments.all')}
            </Link>
          );
        })}
      </nav>

      {result.items.length === 0 ? (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
          {t('payments.empty')}
        </p>
      ) : (
        <ul className="border-gris-200 bg-blanc divide-gris-200 divide-y overflow-hidden rounded-xl border">
          {result.items.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 px-4 py-3">
              <span className="flex items-start justify-between gap-3">
                <span className="text-encre font-semibold tabular-nums">
                  {formatXaf(Number(p.credited_xaf), locale)}
                </span>
                <Badge status={badge(p.status)}>
                  {t(`payments.statuses.${p.status as (typeof STATUSES)[number]}`)}
                </Badge>
              </span>
              <Link
                href={`/${adminPath}/users/${p.user_id}`}
                className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center text-sm break-all underline outline-none focus-visible:ring-4"
              >
                {emails.get(p.user_id) ?? p.user_id}
              </Link>
              <span className="text-gris-600 text-sm tabular-nums">
                {formatDateTime(p.created_at, locale)}
              </span>
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
