'use client';

import { CircleUser, Gift, LifeBuoy, ListOrdered, Plus, Store, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const items = [
  { href: '/orders', key: 'orders', Icon: ListOrdered },
  { href: '/services', key: 'services', Icon: Store },
  { href: '/add-funds', key: 'addFunds', Icon: Wallet },
  { href: '/referral', key: 'referral', Icon: Gift },
  { href: '/tickets', key: 'support', Icon: LifeBuoy },
  { href: '/account', key: 'account', Icon: CircleUser },
] as const;

// Visible à partir de md ; en dessous, la barre du bas prend le relais.
export function Sidebar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('appLabel')}
      className="border-gris-200 bg-blanc hidden w-60 shrink-0 flex-col gap-1 border-r p-4 md:flex"
    >
      <Link
        href="/order"
        className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 mb-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold focus-visible:ring-4"
      >
        <Plus size={20} aria-hidden="true" />
        {t('newOrder')}
      </Link>
      {items.map(({ href, key, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium',
              active ? 'bg-bleu-50 text-bleu-600' : 'text-encre hover:bg-gris-50',
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
