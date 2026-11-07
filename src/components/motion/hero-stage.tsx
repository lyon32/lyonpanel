'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useMotionLevel } from '@/hooks/use-motion-level';

// Héros réactif (ordinateur, niveau « rich ») : des points bleus s'allument sous le curseur et la maquette
// s'incline vers lui (GSAP, chargé à la demande). Téléphone, économie ou mouvement réduit : rien ne bouge.
// Les points et l'inclinaison n'utilisent que transform et un masque ; aucun prix n'est animé.
export function HeroStage({ children }: { children: ReactNode }) {
  const level = useMotionLevel();
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (level !== 'rich') return;
    const root = rootRef.current;
    const glow = glowRef.current;
    if (!root || !glow) return;
    let cancelled = false;
    let off: (() => void) | undefined;

    void import('gsap').then(({ gsap }) => {
      if (cancelled) return;
      const tilt = root.querySelector<HTMLElement>('[data-tilt]');
      const rx = tilt
        ? gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3.out' })
        : null;
      const ry = tilt
        ? gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3.out' })
        : null;
      if (tilt) gsap.set(tilt, { transformPerspective: 1200 });

      const move = (e: PointerEvent) => {
        const box = root.getBoundingClientRect();
        const x = e.clientX - box.left;
        const y = e.clientY - box.top;
        glow.style.setProperty('--mx', `${x}px`);
        glow.style.setProperty('--my', `${y}px`);
        glow.style.opacity = '1';
        // Inclinaison de 4 degrés au plus.
        ry?.((x / box.width - 0.5) * 8);
        rx?.(-(y / box.height - 0.5) * 6);
      };
      const leave = () => {
        glow.style.opacity = '0';
        rx?.(0);
        ry?.(0);
      };
      root.addEventListener('pointermove', move);
      root.addEventListener('pointerleave', leave);
      off = () => {
        root.removeEventListener('pointermove', move);
        root.removeEventListener('pointerleave', leave);
        if (tilt) gsap.set(tilt, { clearProps: 'transform' });
        glow.style.opacity = '0';
      };
    });

    return () => {
      cancelled = true;
      off?.();
    };
  }, [level]);

  return (
    <div ref={rootRef} className="relative">
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--bleu-600)_1.4px,transparent_1.4px)] [mask-image:radial-gradient(circle_160px_at_var(--mx,50%)_var(--my,50%),#000,transparent)] [background-size:16px_16px] opacity-0 transition-opacity duration-300"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
