import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

interface CardLinkProps {
  href: React.ComponentProps<typeof Link>['href'];
  testId: string;
  title: string;
  detail: string;
  icon?: ReactNode;
}

// Carte entièrement cliquable, utilisée pour les réseaux et les types.
export function CardLink({ href, testId, title, detail, icon }: CardLinkProps) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="group focus-visible:ring-bleu-100 block rounded-xl outline-none focus-visible:ring-4"
    >
      <Card className="group-hover:border-bleu-600 flex min-h-16 items-center gap-3 p-4 transition-colors duration-150 ease-out">
        {icon}
        <span className="min-w-0 flex-1">
          <span className="text-encre block font-bold break-words">{title}</span>
          <span className="text-gris-600 block text-sm">{detail}</span>
        </span>
        <ChevronRight size={18} aria-hidden="true" className="text-gris-600 shrink-0" />
      </Card>
    </Link>
  );
}
