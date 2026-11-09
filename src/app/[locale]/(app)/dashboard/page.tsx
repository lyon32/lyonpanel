import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Greeting } from '@/components/shared/greeting';
import { ComingSoon } from '@/components/shared/coming-soon';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('dashboard'), robots: { index: false, follow: false } };
}

// Page provisoire : le contenu réel arrive dans une phase suivante.
export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <>
      <Greeting />
      <ComingSoon />
    </>
  );
}
