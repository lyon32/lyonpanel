import { ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export interface Crumb {
  label: string;
  href?: React.ComponentProps<typeof Link>['href'];
}

// Fil d'Ariane : le dernier élément est la page courante, sans lien.
export async function Breadcrumb({ items }: { items: Crumb[] }) {
  const t = await getTranslations('catalog');
  return (
    <nav aria-label={t('breadcrumb')} className="text-gris-600 mb-4 text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
            {item.href ? (
              <Link href={item.href} className="text-bleu-600 underline-offset-2 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
