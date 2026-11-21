'use client';

import { useState } from 'react';
import { CARD, FOCUS, I_PLUS, Icon } from './ui';

export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mx-auto mt-10 max-w-2xl space-y-3" data-reveal-group>
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div
            key={q}
            className={`rounded-2xl ${CARD} transition-colors duration-200 ${isOpen ? 'border-[var(--lp-gray-8)]' : ''}`}
          >
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`e-faq-${i}`}
                id={`e-faq-btn-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
                className={`flex min-h-[3.5rem] w-full items-center justify-between gap-4 rounded-2xl px-5 py-3 text-left text-base font-medium text-[var(--lp-gray-12)] ${FOCUS}`}
              >
                {q}
                <span
                  className={`e-plus shrink-0 text-[var(--lp-accent-11)] ${isOpen ? 'e-plus-open' : ''}`}
                >
                  <Icon d={I_PLUS} />
                </span>
              </button>
            </h3>
            <div
              id={`e-faq-${i}`}
              role="region"
              aria-labelledby={`e-faq-btn-${i}`}
              className={`e-acc ${isOpen ? 'e-acc-open' : ''}`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-base leading-relaxed text-[var(--lp-gray-11)]">{a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
