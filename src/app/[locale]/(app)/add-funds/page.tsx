import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AddFundsForm } from '@/components/wallet/add-funds-form';
import { requireUser } from '@/server/auth/require-user';
import { createSessionClient } from '@/server/db/supabase-server';
import { loadRechargeRules } from '@/server/payments/quote';

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
  const user = await requireUser(locale === 'en' ? 'en' : 'fr');
  const supabase = await createSessionClient();
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance_xaf')
    .eq('user_id', user.id)
    .maybeSingle();
  const rules = await loadRechargeRules();
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-encre text-2xl font-bold">{t('title')}</h1>
      <AddFundsForm
        minXaf={rules.minRechargeXaf}
        maxXaf={rules.maxRechargeXaf}
        balanceXaf={wallet?.balance_xaf ?? 0}
      />
    </section>
  );
}
