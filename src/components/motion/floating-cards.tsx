'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useMotionLevel } from '@/hooks/use-motion-level';
import { cn } from '@/lib/cn';

type FloatingCardsProps = {
  cards: { id: string; content: ReactNode }[];
  className?: string;
};

// light : 3 cartes, entrée décalée, aucun suivi de souris. rich : parallaxe de 8 px max. none : statique.
export function FloatingCards({ cards, className }: FloatingCardsProps) {
  const level = useMotionLevel();
  const rootRef = useRef<HTMLDivElement>(null);
  const shown = level === 'light' ? cards.slice(0, 3) : cards;

  useEffect(() => {
    if (level !== 'rich') return;
    const root = rootRef.current;
    if (!root) return;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 16;
      const y = (e.clientY / window.innerHeight - 0.5) * 16;
      root.style.setProperty('--px', `${x}px`);
      root.style.setProperty('--py', `${y}px`);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [level]);

  return (
    <div ref={rootRef} className={cn('grid gap-4', className)}>
      {shown.map((card, i) =>
        level === 'none' ? (
          <div key={card.id} data-floating-card>
            {card.content}
          </div>
        ) : (
          <motion.div
            key={card.id}
            data-floating-card
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
          >
            <div style={level === 'rich' ? { translate: 'var(--px, 0) var(--py, 0)' } : undefined}>
              {card.content}
            </div>
          </motion.div>
        ),
      )}
    </div>
  );
}
