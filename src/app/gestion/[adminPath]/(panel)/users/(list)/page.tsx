import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { formatDateTime, formatXaf } from '@/lib/admin-format';
import { listUsers } from '@/server/admin/users';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { requireAdminPage } from '@/server/admin/page-guard';
import { listUsersQuerySchema } from '@/server/schemas/admin-users';

type Props = {
  params: Promise<{ adminPath: string }>;
  searchParams: Promise<{ q?: string; cursor?: string }>;
};

const BADGE = { active: 'success', blocked: 'failed', deleted: 'pending' } as const;
type KnownStatus = keyof typeof BADGE;
const isKnownStatus = (s: string): s is KnownStatus => s in BADGE;

export default async function AdminUsersPage({ params, searchParams }: Props) {
  await requireAdminPage();
  const { adminPath } = await params;
  const sp = await searchParams;
  const { t, locale } = await getAdminTranslator();
  // Même validation que la route API ; une adresse trafiquée retombe sur la liste sans filtre.
  const parsed = listUsersQuerySchema.safeParse({
    q: typeof sp.q === 'string' && sp.q !== '' ? sp.q : undefined,
    cursor: typeof sp.cursor === 'string' && sp.cursor !== '' ? sp.cursor : undefined,
  });
  const query = parsed.success ? parsed.data : listUsersQuerySchema.parse({});
  let result;
  try {
    result = await listUsers(query);
  } catch {
    // Curseur invalide (adresse modifiée à la main) : retour à la première page.
    result = await listUsers(listUsersQuerySchema.parse({ q: query.q }));
  }

  const nextParams = new URLSearchParams();
  if (query.q) nextParams.set('q', query.q);
  if (result.next_cursor) nextParams.set('cursor', result.next_cursor);

  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('users.title')}</h1>
      <form method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          name="q"
          type="search"
          label={t('users.search')}
          defaultValue={query.q ?? ''}
          maxLength={100}
          autoCapitalize="none"
          spellCheck={false}
          className="flex-1"
        />
        <Button type="submit">{t('users.searchSubmit')}</Button>
      </form>

      {result.items.length === 0 ? (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
          {t('users.empty')}
        </p>
      ) : (
        <ul className="border-gris-200 bg-blanc divide-gris-200 divide-y overflow-hidden rounded-xl border">
          {result.items.map((u) => (
            <li key={u.id}>
              <Link
                href={`/${adminPath}/users/${u.id}`}
                aria-label={`${t('users.open')} : ${u.email ?? u.phone ?? ''}`}
                className="hover:bg-bleu-50 focus-visible:ring-bleu-100 flex min-h-11 flex-col gap-1 px-4 py-3 outline-none focus-visible:ring-4 focus-visible:ring-inset"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-encre font-semibold break-all">{u.email ?? u.phone}</span>
                  <Badge status={isKnownStatus(u.status) ? BADGE[u.status] : 'info'}>
                    {isKnownStatus(u.status) ? t(`users.status.${u.status}`) : u.status}
                  </Badge>
                </span>
                <span className="text-gris-600 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                  <span>{[u.phone, u.country].filter(Boolean).join(' · ')}</span>
                  <span className="text-encre font-semibold tabular-nums">
                    {t('users.balance')} : {formatXaf(u.balance_xaf, locale)}
                  </span>
                </span>
                <span className="text-gris-600 text-xs">
                  {t('users.created')} {formatDateTime(u.created_at, locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.next_cursor ? (
        <Link
          href={`/${adminPath}/users?${nextParams.toString()}`}
          className="border-gris-200 bg-blanc text-bleu-600 hover:bg-bleu-50 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold outline-none focus-visible:ring-4 sm:w-fit"
        >
          {t('common.next')}
        </Link>
      ) : null}
    </>
  );
}
