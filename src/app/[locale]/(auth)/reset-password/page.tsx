import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { authMetadata } from '@/lib/seo/auth-metadata';
import { AuthCard } from '@/components/auth/auth-card';
import { FormAlert } from '@/components/auth/form-alert';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Link } from '@/i18n/navigation';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token_hash?: string | string[]; token?: string | string[] }>;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  return authMetadata('reset-password', locale);
}

export default async function ResetPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  const query = await searchParams;
  // Gabarit Supabase : token_hash ; « token » en secours.
  const raw = query.token_hash ?? query.token;
  const token = typeof raw === 'string' ? raw : '';
  return (
    <AuthCard title={t('reset.title')}>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormAlert kind="error">{t('reset.missingToken')}</FormAlert>
          <Link
            href="/forgot-password"
            className="text-bleu-600 inline-flex min-h-11 items-center text-sm font-semibold"
          >
            {t('forgot.title')}
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
