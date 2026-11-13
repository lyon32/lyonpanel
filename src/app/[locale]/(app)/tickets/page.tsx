import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SupportFaq } from '@/components/tickets/support-faq';
import { TicketForm } from '@/components/tickets/ticket-form';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/server/auth/require-user';
import { listOrders } from '@/server/orders/list-orders';
import { listTickets, shortTicketId } from '@/server/tickets/tickets';

type Props = { params: Promise<{ locale: string }> };

// Couleurs de statut lisibles sur fond sombre (docs/05 §11).
const STATUS_CLASS: Record<string, string> = {
  open: 'border-[#f5c451]/50 text-[#f5c451]',
  answered: 'border-[#4ade80]/50 text-[#4ade80]',
  closed: 'border-gris-400 text-gris-600',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages' });
  return { title: t('tickets'), robots: { index: false, follow: false } };
}

export default async function TicketsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale === 'en' ? 'en' : 'fr';
  const user = await requireUser(lang);
  const t = await getTranslations({ locale, namespace: 'support' });
  const [{ data: orders }, { items }] = await Promise.all([
    listOrders(user.id, { limit: 50 }, lang),
    listTickets(user.id, { limit: 20 }),
  ]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-encre text-2xl font-bold">{t('title')}</h1>
      <SupportFaq />
      <TicketForm
        orders={orders.map((o) => ({ id: o.id, label: `#${o.short_id} · ${o.service.name}` }))}
      />
      <section className="flex flex-col gap-3">
        <h2 className="text-encre text-lg font-bold">{t('list.title')}</h2>
        {items.length === 0 ? (
          <p className="border-gris-200 bg-blanc text-gris-600 rounded-lg border border-dashed p-4 text-sm">
            {t('list.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  data-testid="ticket-row"
                  href={{ pathname: '/tickets/[id]', params: { id: ticket.id } }}
                  className="border-gris-200 bg-blanc text-encre focus-visible:outline-bleu-600 flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm focus-visible:outline-2"
                >
                  <span className="min-w-0 font-semibold break-words">
                    #{shortTicketId(ticket.id)} · {t(`subjects.${ticket.subject}`)}
                  </span>
                  <span className="text-gris-600 flex shrink-0 flex-col items-end gap-1 text-xs">
                    <span
                      data-status={ticket.status}
                      className={`rounded-full border px-2 py-0.5 font-semibold ${STATUS_CLASS[ticket.status] ?? STATUS_CLASS.closed}`}
                    >
                      {t(`list.status.${ticket.status}`)}
                    </span>
                    <span>{date.format(new Date(ticket.updated_at))}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
