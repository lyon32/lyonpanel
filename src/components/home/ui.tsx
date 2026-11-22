import type { ReactNode } from 'react';
import type { Loc } from './paths';

export const BORDER = 'border border-[var(--lp-gray-6)]';
export const CARD = `${BORDER} bg-[var(--lp-gray-2)]`;
export const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent-11)]';
export const BTN_PRIMARY = `e-press inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--lp-accent-9)] px-7 text-base font-medium text-white transition-colors duration-200 hover:bg-[var(--lp-accent-10)] active:bg-[var(--lp-app-accent-hover)] ${FOCUS}`;
export const BTN_GHOST = `e-press inline-flex min-h-12 items-center justify-center gap-2 rounded-full ${BORDER} bg-transparent px-7 text-base font-medium text-[var(--lp-gray-12)] transition-colors duration-200 hover:border-[var(--lp-gray-9)] hover:bg-[var(--lp-gray-3)] ${FOCUS}`;
export const TAG =
  'rounded-full bg-[var(--lp-accent-6)] px-2 py-0.5 text-xs text-[var(--lp-accent-12)]';
export const H2 = 'text-3xl font-bold text-balance text-[var(--lp-gray-12)] sm:text-4xl';

// Logo de réseau (simple-icons, une couleur) : gris clair, blanc au survol de la carte ou du lien.
export function NetLogo({ id, size = 24 }: { id: string; size?: number }) {
  const url = `url(/brand/networks/${id}.svg)`;
  return (
    <span
      aria-hidden="true"
      data-logo={id}
      className="e-logo inline-block shrink-0"
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
      }}
    />
  );
}

export function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" className="e-arrow">
      <path
        d="M3 8h9M8.5 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export const I_PLUS = 'M12 5v14M5 12h14';

export function fmt(n: number, loc: Loc) {
  return new Intl.NumberFormat(loc === 'fr' ? 'fr-FR' : 'en-US').format(n);
}

export function Section({
  id,
  children,
  label,
}: {
  id?: string;
  children: ReactNode;
  label: string;
}) {
  return (
    <section id={id} aria-label={label} className="relative scroll-mt-24 px-4 py-16 sm:py-20">
      {children}
    </section>
  );
}
