import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TicketThread } from '@/components/tickets/ticket-thread';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/server/auth/require-user';
import { ApiError } from '@/server/http/api-error';
import { getTicket, shortTicketId } from '@/server/tickets/tickets';

type Props = { params: Promise<{ locale: string; id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('tickets'), robots: { index: false, follow: false } };
}

export default async function TicketPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  const user = await requireUser(locale === 'en' ? 'en' : 'fr');
  // Ticket absent ou d'un autre client : le service répond NOT_FOUND, on rend un 404.
  const found = await getTicket(user.id, id).catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!found) notFound();
  const t = await getTranslations({ locale, namespace: 'support' });
  return (
    <section className="flex flex-col gap-4">
      <Link
        href="/tickets"
        className="text-bleu-600 focus-visible:outline-bleu-600 inline-flex min-h-11 items-center text-sm font-semibold focus-visible:outline-2"
      >
        {t('thread.back')}
      </Link>
      <h1 className="text-encre text-2xl font-bold">
        #{shortTicketId(found.ticket.id)} · {t(`subjects.${found.ticket.subject}`)}
      </h1>
      <TicketThread ticket={found.ticket} messages={found.messages} />
    </section>
  );
}
