import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { formatDateTime } from '@/lib/admin-format';
import { listAudit } from '@/server/admin/audit';
import { emailsByUserId } from '@/server/admin/emails';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { listAuditQuerySchema } from '@/server/schemas/admin-audit';

type Props = {
  params: Promise<{ adminPath: string }>;
  searchParams: Promise<{ action?: string; cursor?: string }>;
};

export default async function AdminAuditPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { adminPath } = await params;
  const sp = await searchParams;
  const { t, locale } = await getAdminTranslator();
  const pick = (v: unknown) => (typeof v === 'string' && v !== '' ? v : undefined);
  // Même validation que la route API : un filtre invalide retombe sur le journal complet.
  const parsed = listAuditQuerySchema.safeParse({
    action: pick(sp.action),
    cursor: pick(sp.cursor),
  });
  const query = parsed.success ? parsed.data : listAuditQuerySchema.parse({});
  const result = await listAudit(query);
  const actorIds = result.items.flatMap((i) => (i.actor_id ? [i.actor_id] : []));
  const emails = await emailsByUserId(actorIds);
  const next = new URLSearchParams();
  if (query.action) next.set('action', query.action);
  if (result.next_cursor) next.set('cursor', result.next_cursor);

  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('audit.title')}</h1>
      <form method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          name="action"
          label={t('audit.filterLabel')}
          defaultValue={query.action ?? ''}
          maxLength={64}
          className="flex-1"
        />
        <Button type="submit">{t('audit.filterSubmit')}</Button>
      </form>

      {result.items.length === 0 ? (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
          {t('audit.empty')}
        </p>
      ) : (
        <ul className="border-gris-200 bg-blanc divide-gris-200 divide-y overflow-hidden rounded-xl border">
          {result.items.map((i) => (
            <li key={i.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <span className="text-encre font-semibold break-all">{i.action}</span>
              <span className="text-gris-600 break-all">
                {t('audit.who')} :{' '}
                {i.actor_id ? (emails.get(i.actor_id) ?? i.actor_id) : t('audit.system')}
              </span>
              {i.target_table ? (
                <span className="text-gris-600 break-all">
                  {t('audit.target')} : {i.target_table} {i.target_id ?? ''}
                </span>
              ) : null}
              {i.details ? (
                <pre
                  aria-label={t('audit.details')}
                  className="bg-gris-50 text-encre overflow-x-auto rounded-lg p-2 text-xs break-all whitespace-pre-wrap"
                >
                  {JSON.stringify(i.details, null, 2)}
                </pre>
              ) : null}
              <span className="text-gris-600 tabular-nums">
                {formatDateTime(i.created_at, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {result.next_cursor ? (
        <Link
          href={`/${adminPath}/audit?${next.toString()}`}
          className="border-gris-200 bg-blanc text-bleu-600 hover:bg-bleu-50 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold outline-none focus-visible:ring-4 sm:w-fit"
        >
          {t('common.next')}
        </Link>
      ) : null}
    </>
  );
}
