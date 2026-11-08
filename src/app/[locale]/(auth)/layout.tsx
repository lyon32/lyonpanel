import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Logo } from '@/components/shared/logo';
import { Link } from '@/i18n/navigation';

// Pages de compte : colonne étroite centrée, sans menu du site.
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex min-h-11 items-center">
          <Logo alt={t('brandAlt')} className="h-8 w-auto" />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
