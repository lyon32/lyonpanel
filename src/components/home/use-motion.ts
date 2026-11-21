'use client';

import { useEffect, type RefObject } from 'react';

// Animations de l'accueil E : transform et opacité seulement.
// Mouvement réduit : rien n'est animé, le contenu est déjà à son état final.
export function useMotion(root: RefObject<HTMLElement | null>, locale: string) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = root.current;
    if (!el) return;
    let cancelled = false;
    let revert: (() => void) | undefined;
    const fmt = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US');

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        // Héros en cascade
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('[data-hero]', {
          y: 24,
          opacity: 0,
          duration: 0.7,
          stagger: 0.09,
          clearProps: 'transform,opacity,transition',
          transition: 'none',
        });

        // Compteurs
        gsap.utils.toArray<HTMLElement>('[data-count]').forEach((node) => {
          const end = Number(node.dataset.count);
          const prefix = node.dataset.prefix ?? '';
          const finalText = node.textContent ?? '';
          const state = { v: 0 };
          node.textContent = `${prefix}0`;
          gsap.to(state, {
            v: end,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: () => {
              node.textContent = `${prefix}${fmt.format(Math.round(state.v))}`;
            },
            onComplete: () => {
              node.textContent = finalText;
            },
            scrollTrigger: { trigger: node, start: 'top 92%', once: true },
          });
        });

        // Apparition au défilement
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((node) => {
          gsap.from(node, {
            y: 28,
            clearProps: 'transform,opacity,transition',
            transition: 'none',
            opacity: 0,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: { trigger: node, start: 'top 90%', once: true },
          });
        });
        gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
          gsap.from(group.children, {
            y: 28,
            clearProps: 'transform,opacity,transition',
            transition: 'none',
            opacity: 0,
            duration: 0.7,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: group, start: 'top 88%', once: true },
          });
        });

        // Trait des étapes
        const steps = el.querySelector<HTMLElement>('[data-steps]');
        if (steps) {
          const fills = steps.querySelectorAll<HTMLElement>('[data-fill]');
          fills.forEach((f) => {
            const horizontal = f.dataset.fill === 'x';
            gsap.fromTo(f, horizontal ? { scaleX: 0 } : { scaleY: 0 }, {
              ...(horizontal ? { scaleX: 1 } : { scaleY: 1 }),
              ease: 'none',
              scrollTrigger: { trigger: steps, start: 'top 70%', end: 'bottom 70%', scrub: 0.4 },
            });
          });
          gsap.utils.toArray<HTMLElement>('[data-step]').forEach((s) => {
            gsap.from(s, {
              y: 32,
              clearProps: 'transform,opacity,transition',
              transition: 'none',
              opacity: 0,
              duration: 0.7,
              ease: 'power3.out',
              scrollTrigger: { trigger: s, start: 'top 85%', once: true },
            });
            gsap.from(s.querySelector('[data-step-dot]'), {
              scale: 0.4,
              clearProps: 'transform',
              duration: 0.5,
              ease: 'back.out(2)',
              scrollTrigger: { trigger: s, start: 'top 85%', once: true },
            });
          });
        }
      }, el);
      revert = () => ctx.revert();
    })();

    return () => {
      cancelled = true;
      revert?.();
    };
  }, [root, locale]);
}
