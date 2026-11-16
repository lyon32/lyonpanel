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
      <p className="text-gris-600">{t('storage.intro')}</p>
      {shown.length === 0 ? (
        <p>{t('storage.empty')}</p>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gris-600">
                <th className="py-2">{t('storage.path')}</th>
                <th className="py-2">{t('storage.size')}</th>
                <th className="py-2">{t('storage.created')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.path} className="border-gris-200 border-t">
                  <td className="py-2 font-mono text-xs break-all">{o.path}</td>
                  <td className="py-2">{formatBytes(o.size_bytes)}</td>
                  <td className="py-2">{formatDateTime(o.created_at, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orphans.length > shown.length ? (
            <p className="text-gris-600 text-sm">{t('storage.limit', { max: MAX_PURGE_PATHS })}</p>
          ) : null}
          <PurgeOrphansForm paths={shown.map((o) => o.path)} />
        </>
      )}
    </>
  );
}
