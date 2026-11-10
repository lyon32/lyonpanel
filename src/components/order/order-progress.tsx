import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type OrderStep = 'sending' | 'debiting' | 'submitting' | 'done';
const STEPS = ['sending', 'debiting', 'submitting'] as const;

// Étapes de l'envoi. L'annonce vocale (aria-live) ne lit que l'étape en cours.
export function OrderProgress({ step }: { step: OrderStep }) {
  const t = useTranslations('order');
  const current = step === 'done' ? STEPS.length : STEPS.indexOf(step);
  return (
    <div data-testid="order-progress" data-step={step}>
      <p className="sr-only" aria-live="polite">
        {step === 'done' ? t('stepDone') : t(`step_${step}`)}
      </p>
      <ol aria-label={t('stepsLabel')} className="flex flex-col gap-2 text-sm">
        {STEPS.map((name, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={name}
              aria-current={active ? 'step' : undefined}
              className={`flex min-h-6 items-center gap-2 ${done || active ? 'text-encre' : 'text-gris-600'}`}
            >
              {done ? (
                <Check className="text-succes size-4 shrink-0" aria-hidden="true" />
              ) : active ? (
                <Loader2
                  className="text-bleu-600 size-4 shrink-0 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="border-gris-400 size-4 shrink-0 rounded-full border"
                  aria-hidden="true"
                />
              )}
              {t(`step_${name}`)}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
