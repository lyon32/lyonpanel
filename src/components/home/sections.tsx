import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { Copy } from './use-copy';
import type { Loc } from './paths';
import { CATALOGUE_TOTAL, NETWORKS } from './networks';
import { CARD, H2, Section, TAG, fmt } from './ui';

const netCount = (id: string) => NETWORKS.find((n) => n.id === id)?.count ?? 0;

// Trois chiffres viennent du catalogue ; clients et commandes sont des textes des messages.
const STAT_VALUES = [CATALOGUE_TOTAL, netCount('instagram'), netCount('tiktok')];

export function Stats({ t, loc }: { t: Copy; loc: Loc }) {
  const tr = useTranslations('home');
  const tile = `e-card e-press flex flex-col rounded-2xl ${CARD} p-5`;
  const big = 'text-3xl font-bold text-[var(--lp-gray-12)] sm:text-4xl';
  return (
    <Section label={t.statsTitle}>
      <dl data-reveal-group className="mx-auto grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-6">
        {STAT_VALUES.map((value, i) => {
          const label = t.statsLabels[i] ?? '';
          return (
            <div key={label} className={`${tile} md:col-span-2`}>
              <dd className={`order-1 ${big} tabular-nums`} data-count={value}>
                {fmt(value, loc)}
              </dd>
              <dt className="order-2 mt-1 text-sm text-[var(--lp-gray-11)]">{label}</dt>
            </div>
          );
        })}
        {[tr('stats.clients'), tr('stats.orders')].map((text) => (
          <div key={text} className={`${tile} justify-center max-md:last:col-span-2 md:col-span-3`}>
            <dt className={big}>{text}</dt>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function Steps({ t }: { t: Copy }) {
  return (
    <Section id="how" label={t.stepsTitle}>
      <div className="mx-auto max-w-5xl">
        <h2 data-reveal className={`${H2} text-center`}>
          {t.stepsTitle}
        </h2>
        <p
          data-reveal
          className="mx-auto mt-3 max-w-md text-center text-base text-[var(--lp-gray-11)]"
        >
          {t.stepsLead}
        </p>
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[22rem_1fr] lg:gap-[3.5rem]">
          <div
            data-reveal
            className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl border border-[var(--lp-gray-6)] lg:aspect-[4/5]"
          >
            <Image
              src="/images/home/homme-selfie-4x5.webp"
              alt={t.howAlt}
              width={1594}
              height={2000}
              sizes="(min-width: 1024px) 352px, 90vw"
              className="h-full w-full object-cover object-[50%_35%]"
            />
          </div>
          <ol data-steps className="relative grid gap-6">
            <span
              aria-hidden="true"
              className="absolute top-5 bottom-5 left-5 w-0.5 bg-[var(--lp-gray-5)]"
            >
              <span data-fill="y" className="block h-full origin-top bg-[var(--lp-accent-9)]" />
            </span>
            {t.steps.map(([title, text, chip], i) => (
              <li
                key={title}
                data-step
                data-slot={`etape-${i + 1}`}
                className="relative pl-[3.5rem]"
              >
                <span
                  data-step-dot
                  className="absolute top-0 left-0 inline-flex size-10 items-center justify-center rounded-full border border-[var(--lp-accent-9)] bg-[var(--lp-accent-6)] text-base font-semibold text-[var(--lp-accent-12)] tabular-nums"
                >
                  {i + 1}
                </span>
                <div
                  className={`e-card e-press group relative overflow-hidden rounded-2xl ${CARD} p-5`}
                >
                  <span className="e-glow" aria-hidden="true" />
                  <p className="relative text-sm text-[var(--lp-accent-11)]">
                    {t.step} {i + 1}
                  </p>
                  <h3 className="relative mt-1 text-lg font-semibold text-[var(--lp-gray-12)]">
                    {title}
                  </h3>
                  <p className="relative mt-2 text-base leading-relaxed text-[var(--lp-gray-11)]">
                    {text}
                  </p>
                  <p className="relative mt-4 inline-flex rounded-full bg-[var(--lp-accent-5)] px-3 py-1 text-sm text-[var(--lp-accent-12)] tabular-nums">
                    {chip}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}
