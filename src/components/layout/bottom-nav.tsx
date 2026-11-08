'use client';

import { CircleUser, ListOrdered, Plus, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const items = [
  { href: '/order', key: 'bottomOrder', Icon: Plus },
  { href: '/orders', key: 'orders', Icon: ListOrdered },
  { href: '/add-funds', key: 'addFunds', Icon: Wallet },
  { href: '/account', key: 'account', Icon: CircleUser },
] as const;

// Mobile : 4 entrées, cibles d'au moins 44 px, masquée à partir de md.
export function BottomNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('bottomLabel')}
      className="border-gris-200 bg-blanc fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t md:hidden"
    >
      {items.map(({ href, key, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
              active ? 'text-bleu-600' : 'text-gris-600',
            )}
          >
            <Icon size={20} aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
