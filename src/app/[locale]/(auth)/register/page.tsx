import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authMetadata } from '@/lib/seo/auth-metadata';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return authMetadata('register', locale);
}

export default async function RegisterPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  // Lien de parrainage : /inscription?ref=CODE préremplit le champ.
  const { ref } = await searchParams;
  const referralCode = typeof ref === 'string' ? ref.slice(0, 32) : undefined;
  return (
    <AuthCard compactOnPhone title={t('register.title')} intro={t('register.intro')}>
      <RegisterForm referralCode={referralCode} />
    </AuthCard>
  );
}
