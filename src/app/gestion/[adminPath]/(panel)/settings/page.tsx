import { SettingsForm } from '@/components/admin/settings-form';
import { readSettingValues } from '@/lib/admin-settings-form';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminSettings } from '@/server/admin/settings';

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const { t } = await getAdminTranslator();
  const { settings } = await getAdminSettings();
  const current = readSettingValues(settings);
  return (
    <>
      <h1 className="text-encre text-2xl font-bold">{t('settings.title')}</h1>
      <p className="text-gris-600 text-sm">{t('settings.intro')}</p>
      {current ? (
        // La clé remonte le formulaire quand les valeurs changent (après un enregistrement).
        <SettingsForm key={JSON.stringify(current)} current={current} />
      ) : (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-5 text-sm">
          {t('settings.unavailable')}
        </p>
      )}
    </>
  );
}
