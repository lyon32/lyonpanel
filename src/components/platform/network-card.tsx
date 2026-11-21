import type { ComponentProps, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent-11)]';

// Logo en masque CSS : gris clair, blanc au survol de la carte. Réseaux sans logo : pastille neutre.
export function PlatformLogo({ network, size = 24 }: { network: string; size?: number }) {
  const id = network === 'web_traffic' ? 'web' : network;
  const url = `url(/brand/networks/${id}.svg)`;
  return (
    <span
      aria-hidden="true"
      className="block bg-[var(--lp-gray-11)] transition-colors duration-200 group-hover:bg-[var(--lp-gray-12)]"
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

interface Props {
  testId: string;
  title: string;
  logo: ReactNode;
  detail: string;
  // Prix « dès » en accent ; absent pour les petits réseaux.
  highlight?: string;
  // Sans lien : carte d'information, non cliquable.
  href?: ComponentProps<typeof Link>['href'];
}

const BOX =
  'flex min-h-20 items-center gap-4 rounded-2xl border border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)] p-4';

export function NetworkCard({ testId, title, logo, detail, highlight, href }: Props) {
  const body = (
    <>
      <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--lp-gray-4)]">
        {logo}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold break-words text-[var(--lp-gray-12)]">{title}</span>
        {highlight ? (
          <span className="block text-sm text-[var(--lp-accent-11)] tabular-nums">{highlight}</span>
        ) : null}
        <span className="block text-sm text-[var(--lp-gray-11)]">{detail}</span>
      </span>
    </>
  );
  if (!href) {
    return (
      <div data-testid={testId} className={BOX}>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`group ${BOX} hover:border-[var(--lp-accent-8)] hover:bg-[var(--lp-gray-3)] active:border-[var(--lp-accent-8)] active:bg-[var(--lp-gray-3)] motion-safe:transition-[transform,background-color,border-color] motion-safe:duration-200 motion-safe:ease-out motion-safe:active:scale-[0.98] motion-safe:md:hover:-translate-y-0.5 ${FOCUS}`}
    >
      {body}
      <svg
        width="18"
        height="18"
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="shrink-0 text-[var(--lp-gray-11)] group-hover:text-[var(--lp-accent-11)]"
      >
        <path
          d="M3 8h9M8.5 4l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </Link>
  );
}
