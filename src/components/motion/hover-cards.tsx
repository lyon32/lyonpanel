'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type HoverCardsProps = { items: { id: string; content: ReactNode }[]; className?: string };

// Surbrillance qui glisse d'une carte à l'autre (inspiré de « Card Hover Effect » d'Aceternity).
// Un seul bloc déplacé par transform + opacité. Au toucher, seul l'appui change l'apparence de la carte.
export function HoverCards({ items, className }: HoverCardsProps) {
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const show = (el: HTMLElement) => {
    setBox({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  };

  return (
    <ul
      onPointerLeave={() => setBox(null)}
      onBlur={() => setBox(null)}
      className={cn('relative grid gap-4 sm:grid-cols-3', className)}
    >
      <li
        aria-hidden="true"
        className="bg-bleu-50 pointer-events-none absolute top-0 left-0 hidden rounded-xl transition-[transform,opacity,width,height] duration-200 ease-out motion-reduce:transition-none sm:block"
        style={{
          width: box?.w ?? 0,
          height: box?.h ?? 0,
          opacity: box ? 1 : 0,
          transform: `translate(${box?.x ?? 0}px, ${box?.y ?? 0}px)`,
        }}
      />
      {items.map((item) => (
        <li
          key={item.id}
          tabIndex={0}
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') show(e.currentTarget);
          }}
          onFocus={(e) => show(e.currentTarget)}
          className="border-gris-200 focus-visible:ring-bleu-100 relative rounded-xl border p-6 transition-transform duration-150 ease-out outline-none focus-visible:ring-4 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          {item.content}
        </li>
      ))}
    </ul>
  );
}
