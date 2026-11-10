import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PaymentStatus, type PaymentView } from '@/components/wallet/payment-status';
import { requireUser } from '@/server/auth/require-user';
import { createSessionClient } from '@/server/db/supabase-server';

type Props = { params: Promise<{ locale: string; id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('addFunds'), robots: { index: false, follow: false } };
}

export default async function PaymentReturnPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  const user = await requireUser(locale === 'en' ? 'en' : 'fr');
  const supabase = await createSessionClient();
  // Filtre user_id en plus de la RLS : le paiement d'un autre client donne un 404.
  const { data: payment } = await supabase
    .from('payments')
    .select('credited_xaf, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!payment) notFound();
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance_xaf')
    .eq('user_id', user.id)
    .maybeSingle();
  const t = await getTranslations({ locale, namespace: 'wallet' });
  // « created » et « pending » : même écran d'attente pour le client.
  const status: PaymentView =
    payment.status === 'succeeded' || payment.status === 'failed' ? payment.status : 'pending';
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-encre text-2xl font-bold">{t('returnTitle')}</h1>
      <PaymentStatus
        status={status}
        amountXaf={payment.credited_xaf}
        balanceXaf={wallet?.balance_xaf ?? 0}
      />
    </section>
  );
}
