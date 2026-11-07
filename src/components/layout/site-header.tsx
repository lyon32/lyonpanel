import { useTranslations } from 'next-intl';
import { CurrencySwitcher } from './currency-switcher';
import { LanguageSwitcher } from './language-switcher';
import { Logo } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { Currency } from '@/lib/currency';

type Props = {
  currency: Currency;
  setCurrencyCookie: (currency: Currency) => void | Promise<void>;
};

const links = [
  { href: '/', key: 'home' },
  { href: '/services', key: 'services' },
  { href: '/blog', key: 'blog' },
] as const;

export function SiteHeader({ currency, setCurrencyCookie }: Props) {
  const t = useTranslations('nav');
  return (
    <header className="border-gris-200 bg-blanc border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
        <Link href="/" className="shrink-0">
          <Logo alt="LyonPanel" className="h-8 w-auto" />
        </Link>
        <nav
          aria-label={t('mainLabel')}
          className="order-last flex w-full gap-1 md:order-none md:w-auto"
        >
          {links.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="text-encre hover:bg-gris-50 flex min-h-11 items-center rounded-lg px-3 text-base font-medium"
            >
              {t(l.key)}
            </Link>
          ))}
          <Link
            href="/login"
            className="text-encre hover:bg-gris-50 ml-auto flex min-h-11 items-center rounded-lg px-3 text-base font-medium md:ml-4"
          >
            {t('login')}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <CurrencySwitcher value={currency} setCurrencyCookie={setCurrencyCookie} />
          <Button asChild>
            <Link href="/register">{t('register')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
