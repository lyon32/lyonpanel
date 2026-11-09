'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/cn';

// Garde la même page en changeant de langue (adresse traduite par next-intl).
export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div role="group" aria-label={t('label')} className="flex items-center gap-1">
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-label={t(code)}
          aria-current={code === locale ? 'true' : undefined}
          onClick={() => router.replace(pathname as never, { locale: code })}
          className={cn(
            'focus-visible:ring-bleu-100 min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold uppercase outline-none focus-visible:ring-4',
            code === locale ? 'bg-bleu-50 text-bleu-600' : 'text-gris-600 hover:bg-gris-50',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
