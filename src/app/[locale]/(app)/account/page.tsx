import type { Metadata } from 'next';
import { CircleUserRound, Heart, Receipt } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountForm } from '@/components/account/account-form';
import { DeleteAccount } from '@/components/account/delete-account';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { getMe } from '@/server/accounts/profile';
import { requireUser } from '@/server/auth/require-user';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('account'), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale === 'en' ? 'en' : 'fr');
  const t = await getTranslations({ locale, namespace: 'account' });
  const me = await getMe(user.id);
  const links = [
    { href: '/transactions', label: t('linkTransactions'), Icon: Receipt },
    { href: '/favorites', label: t('linkFavorites'), Icon: Heart },
  ] as const;
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-encre flex items-center gap-2 text-2xl font-bold md:text-3xl">
        <CircleUserRound size={28} aria-hidden="true" className="text-gris-400" />
        {t('title')}
      </h1>
      <AccountForm
        email={me.email}
        currency={me.display_currency}
        language={me.language === 'en' ? 'en' : 'fr'}
        phone={me.phone}
        suggestionsEnabled={me.suggestions_enabled}
      />
      <Card className="divide-gris-200 divide-y overflow-hidden">
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="text-encre hover:bg-gris-50 focus-visible:ring-bleu-100 flex min-h-14 items-center gap-3 px-5 font-medium outline-none focus-visible:ring-4"
          >
            <Icon size={20} aria-hidden="true" className="text-gris-400" />
            {label}
          </Link>
        ))}
      </Card>
      <DeleteAccount />
    </section>
  );
}
