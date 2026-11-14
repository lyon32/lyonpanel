import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

const KEYS = ['delivery', 'partial', 'refund', 'rechargeMissing', 'privateLink'] as const;

// Cinq réponses fixes : elles évitent beaucoup de tickets. Texte brut, ouverture au toucher.
export function SupportFaq() {
  const t = useTranslations('support.faq');
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-encre text-lg font-bold">{t('title')}</h2>
      <div className="flex flex-col gap-2">
        {KEYS.map((key) => (
          <details
            key={key}
            data-testid="faq-item"
            className="border-gris-200 bg-blanc group rounded-lg border"
          >
            <summary className="text-encre focus-visible:outline-bleu-600 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold focus-visible:outline-2">
              {t(`items.${key}.question`)}
              <ChevronDown
                className="text-gris-600 size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <p className="text-gris-600 px-3 pb-3 text-sm leading-relaxed">
              {t(`items.${key}.answer`)}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
