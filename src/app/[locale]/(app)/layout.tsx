import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { LogoutButton } from '@/components/auth/logout-button';
import { BalanceBadge } from '@/components/layout/balance-badge';
import { BottomNav } from '@/components/layout/bottom-nav';
import { CurrencySwitcher } from '@/components/layout/currency-switcher';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { Sidebar } from '@/components/layout/sidebar';
import { Logo } from '@/components/shared/logo';
import { Toaster } from '@/components/ui/sonner';
import { Link } from '@/i18n/navigation';
import { setCurrencyCookie } from '@/lib/actions/currency';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';
import { firstNameFromEmail } from '@/lib/first-name';
import { formatCatalogMoney } from '@/lib/money';
import { requireUser } from '@/server/auth/require-user';
import { getUsdXafRateCached } from '@/server/catalog/public-catalog';
import { getWallet } from '@/server/wallet/wallet';

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Zone privée : sans session valide, redirection vers la connexion avant tout affichage.
  const { locale } = await params;
  const user = await requireUser(locale === 'en' ? 'en' : 'fr');
  const t = await getTranslations({ locale, namespace: 'auth' });
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  // Même source que GET /api/v1/wallet ; le taux USD n'est lu que si la devise affichée est le dollar.
  const [wallet, usdXafRate] = await Promise.all([
    getWallet(user.id),
    currency === 'USD' ? getUsdXafRateCached() : Promise.resolve(1),
  ]);
  const balanceLabel = formatCatalogMoney(wallet.balance_xaf, currency, locale, usdXafRate);
  return (
    // Espace client en thème sombre (docs/05 §11) : la classe .lp-app porte toutes les variables.
    <div className="lp-app flex min-h-screen">
      <Sidebar name={firstNameFromEmail(user.email)} email={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-gris-200 bg-blanc flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 md:justify-end md:px-4">
          {/* Téléphone : la barre latérale est masquée, le logo vient ici. */}
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center md:hidden"
          >
            <Logo variant="icon" alt={t('brandAlt')} className="size-8" />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-1.5 md:gap-2">
            <LanguageSwitcher />
            <CurrencySwitcher value={currency} setCurrencyCookie={setCurrencyCookie} />
            <BalanceBadge balanceLabel={balanceLabel} />
            <LogoutButton />
          </div>
        </header>
        {/* pb-24 : laisse la place à la barre du bas sur mobile */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-6 md:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
      <Toaster
        theme="dark"
        position="top-center"
        style={
          {
            '--normal-bg': 'var(--lp-app-card-raised)',
            '--normal-text': 'var(--lp-app-text)',
            '--normal-border': 'var(--lp-app-border)',
          } as React.CSSProperties
        }
      />
    </div>
  );
}
