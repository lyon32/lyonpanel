'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

type WordRevealProps = { text: string; as?: 'h2' | 'h3'; className?: string };

// Les mots d'un titre apparaissent l'un après l'autre quand il entre à l'écran (inspiré de « Text Generate Effect »).
// Opacité + léger décalage seulement ; en mode « réduire les animations », le texte est affiché tel quel.
export function WordReveal({ text, as: Tag = 'h2', className }: WordRevealProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} aria-label={text} className={className}>
      {text.split(' ').map((word, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{ transitionDelay: seen ? `${i * 70}ms` : '0ms' }}
          className={cn(
            'inline-block transition-[opacity,transform] duration-300 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none',
            seen ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          {word}
          {' '}
        </span>
      ))}
    </Tag>
  );
}
