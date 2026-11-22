'use client';

// Accueil : sombre, palette .lp-app (docs/05 §11-12). L'en-tête et le pied de page viennent du layout public.
import { useEffect, useRef, useState } from 'react';
import { FinalCta, StickyBar } from './closing';
import { Faq } from './faq';
import { Hero } from './hero';
import { PATHS, type Loc } from './paths';
import { Payments } from './payments';
import { Stats, Steps } from './sections';
import { Services } from './services';
import { EStyles } from './styles';
import { H2, Section } from './ui';
import { useCopy } from './use-copy';
import { useMotion } from './use-motion';

export function Home({ loc }: { loc: Loc }) {
  const t = useCopy();
  const p = PATHS[loc];
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLElement>(null);
  const [heroSeen, setHeroSeen] = useState(true);
  const [endSeen, setEndSeen] = useState(false);

  useMotion(rootRef, loc);

  // Bouton fixe mobile : visible quand le héros est passé et avant l'appel final
  useEffect(() => {
    const hero = heroRef.current;
    const end = endRef.current;
    if (!hero || !end) return;
    const o1 = new IntersectionObserver(([e]) => setHeroSeen(e?.isIntersecting ?? true));
    const o2 = new IntersectionObserver(([e]) => setEndSeen(e?.isIntersecting ?? false));
    o1.observe(hero);
    o2.observe(end);
    return () => {
      o1.disconnect();
      o2.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className="lp-app overflow-x-clip">
      <EStyles />
      <Hero t={t} p={p} sectionRef={heroRef} />
      <Stats t={t} loc={loc} />
      <Steps t={t} />
      <Services t={t} loc={loc} p={p} />
      <Payments t={t} />
      <Section id="faq" label={t.faqTitle}>
        <h2 data-reveal className={`${H2} text-center`}>
          {t.faqTitle}
        </h2>
        <Faq items={t.faq} />
      </Section>
      <FinalCta t={t} p={p} sectionRef={endRef} />
      <StickyBar t={t} p={p} show={!heroSeen && !endSeen} />
    </div>
  );
}
