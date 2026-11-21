import { getTranslations } from 'next-intl/server';

// Message volontairement sans détail technique.
export async function CatalogError() {
  const t = await getTranslations('platform.error');
  return (
    <div
      role="alert"
      className="mx-auto max-w-md rounded-lg border border-[var(--lp-border,#2a2a2a)] bg-[var(--lp-surface,#191919)] p-8 text-center"
    >
      <h2 className="text-lg font-bold text-[var(--lp-text,#eeeeef)]">{t('title')}</h2>
      <p className="mt-2 text-sm text-[var(--lp-text-muted,#b0b0b4)]">{t('text')}</p>
    </div>
  );
}
