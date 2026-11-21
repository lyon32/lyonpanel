import { getImageProps } from 'next/image';
import type { Ref } from 'react';
import type { Copy } from './use-copy';
import { NETWORKS } from './networks';
import { Arrow, BTN_GHOST, BTN_PRIMARY, CARD, NetLogo } from './ui';

// Photo du héros : portrait sur téléphone, paysage dès 1024 px (une seule image chargée).
function HeroPhoto({ alt }: { alt: string }) {
  const common = { alt, priority: true, quality: 80 };
  const wide = getImageProps({
    ...common,
    src: '/images/home/femme-16x9.webp',
    width: 2000,
    height: 1123,
    sizes: '100vw',
  });
  const tall = getImageProps({
    ...common,
    src: '/images/home/femme-tresses-4x5.webp',
    width: 1594,
    height: 2000,
    sizes: '(min-width: 1024px) 0px, 92vw',
  });
  return (
    <picture>
      <source media="(min-width: 1024px)" srcSet={wide.props.srcSet} sizes="100vw" />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt fourni via tall.props */}
      <img
        {...tall.props}
        className="h-full w-full object-cover object-[50%_28%] lg:object-[85%_30%]"
      />
    </picture>
  );
}

export function Hero({
  t,
  p,
  sectionRef,
}: {
  t: Copy;
  p: Record<string, string>;
  sectionRef: Ref<HTMLElement>;
}) {
  // Le mot mis en couleur est repéré dans le titre traduit.
  const [before = '', after = ''] = t.title.split(t.accent);
  return (
    <section ref={sectionRef} className="relative pb-16">
      <div className="relative lg:flex lg:min-h-[40rem] lg:items-center">
        <div
          data-slot="hero-photo"
          className="relative mx-4 mt-6 aspect-[4/5] max-h-[24rem] overflow-hidden rounded-3xl border border-[var(--lp-gray-6)] lg:absolute lg:inset-0 lg:m-0 lg:aspect-auto lg:max-h-none lg:rounded-none lg:border-0"
        >
          <HeroPhoto alt={t.heroAlt} />
          <div
            className="pointer-events-none absolute inset-0 hidden lg:block"
            aria-hidden="true"
            style={{
              background:
                'linear-gradient(90deg, rgb(17 17 17 / .92) 0%, rgb(17 17 17 / .75) 38%, transparent 62%)',
            }}
          />
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-8 lg:py-24">
          <div className="max-w-xl">
            <p
              data-hero
              className={`inline-flex rounded-full ${CARD} px-4 py-1.5 text-sm text-[var(--lp-gray-12)]`}
            >
              {t.badge}
            </p>
            <h1
              data-hero
              className="mt-5 text-[2.5rem] leading-[1.1] font-bold tracking-tight text-balance text-[var(--lp-gray-12)] sm:text-5xl lg:text-[3.75rem]"
            >
              {before}
              <span className="text-[var(--lp-accent-11)]">{t.accent}</span>
              {after}
            </h1>
            <p
              data-hero
              className="mt-5 text-base leading-relaxed text-[var(--lp-gray-12)] sm:text-lg lg:text-[var(--lp-gray-12)]"
            >
              {t.sub}
            </p>
            <div data-hero className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={p.register} className={BTN_PRIMARY}>
                {t.signup}
                <Arrow />
              </a>
              <a href="#how" className={`${BTN_GHOST} bg-[var(--lp-gray-1)]/60`}>
                {t.how}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div data-hero className="relative mx-auto mt-[3.5rem] max-w-4xl px-4 text-center">
        <p className="text-sm text-[var(--lp-gray-11)]">{t.networksTitle}</p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {NETWORKS.map((n) => (
            <li
              key={n.id}
              data-slot={`logo-${n.id}`}
              className={`e-card e-logo-host inline-flex min-h-11 items-center gap-2 rounded-full ${CARD} px-4 py-1 text-sm text-[var(--lp-gray-12)]`}
            >
              <NetLogo id={n.id} size={20} />
              {n.name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
