import type { Ref } from 'react';
import type { Copy } from './use-copy';
import { Arrow, BTN_GHOST, BTN_PRIMARY, CARD, H2 } from './ui';

export function FinalCta({
  t,
  p,
  sectionRef,
}: {
  t: Copy;
  p: Record<string, string>;
  sectionRef: Ref<HTMLElement>;
}) {
  return (
    <section ref={sectionRef} className="px-4 pb-20 sm:pb-24" aria-label={t.ctaTitle}>
      <div
        data-reveal
        className={`relative mx-auto max-w-4xl overflow-hidden rounded-3xl ${CARD} px-6 py-[3.5rem] text-center sm:px-12`}
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background: 'radial-gradient(60% 80% at 50% 0%, var(--lp-accent-6), transparent 75%)',
          }}
        />
        <h2 className={`${H2} relative`}>{t.ctaTitle}</h2>
        <p className="relative mx-auto mt-3 max-w-md text-base text-[var(--lp-gray-11)]">
          {t.ctaText}
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={p.register} className={BTN_PRIMARY}>
            {t.signup}
            <Arrow />
          </a>
          <a href={p.services} className={BTN_GHOST}>
            {t.seeServices}
          </a>
        </div>
      </div>
    </section>
  );
}

export function StickyBar({ t, p, show }: { t: Copy; p: Record<string, string>; show: boolean }) {
  return (
    <div
      data-show={show}
      inert={!show}
      className={`e-bar fixed inset-x-0 bottom-0 z-30 border-t border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)] p-3 md:hidden`}
    >
      <a href={p.register} className={`${BTN_PRIMARY} w-full`}>
        {t.signup}
        <Arrow />
      </a>
    </div>
  );
}
