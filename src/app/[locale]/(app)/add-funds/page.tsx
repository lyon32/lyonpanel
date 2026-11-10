import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddFundsForm } from '@/components/wallet/add-funds-form';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('addFunds'), robots: { index: false, follow: false } };
}

export default async function AddFundsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'wallet' });
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-encre text-2xl font-bold">{t('title')}</h1>
      <AddFundsForm />
    </section>
  );
}
