'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tab = { id: string; title: string; text: string; icon: ReactNode; extra?: ReactNode };

// Onglets : à gauche (ordinateur) ou en grille 2 x 2 (téléphone) les quatre atouts, à droite le détail.
// Flèches du clavier pour changer d'onglet. Le panneau change par fondu + léger décalage (transform/opacité).
export function FeatureTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const current = tabs[active] ?? tabs[0];

  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (active + step + tabs.length) % tabs.length;
    setActive(next);
    buttons.current[next]?.focus();
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKey}
        className="grid grid-cols-2 gap-2 md:grid-cols-1"
      >
        {tabs.map((tab, i) => {
          const on = i === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={on}
              aria-controls={on ? `panel-${tab.id}` : undefined}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={cn(
                'focus-visible:ring-bleu-100 flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left text-base font-semibold transition-[background-color,border-color,transform] duration-150 ease-out outline-none focus-visible:ring-4 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100',
                on
                  ? 'border-bleu-600 bg-bleu-600 text-blanc'
                  : 'border-gris-200 bg-blanc text-encre hover:border-bleu-100 hover:bg-bleu-50',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg',
                  on ? 'bg-blanc/15 text-blanc' : 'bg-bleu-50 text-bleu-600',
                )}
              >
                {tab.icon}
              </span>
              <span className="text-balance">{tab.title}</span>
            </button>
          );
        })}
      </div>
      <div
        key={current?.id}
        role="tabpanel"
        id={`panel-${current?.id}`}
        aria-labelledby={`tab-${current?.id}`}
        className="border-gris-200 bg-gris-50 flex animate-[lp-step-in_250ms_ease-out] flex-col justify-center rounded-xl border p-5 motion-reduce:animate-none md:min-h-72 md:p-8"
      >
        <span className="bg-bleu-50 text-bleu-600 mb-4 flex size-14 items-center justify-center rounded-xl">
          {current?.icon}
        </span>
        <h3 className="text-encre">{current?.title}</h3>
        <p className="text-gris-600 mt-2 max-w-md text-base">{current?.text}</p>
        {current?.extra ? <div className="mt-5">{current.extra}</div> : null}
      </div>
    </div>
  );
}
