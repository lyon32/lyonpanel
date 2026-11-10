import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

interface PaginationProps {
  page: number;
  totalPages: number;
  q: string;
  // Construit l'adresse de la page demandée, en gardant la recherche.
  hrefFor: (query: { page?: number; q?: string }) => React.ComponentProps<typeof Link>['href'];
}

// Pagination par simples liens : pas de JavaScript, la liste se découpe côté serveur.
export async function Pagination({ page, totalPages, q, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;
  const t = await getTranslations('catalog');
  const query = (p: number) => ({ page: p > 1 ? p : undefined, q: q || undefined });
  return (
    <nav aria-label={t('pagination')} className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Button asChild variant="secondary">
          <Link href={hrefFor(query(page - 1))} rel="prev">
            {t('prev')}
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <span className="text-gris-600 text-sm">{t('pageOf', { page, total: totalPages })}</span>
      {page < totalPages ? (
        <Button asChild variant="secondary">
          <Link href={hrefFor(query(page + 1))} rel="next">
            {t('next')}
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
