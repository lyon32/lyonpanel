import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const links = [
  { href: '/privacy', key: 'privacy' },
  { href: '/terms', key: 'terms' },
  { href: '/tickets', key: 'contact' },
] as const;

export function SiteFooter() {
  const t = useTranslations('footer');
  return (
    <footer className="border-gris-200 bg-blanc border-t">
      <nav aria-label={t('label')} className="mx-auto flex max-w-6xl flex-wrap gap-x-2 px-4 py-4">
        {links.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            className="text-gris-600 hover:text-encre flex min-h-11 items-center px-2 text-sm"
          >
            {t(l.key)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
