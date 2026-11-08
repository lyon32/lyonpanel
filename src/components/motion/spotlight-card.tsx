'use client';

import { useRef, type ReactNode } from 'react';
import { useMotionLevel } from '@/hooks/use-motion-level';
import { cn } from '@/lib/cn';

type SpotlightCardProps = { children: ReactNode; className?: string };

// Carte qui réagit : relief au survol (tous niveaux) et halo bleu clair qui suit le curseur
// (ordinateur seulement). Le halo est un disque uni déplacé par transform : pas de dégradé, pas de re-rendu.
export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const level = useMotionLevel();
  const halo = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (level !== 'rich' || e.pointerType !== 'mouse' || !halo.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    halo.current.style.transform = `translate(${e.clientX - box.left - 112}px, ${e.clientY - box.top - 112}px)`;
  };

  return (
    <div
      onPointerMove={onMove}
      className={cn(
        'group/spot border-gris-200 bg-blanc relative overflow-hidden rounded-xl border p-6 shadow-sm',
        'transition-[transform,box-shadow,border-color] duration-200 ease-out motion-reduce:transition-none',
        'hover:border-bleu-100 hover:-translate-y-1 hover:shadow-md motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      {level === 'rich' ? (
        <span
          ref={halo}
          aria-hidden="true"
          className="bg-bleu-50 pointer-events-none absolute top-0 left-0 size-56 rounded-full opacity-0 transition-opacity duration-200 group-hover/spot:opacity-100"
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}
