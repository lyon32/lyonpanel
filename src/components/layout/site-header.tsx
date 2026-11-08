'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { CurrencySwitcher } from './currency-switcher';
import { LanguageSwitcher } from './language-switcher';
import { useMotionLevel } from '@/hooks/use-motion-level';
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
  const [open, setOpen] = useState(false);
  // Verre flouté seulement sur ordinateur et appareil correct : ailleurs, fond blanc simple.
  const glass = useMotionLevel() === 'rich';

  // Échap ferme le menu (téléphone) ; l'écouteur n'existe que menu ouvert.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Un seul exemplaire de chaque élément dans le DOM : sur téléphone, liens et
  // sélecteurs sont masqués tant que le menu est fermé ; dès md ils s'affichent
  // en ligne. L'ordre (`order-*`) place chaque bloc selon la taille d'écran.
  const panel = open ? 'flex w-full' : 'hidden';
  return (
    <header
      className={`border-gris-200 border-b md:sticky md:top-3 md:z-40 md:mx-auto md:mt-3 md:w-[calc(100%-2rem)] md:max-w-5xl md:rounded-2xl md:border md:shadow-sm ${glass ? 'bg-blanc/90 md:bg-blanc/70 md:backdrop-blur-md' : 'bg-blanc md:bg-blanc/95'}`}
    >
      <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 px-2 py-2 md:flex-nowrap md:gap-x-6 md:px-3">
        <Link
          href="/"
          className="order-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center"
        >
          <Logo variant="icon" alt="LyonPanel" className="size-10 md:size-11" />
        </Link>
        <nav
          id="site-menu"
          aria-label={t('mainLabel')}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false);
          }}
          className={`${panel} order-5 flex-col gap-1 md:order-2 md:flex md:w-auto md:flex-row`}
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
        </nav>
        <div
          className={`${panel} order-6 items-center gap-2 pb-2 md:order-3 md:ml-auto md:flex md:w-auto md:pb-0`}
        >
          <LanguageSwitcher />
          <CurrencySwitcher value={currency} setCurrencyCookie={setCurrencyCookie} />
        </div>
        <div className="order-3 ml-auto flex items-center md:order-4 md:ml-0">
          <Link
            href="/login"
            className="text-encre hover:bg-gris-50 flex min-h-11 items-center rounded-lg px-2 text-sm font-medium md:px-3 md:text-base"
          >
            {t('login')}
          </Link>
          <Button asChild className="px-3 text-sm md:px-4 md:text-base">
            <Link href="/register">{t('register')}</Link>
          </Button>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? t('closeMenu') : t('menu')}
          onClick={() => setOpen((v) => !v)}
          className="text-encre hover:bg-gris-50 order-4 flex size-11 items-center justify-center rounded-lg md:hidden"
        >
          {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        </button>
      </div>
    </header>
  );
}
