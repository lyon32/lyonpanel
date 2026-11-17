import type { ReactNode } from 'react';
import { AdminLogout } from '@/components/admin/admin-logout';
import { AdminNav } from '@/components/admin/admin-nav';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { requireAdminPage } from '@/server/admin/page-guard';

type Props = { children: ReactNode; params: Promise<{ adminPath: string }> };

// Cadre commun des écrans internes : contrôle admin + code à 6 chiffres, sinon 404.
export default async function AdminPanelLayout({ children, params }: Props) {
  await requireAdminPage();
  const { adminPath } = await params;
  const { t } = await getAdminTranslator();
  const links = [
    { href: `/${adminPath}/stats`, label: t('nav.stats') },
    { href: `/${adminPath}/orders`, label: t('nav.orders') },
    { href: `/${adminPath}/services`, label: t('nav.services') },
    { href: `/${adminPath}/settings`, label: t('nav.settings') },
    { href: `/${adminPath}/users`, label: t('nav.users') },
    { href: `/${adminPath}/tickets`, label: t('nav.tickets') },
    { href: `/${adminPath}/payments`, label: t('nav.payments') },
    { href: `/${adminPath}/audit`, label: t('nav.audit') },
    { href: `/${adminPath}/storage`, label: t('nav.storage') },
  ];
  return (
    <div className="bg-gris-50 min-h-dvh">
      <header className="border-gris-200 bg-blanc border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <p className="text-bleu-600 border-jaune-500 border-b-2 text-base font-bold">
            {t('nav.brand')}
          </p>
          <div className="ml-auto sm:order-3">
            <AdminLogout adminPath={adminPath} label={t('nav.logout')} />
          </div>
          <div className="w-full sm:order-2 sm:w-auto sm:flex-1">
            <AdminNav links={links} label={t('nav.label')} />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
