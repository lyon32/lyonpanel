import Image from 'next/image';
import { useState, type CSSProperties } from 'react';
import { PAYMENTS } from './payment-methods';
import type { Copy } from './use-copy';
import { H2, Section } from './ui';

type Pay = (typeof PAYMENTS)[number];

// Logo officiel (PNG, non recoloré). Repli sur le nom en texte seulement si l'image ne charge pas.
const SHAPE = { round: 'rounded-full', square: 'rounded-xl', free: '' } as const;

function PayPill({ m, i }: { m: Pay; i: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="e-float"
      style={{ animationDelay: `${-i * 0.9}s`, animationDuration: `${5 + (i % 3)}s` }}
    >
      <div
        className="e-pay relative flex size-[5.25rem] items-center justify-center rounded-3xl border border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)] p-3 text-center text-sm leading-tight font-semibold text-[var(--lp-gray-12)] sm:size-24"
        style={{ '--glow': m.glow } as CSSProperties}
        onTouchStart={() => {}}
      >
        <span
          aria-hidden="true"
          className="e-halo pointer-events-none absolute -inset-3 rounded-full blur-xl"
          style={{ background: 'radial-gradient(closest-side, var(--glow), transparent)' }}
        />
        <span className="absolute inset-0 rounded-3xl bg-[var(--lp-gray-2)]" aria-hidden="true" />
        {failed ? (
          <span className="relative">{m.name}</span>
        ) : (
          <Image
            src={`/brand/payments/${m.file}`}
            alt={m.name}
            width={96}
            height={96}
            unoptimized
            sizes="96px"
            onError={() => setFailed(true)}
            className={`relative size-full object-contain ${SHAPE[m.shape]} ${m.id === 'visa' ? 'rounded-lg bg-[var(--lp-gray-12)] p-1.5' : ''}`}
          />
        )}
      </div>
    </div>
  );
}

// Pastilles autour du logo central. Logo officiel si le fichier existe, sinon le nom en texte.
export function Payments({ t }: { t: Copy }) {
  const n = PAYMENTS.length;
  return (
    <Section id="paiements" label={t.payTitle}>
      <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div
          data-slot="visuel-paiements"
          data-reveal
          className="relative mx-auto aspect-square w-full max-w-[26rem]"
        >
          <span
            aria-hidden="true"
            className="absolute inset-[8%] rounded-full border border-dashed border-[var(--lp-gray-5)]"
          />
          <span
            aria-hidden="true"
            className="absolute inset-[30%] rounded-full bg-[var(--lp-accent-4)] blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/02-icone.svg"
            alt={t.payLogoAlt}
            width={120}
            height={120}
            className="absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 sm:size-28"
          />
          {PAYMENTS.map((m, i) => {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            const left = 50 + 38 * Math.cos(angle);
            const top = 50 + 38 * Math.sin(angle);
            return (
              <div
                key={m.id}
                data-pay={m.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                <PayPill m={m} i={i} />
              </div>
            );
          })}
        </div>
        <div>
          <h2 data-reveal className={H2}>
            {t.payTitle}
          </h2>
          <p data-reveal className="mt-4 text-base leading-relaxed text-[var(--lp-gray-11)]">
            {t.payLead} {t.payText}
          </p>
          <p
            data-reveal
            className="mt-6 flex gap-3 rounded-2xl border border-[var(--lp-accent-8)] bg-[var(--lp-accent-3)] p-4 text-sm leading-relaxed text-[var(--lp-gray-12)]"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--lp-accent-11)]"
            >
              <path
                d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            {t.payNote}
          </p>
        </div>
      </div>
    </Section>
  );
}
