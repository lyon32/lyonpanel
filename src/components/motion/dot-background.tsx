import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type DotBackgroundProps = { children?: ReactNode; className?: string };

// Points fixes en CSS : aucun canvas, aucun script, même rendu sur tous les appareils
// (le « dot-field » de Kokonut UI fait 745 lignes de physique canvas : refusé, voir compte-rendu).
export function DotBackground({ children, className }: DotBackgroundProps) {
  return (
    <div className={cn('bg-blanc relative w-full overflow-hidden', className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--bleu-100)_1.2px,transparent_1.2px)] [mask-image:radial-gradient(ellipse_75%_70%_at_50%_50%,#000_40%,transparent_100%)] [background-size:16px_16px]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
