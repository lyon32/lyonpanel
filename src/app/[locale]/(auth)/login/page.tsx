import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authMetadata } from '@/lib/seo/auth-metadata';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reset?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return authMetadata('login', locale);
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const { reset } = await searchParams;
  return (
    <AuthCard title={t('login.title')} intro={t('login.intro')}>
      <LoginForm resetDone={reset === '1'} />
    </AuthCard>
  );
}
