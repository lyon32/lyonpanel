import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type MarqueeProps = { items: ReactNode[]; label: string; className?: string };

// Bandeau défilant (inspiré de « Infinite Moving Cards » d'Aceternity). CSS seul : aucun script,
// donc identique sur téléphone. Réduction des animations : la liste reste fixe et se replie sur plusieurs lignes.
export function Marquee({ items, label, className }: MarqueeProps) {
  return (
    <div
      className={cn(
        'lp-marquee overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]',
        className,
      )}
    >
      <ul
        aria-label={label}
        className="lp-marquee-track flex w-max gap-3 py-1 motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center"
      >
        {items.map((item, i) => (
          <li key={i} className="shrink-0">
            {item}
          </li>
        ))}
        {items.map((item, i) => (
          <li key={`copy-${i}`} aria-hidden="true" className="shrink-0 motion-reduce:hidden">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
