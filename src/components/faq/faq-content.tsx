import { getTranslations } from 'next-intl/server';
import { buildFaqJsonLd, serializeJsonLd, type FaqItem } from './faq-jsonld';

const GROUP_IDS = ['payment', 'orders', 'accounts', 'security'] as const;

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent-11)]';

export async function FaqContent({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'faq' });
  // Le nombre de questions vient des messages : pas de compteur en dur.
  const groups = GROUP_IDS.map((g) => {
    const count = Object.keys(t.raw(`groups.${g}.items`) as Record<string, unknown>).length;
    return {
      id: g,
      title: t(`groups.${g}.title`),
      items: Array.from({ length: count }, (_, i): FaqItem => ({
        question: t(`groups.${g}.items.${i + 1}.question`),
        answer: t(`groups.${g}.items.${i + 1}.answer`),
      })),
    };
  });
  const jsonLd = buildFaqJsonLd(groups.flatMap((g) => g.items));

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <script type="application/ld+json">{serializeJsonLd(jsonLd)}</script>
      <h1 className="text-3xl font-bold text-balance text-[var(--lp-gray-12)] sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--lp-gray-11)]">{t('intro')}</p>
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`faq-${g.id}`} className="mt-10">
          <h2 id={`faq-${g.id}`} className="text-xl font-semibold text-[var(--lp-gray-12)]">
            {g.title}
          </h2>
          <div className="mt-4 space-y-3">
            {g.items.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)] open:border-[var(--lp-gray-8)] motion-safe:transition-colors motion-safe:duration-200"
              >
                <summary
                  className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-3 text-base font-medium text-[var(--lp-gray-12)] marker:hidden hover:bg-[var(--lp-gray-3)] active:bg-[var(--lp-gray-4)] [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  {item.question}
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    aria-hidden="true"
                    className="shrink-0 text-[var(--lp-accent-11)] group-open:rotate-45 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out"
                  >
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                </summary>
                <p className="px-5 pb-5 text-base leading-relaxed text-[var(--lp-gray-11)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
