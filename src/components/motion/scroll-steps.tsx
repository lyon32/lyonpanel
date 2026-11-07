'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Step = { id: string; title: string; text: string; icon: ReactNode };

// Étapes qui s'allument au défilement (inspiré de « Sticky Scroll Reveal » d'Aceternity).
// Ordinateur : la liste défile à gauche, l'étape active s'affiche en grand dans un panneau fixe à droite.
// Téléphone : simple liste, l'étape au centre de l'écran passe en bleu.
export function ScrollSteps({ steps, className }: { steps: Step[]; className?: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const current = steps[active] ?? steps[0];

  return (
    <div className={cn('grid gap-8 md:grid-cols-2 md:gap-12', className)}>
      <ol className="flex flex-col gap-4 md:gap-0">
        {steps.map((s, i) => (
          <li
            key={s.id}
            data-index={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={cn(
              'flex gap-4 rounded-xl border p-5 transition-[opacity,border-color,background-color] duration-300 ease-out motion-reduce:transition-none md:min-h-52 md:items-center md:border-transparent',
              i === active
                ? 'border-bleu-100 bg-bleu-50 md:bg-transparent'
                : 'border-gris-200 bg-blanc md:opacity-40',
            )}
          >
            <span
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums transition-colors duration-300',
                i === active ? 'bg-bleu-600 text-blanc' : 'bg-gris-50 text-gris-600',
              )}
            >
              {i + 1}
            </span>
            <div>
              <h3 className="text-encre">{s.title}</h3>
              <p className="text-gris-600 mt-1 text-base">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="hidden md:block" aria-hidden="true">
        <div className="sticky top-28 flex h-72 items-center justify-center">
          <div
            key={current?.id}
            className="border-gris-200 bg-blanc flex size-64 animate-[lp-step-in_300ms_ease-out] flex-col items-center justify-center gap-4 rounded-xl border p-6 text-center shadow-sm motion-reduce:animate-none"
          >
            <span className="bg-bleu-50 text-bleu-600 flex size-16 items-center justify-center rounded-xl">
              {current?.icon}
            </span>
            <p className="text-encre text-lg font-bold">{current?.title}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
