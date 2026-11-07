import { setRequestLocale, getTranslations } from 'next-intl/server';

import { SITE_NAME } from '@/lib/constants';

// Page provisoire ; l'accueil réel arrive en phase 14.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-bleu-600 text-4xl font-bold">{SITE_NAME}</h1>
      <p className="text-gris-600">{t('title')}</p>
      <p className="text-gris-600">{t('subtitle')}</p>
    </div>
  );
}
