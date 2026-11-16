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
      <form method="get" className="flex flex-wrap items-end gap-3">
        <Field
          name="q"
          label={t('users.search')}
          defaultValue={query.q ?? ''}
          maxLength={100}
          className="min-w-64 flex-1"
        />
        <Button type="submit">{t('users.searchSubmit')}</Button>
      </form>

      {result.items.length === 0 ? (
        <p className="text-gris-600">{t('users.empty')}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gris-600">
              <th className="py-2">{t('users.email')}</th>
              <th className="py-2">{t('users.phone')}</th>
              <th className="py-2">{t('users.country')}</th>
              <th className="py-2">{t('users.balance')}</th>
              <th className="py-2">{t('common.status')}</th>
              <th className="py-2">{t('users.created')}</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {result.items.map((u) => (
              <tr key={u.id} className="border-gris-200 border-t">
                <td className="py-2">{u.email}</td>
                <td className="py-2">{u.phone}</td>
                <td className="py-2">{u.country}</td>
                <td className="py-2">{formatXaf(u.balance_xaf, locale)}</td>
                <td className="py-2">
                  <Badge status={isKnownStatus(u.status) ? BADGE[u.status] : 'info'}>
                    {isKnownStatus(u.status) ? t(`users.status.${u.status}`) : u.status}
                  </Badge>
                </td>
                <td className="py-2">{formatDateTime(u.created_at, locale)}</td>
                <td className="py-2">
                  <Link
                    href={`/${adminPath}/users/${u.id}`}
                    className="text-bleu-600 font-semibold"
                  >
                    {t('users.open')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result.next_cursor ? (
        <Link
          href={`/${adminPath}/users?${nextParams.toString()}`}
          className="text-bleu-600 font-semibold"
        >
          {t('common.next')}
        </Link>
      ) : null}
    </>
  );
}
