'use client';

import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/cn';

// Même rôle que le sélecteur du site, en pastille claire lisible sur le dégradé,
// et sans perdre le lien de réinitialisation (paramètres d'adresse conservés).
export function AuthLanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { locale: _locale, ...params } = useParams();

  function change(code: (typeof routing.locales)[number]) {
    const query = Object.fromEntries(new URLSearchParams(window.location.search));
    router.replace({ pathname, params, query } as never, { locale: code });
  }

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="bg-blanc/90 flex items-center rounded-full p-0.5 shadow-[0_1px_3px_rgba(14,23,38,0.12)]"
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-label={t(code)}
          aria-current={code === locale ? 'true' : undefined}
          onClick={() => change(code)}
          className={cn(
            'focus-visible:ring-bleu-100 min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold uppercase outline-none focus-visible:ring-4',
            code === locale ? 'bg-bleu-600 text-blanc' : 'text-gris-600 hover:bg-gris-50',
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
