import Image from 'next/image';
import type { Copy } from './use-copy';
import type { Loc } from './paths';
import { MAIN_NETWORKS, MORE_NAMES, OTHER_NETWORKS, type Net } from './networks';
import { Arrow, BTN_GHOST, FOCUS, H2, NetLogo, Section, fmt } from './ui';

const TILE =
  'e-tile e-card e-press e-logo-host group relative overflow-hidden rounded-2xl border border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)]';
const LINK = `relative flex min-h-11 flex-col gap-3 rounded-2xl p-5 ${FOCUS}`;
const ICON_BOX = 'inline-flex size-12 items-center justify-center rounded-xl bg-[var(--lp-gray-4)]';

function Head({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center justify-between">
      <span className={ICON_BOX}>{children}</span>
      <span className="text-[var(--lp-gray-11)] group-hover:text-[var(--lp-accent-11)]">
        <Arrow />
      </span>
    </span>
  );
}

type Props = { t: Copy; loc: Loc; p: Record<string, string> };

// Chaque tuile mène à la page réelle du réseau (/services/<réseau>).
function Tile({
  n,
  t,
  loc,
  p,
  big,
  span3 = false,
}: Props & { n: Net; big: boolean; span3?: boolean }) {
  const types = n.types.map((k) => t.typeLabels[k]).join(', ');
  return (
    <li
      data-slot={`tuile-${n.id}`}
      className={`${TILE} ${big ? (span3 ? 'lg:col-span-3' : 'lg:col-span-2') : ''}`}
    >
      <span className="e-glow" aria-hidden="true" />
      <a href={`${p.services}/${n.id}`} className={LINK}>
        <Head>
          <NetLogo id={n.id} size={big ? 28 : 24} />
        </Head>
        <span className="text-lg font-semibold text-[var(--lp-gray-12)]">{n.name}</span>
        <span className="text-sm text-[var(--lp-accent-11)] tabular-nums">
          {fmt(n.count, loc)} {t.servicesUnit}
        </span>
        <span className="text-sm text-[var(--lp-gray-11)]">{types}</span>
      </a>
    </li>
  );
}

export function Services({ t, loc, p }: Props) {
  return (
    <Section id="services" label={t.servicesTitle}>
      <div
        data-slot="fond-section"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-60"
        aria-hidden="true"
        style={{
          maskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
          WebkitMaskImage: 'linear-gradient(transparent, #000 18%, #000 82%, transparent)',
        }}
      >
        <Image
          src="/images/home/fond-points-16x9.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="relative mx-auto max-w-5xl">
        <h2 data-reveal className={`${H2} text-center`}>
          {t.servicesTitle}
        </h2>
        <p
          data-reveal
          className="mx-auto mt-3 max-w-md text-center text-base text-[var(--lp-gray-11)]"
        >
          {t.servicesLead}
        </p>
        <ul
          data-reveal-group
          className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          {MAIN_NETWORKS.map((n, i) => (
            <Tile key={n.id} n={n} t={t} loc={loc} p={p} big span3={i >= 3} />
          ))}
        </ul>
        <ul data-reveal-group className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OTHER_NETWORKS.map((n) => (
            <Tile key={n.id} n={n} t={t} loc={loc} p={p} big={false} />
          ))}
          <li data-slot="tuile-plus" className={TILE}>
            <span className="e-glow" aria-hidden="true" />
            <a href={p.services} className={LINK}>
              <Head>
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    fill="none"
                    stroke="var(--lp-gray-12)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </Head>
              <span className="text-lg font-semibold text-[var(--lp-gray-12)]">{t.moreTitle}</span>
              <span className="text-sm text-[var(--lp-gray-11)]">{MORE_NAMES}</span>
            </a>
          </li>
        </ul>
        <div data-reveal className="mt-8 text-center">
          <a href={p.services} className={BTN_GHOST}>
            {t.seeServices}
            <Arrow />
          </a>
        </div>
      </div>
    </Section>
  );
}
