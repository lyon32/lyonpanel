import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Logo } from '@/components/shared/logo';
import { Link } from '@/i18n/navigation';

// Pages de compte : colonne étroite centrée, sans menu du site.
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('auth');
  return (
    <div className="lp-auth-bg mx-auto flex min-h-dvh w-full flex-col gap-4 px-4 py-4 sm:py-5">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <Link href="/" className="inline-flex min-h-11 items-center">
          <Logo alt={t('brandAlt')} className="h-8 w-auto" />
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 flex-col justify-center">{children}</main>
    </div>
  );
}
