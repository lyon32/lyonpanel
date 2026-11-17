'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavLink = { href: string; label: string };

// Menu de l'admin : l'écran ouvert est repéré par couleur ET par aria-current.
export function AdminNav({ links, label }: { links: NavLink[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'bg-bleu-50 text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4'
                : 'text-gris-600 hover:bg-gris-50 hover:text-encre focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4'
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
