import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { LogoutButton } from '@/components/auth/logout-button';
import { BalanceBadge } from '@/components/layout/balance-badge';
import { BottomNav } from '@/components/layout/bottom-nav';
import { CurrencySwitcher } from '@/components/layout/currency-switcher';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Sidebar } from '@/components/layout/sidebar';
import { setCurrencyCookie } from '@/lib/actions/currency';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { requireUser } from '@/server/auth/require-user';

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Zone privée : sans session valide, redirection vers la connexion avant tout affichage.
  const { locale } = await params;
  await requireUser(locale === 'en' ? 'en' : 'fr');
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-gris-200 bg-blanc flex items-center justify-end gap-2 border-b px-4 py-2">
          <LanguageSwitcher />
          <CurrencySwitcher value={currency} setCurrencyCookie={setCurrencyCookie} />
          {/* Solde réel branché plus tard ; ici un tiret, rien n'est calculé. */}
          <BalanceBadge balanceLabel="—" />
          <LogoutButton />
        </header>
        {/* pb-20 : laisse la place à la barre du bas sur mobile */}
        <main className="flex-1 px-4 pt-6 pb-20 md:pb-6">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
