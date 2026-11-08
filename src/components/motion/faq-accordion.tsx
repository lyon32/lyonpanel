'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

type FaqAccordionProps = { items: { q: string; a: string }[]; className?: string };

// Questions fréquentes (inspiré des accordéons Aceternity). Une réponse ouverte à la fois ;
// ouverture par grid-rows (0fr vers 1fr) avec fondu, chevron qui pivote, 200 ms.
export function FaqAccordion({ items, className }: FaqAccordionProps) {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <li
            key={item.q}
            className={cn(
              'bg-blanc rounded-xl border transition-colors duration-200',
              isOpen ? 'border-bleu-100' : 'border-gris-200 hover:border-bleu-100',
            )}
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${base}-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className="text-encre focus-visible:ring-bleu-100 active:bg-gris-50 flex min-h-12 w-full items-center justify-between gap-4 rounded-xl px-5 py-3 text-left text-base font-semibold outline-none focus-visible:ring-4"
              >
                {item.q}
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                  className={cn(
                    'text-bleu-600 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
            </h3>
            <div
              id={`${base}-${i}`}
              role="region"
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <p className="text-gris-600 px-5 pb-4 text-base">{item.a}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
