'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useMotionLevel } from '@/hooks/use-motion-level';

type Step = { id: string; title: string; text: string };
type Props = { title: ReactNode; steps: Step[]; hint: string };

// Étapes épinglées au défilement (GSAP ScrollTrigger, pin + scrub) : une carte à la fois, en 3D légère.
// L'étape 1 arrive seule ; plus bas la 2 arrive pendant que la 1 part ; puis la 3 remplace la 2.
// Sans JavaScript ou en mouvement réduit : les trois étapes restent empilées et lisibles.
// Seuls transform et opacity sont animés. GSAP est chargé à la demande (hors du premier affichage).
export function PinnedSteps({ title, steps, hint }: Props) {
  const level = useMotionLevel();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (level === 'none') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let revert: (() => void) | undefined;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      root.dataset.pinned = 'true';

      const ctx = gsap.context(() => {
        const rich = level === 'rich';
        const cards = gsap.utils.toArray<HTMLElement>('[data-step-card]', root);
        const fills = gsap.utils.toArray<HTMLElement>('[data-step-fill]', root);
        // Téléphone : rotation et profondeur plus faibles, même principe.
        const d = rich ? { rx: 70, z: -280, y: 80 } : { rx: 40, z: -120, y: 40 };
        gsap.set(cards, { opacity: 0, rotateX: -d.rx, z: d.z, y: d.y, scale: 0.92 });
        gsap.set(fills, { scaleX: 0, transformOrigin: 'left center' });

        const tl = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: () => `+=${Math.round(window.innerHeight * (rich ? 3.2 : 2.6))}`,
            pin: true,
            scrub: 0.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        // Chaque étape : entrée sur [2i, 2i+1], pause, sortie sur [2i+2, 2i+3] pendant que la suivante entre.
        cards.forEach((card, i) => {
          const at = i * 2;
          tl.to(card, { opacity: 1, rotateX: 0, z: 0, y: 0, scale: 1, duration: 1 }, at);
          tl.to(fills[i] ?? card, { scaleX: 1, duration: 1 }, at);
          if (i < cards.length - 1) {
            tl.to(
              card,
              {
                opacity: 0,
                rotateX: d.rx,
                z: d.z,
                y: -d.y,
                scale: 0.92,
                duration: 1,
                ease: 'power2.in',
              },
              at + 2,
            );
          }
        });
        tl.to({}, { duration: 1 });
      }, root);

      revert = () => {
        ctx.revert();
        root.dataset.pinned = 'false';
      };
    })();

    return () => {
      cancelled = true;
      revert?.();
    };
  }, [level]);

  return (
    <section ref={rootRef} data-pinned="false" className="group/steps">
      <div className="mx-auto max-w-6xl px-4 py-12 group-data-[pinned=true]/steps:flex group-data-[pinned=true]/steps:min-h-svh group-data-[pinned=true]/steps:flex-col group-data-[pinned=true]/steps:justify-center group-data-[pinned=true]/steps:py-8 md:py-16 md:group-data-[pinned=true]/steps:pt-28">
        {title}
        <ol className="flex flex-col gap-4 [perspective:1100px] group-data-[pinned=true]/steps:relative group-data-[pinned=true]/steps:mx-auto group-data-[pinned=true]/steps:block group-data-[pinned=true]/steps:h-80 group-data-[pinned=true]/steps:w-full group-data-[pinned=true]/steps:max-w-md md:group-data-[pinned=true]/steps:h-96">
          {steps.map((s, i) => (
            <li
              key={s.id}
              data-step-card=""
              className="border-gris-200 bg-blanc flex gap-4 rounded-xl border p-5 will-change-transform [backface-visibility:hidden] group-data-[pinned=true]/steps:absolute group-data-[pinned=true]/steps:inset-0 group-data-[pinned=true]/steps:flex-col group-data-[pinned=true]/steps:items-center group-data-[pinned=true]/steps:justify-center group-data-[pinned=true]/steps:gap-3 group-data-[pinned=true]/steps:p-6 group-data-[pinned=true]/steps:text-center group-data-[pinned=true]/steps:shadow-lg"
            >
              <span className="bg-bleu-600 text-blanc flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold tabular-nums group-data-[pinned=true]/steps:size-20 group-data-[pinned=true]/steps:text-3xl">
                {i + 1}
              </span>
              <div>
                <h3 className="text-encre">{s.title}</h3>
                <p className="text-gris-600 mt-1 text-base">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div
          className="hidden group-data-[pinned=true]/steps:mx-auto group-data-[pinned=true]/steps:mt-6 group-data-[pinned=true]/steps:block group-data-[pinned=true]/steps:w-full group-data-[pinned=true]/steps:max-w-md"
          aria-hidden="true"
        >
          <div className="grid grid-cols-3 gap-2">
            {steps.map((s) => (
              <span key={s.id} className="bg-gris-200 block h-1.5 overflow-hidden rounded-full">
                <span data-step-fill="" className="bg-bleu-600 block h-full w-full" />
              </span>
            ))}
          </div>
          <p className="text-gris-600 mt-3 text-center text-sm">{hint}</p>
        </div>
      </div>
    </section>
  );
}
