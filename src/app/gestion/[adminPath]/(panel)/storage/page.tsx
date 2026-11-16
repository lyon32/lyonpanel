import { PurgeOrphansForm } from '@/components/admin/purge-orphans-form';
import { formatBytes, formatDateTime } from '@/lib/admin-format';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { requireAdminPage } from '@/server/admin/page-guard';
import { MAX_PURGE_PATHS } from '@/server/schemas/storage';
import { listOrphanAttachments } from '@/server/tickets/purge-orphans';

export default async function AdminStoragePage() {
  await requireAdminPage();
  const { t, locale } = await getAdminTranslator();
  const orphans = await listOrphanAttachments();
  // La route de purge refuse plus de MAX_PURGE_PATHS chemins : on n'en propose pas davantage.
  const shown = orphans.slice(0, MAX_PURGE_PATHS);

  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('storage.title')}</h1>
      <p className="text-gris-600 text-sm">{t('storage.intro')}</p>
      {shown.length === 0 ? (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
          {t('storage.empty')}
        </p>
      ) : (
        <>
          <ul className="border-gris-200 bg-blanc divide-gris-200 divide-y overflow-hidden rounded-xl border">
            {shown.map((o) => (
              <li key={o.path} className="flex flex-col gap-1 px-4 py-3">
                <span className="text-encre font-mono text-xs break-all">{o.path}</span>
                <span className="text-gris-600 text-sm tabular-nums">
                  {formatBytes(o.size_bytes)} · {t('storage.created')}{' '}
                  {formatDateTime(o.created_at, locale)}
                </span>
              </li>
            ))}
          </ul>
          {orphans.length > shown.length ? (
            <p className="text-gris-600 text-sm">{t('storage.limit', { max: MAX_PURGE_PATHS })}</p>
          ) : null}
          <PurgeOrphansForm paths={shown.map((o) => o.path)} />
        </>
      )}
    </>
  );
}
