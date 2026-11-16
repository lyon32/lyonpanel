import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminLogout } from '@/components/admin/admin-logout';
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
    { href: `/${adminPath}/users`, label: t('nav.users') },
    { href: `/${adminPath}/storage`, label: t('nav.storage') },
  ];
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="border-gris-200 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <nav aria-label={t('nav.label')} className="flex flex-wrap gap-4">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-bleu-600 font-semibold">
              {l.label}
            </Link>
          ))}
        </nav>
        <AdminLogout adminPath={adminPath} label={t('nav.logout')} />
      </header>
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
