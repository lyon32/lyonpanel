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
            className="border-gris-200 bg-blanc rounded-lg border"
          >
            <summary className="text-encre focus-visible:outline-bleu-600 flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm font-semibold focus-visible:outline-2">
              {t(`items.${key}.question`)}
            </summary>
            <p className="text-gris-600 px-3 pb-3 text-sm">{t(`items.${key}.answer`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
