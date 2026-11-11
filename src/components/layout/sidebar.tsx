'use client';

import {
  CircleUser,
  Gift,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  ListOrdered,
  Plus,
  Receipt,
  Store,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

const items = [
  { href: '/dashboard', key: 'dashboard', Icon: LayoutDashboard },
  { href: '/orders', key: 'orders', Icon: ListOrdered },
  { href: '/transactions', key: 'transactions', Icon: Receipt },
  { href: '/favorites', key: 'favorites', Icon: Heart },
  { href: '/services', key: 'services', Icon: Store },
  { href: '/add-funds', key: 'addFunds', Icon: Wallet },
  { href: '/referral', key: 'referral', Icon: Gift },
  { href: '/tickets', key: 'support', Icon: LifeBuoy },
  { href: '/account', key: 'account', Icon: CircleUser },
] as const;

// Visible à partir de md ; en dessous, la barre du bas prend le relais.
export function Sidebar({ name, email }: { name?: string; email?: string } = {}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('appLabel')}
      className="border-gris-200 bg-blanc hidden w-64 shrink-0 flex-col gap-1 border-r p-4 md:flex"
    >
      {email ? (
        <div className="mb-3 flex min-w-0 items-center gap-3 px-1">
          <Avatar size="lg">
            <AvatarFallback className="bg-bleu-50 text-bleu-600 text-sm font-semibold uppercase">
              {(name ?? email).slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {name ? <p className="text-encre truncate text-sm font-semibold">{name}</p> : null}
            <p className="text-gris-600 truncate text-xs">{email}</p>
          </div>
        </div>
      ) : null}
      <Link
        href="/order"
        className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 mb-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold whitespace-nowrap focus-visible:ring-4"
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
