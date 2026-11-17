import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TicketActions } from '@/components/admin/ticket-actions';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/admin-format';
import { emailsByUserId } from '@/server/admin/emails';
import { requireAdminPage } from '@/server/admin/page-guard';
import { getAdminTranslator } from '@/server/admin/page-i18n';
import { getAdminTicket } from '@/server/admin/tickets';
import { ApiError } from '@/server/http/api-error';

type Props = { params: Promise<{ adminPath: string; id: string }> };

async function load(id: string) {
  try {
    return await getAdminTicket(id);
  } catch (error) {
    // Ticket inconnu ou identifiant mal formé : 404, comme le reste de l'admin.
    if (error instanceof ApiError) notFound();
    throw error;
  }
}

export default async function AdminTicketPage({ params }: Props) {
  await requireAdminPage();
  const { adminPath, id } = await params;
  const { t, locale } = await getAdminTranslator();
  const { ticket, messages } = await load(id);
  const emails = await emailsByUserId([ticket.user_id]);
  const badge =
    ticket.status === 'closed' ? 'info' : ticket.status === 'open' ? 'pending' : 'success';

  return (
    <>
      <Link
        href={`/${adminPath}/tickets`}
        className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center gap-1 text-sm font-semibold outline-none focus-visible:ring-4"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('tickets.back')}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-encre text-2xl font-bold break-words">{ticket.subject}</h1>
        <Badge status={badge}>
          {t(`tickets.status.${ticket.status as 'open' | 'answered' | 'closed'}`)}
        </Badge>
      </div>
      <p className="text-gris-600 text-sm break-all">
        {t('tickets.customer')} : {emails.get(ticket.user_id) ?? ticket.user_id}
      </p>
      {ticket.order_id ? (
        <Link
          href={`/${adminPath}/orders/${ticket.order_id}`}
          className="border-gris-200 bg-blanc text-bleu-600 hover:bg-bleu-50 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg border px-4 font-semibold outline-none focus-visible:ring-4 sm:w-fit"
        >
          {t('tickets.openOrder')}
        </Link>
      ) : null}

      <section aria-labelledby="ticket-messages" className="flex flex-col gap-3">
        <h2 id="ticket-messages" className="text-encre text-lg font-bold">
          {t('tickets.messages')}
        </h2>
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={`flex flex-col gap-1 rounded-xl border p-4 ${m.from_admin ? 'border-bleu-100 bg-bleu-50' : 'border-gris-200 bg-blanc'}`}
            >
              <span className="text-gris-600 flex flex-wrap justify-between gap-x-3 text-xs">
                <span className="font-semibold">
                  {m.from_admin ? t('tickets.fromAdmin') : t('tickets.fromCustomer')}
                </span>
                <span className="tabular-nums">{formatDateTime(m.created_at, locale)}</span>
              </span>
              {/* Texte brut, jamais interprété comme du HTML. */}
              <p className="text-encre text-sm break-words whitespace-pre-wrap">{m.body}</p>
              {m.attachments.map((a, i) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bleu-600 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center text-sm underline outline-none focus-visible:ring-4"
                >
                  {t('tickets.attachment')} {i + 1}
                </a>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <TicketActions ticketId={ticket.id} status={ticket.status} />
    </>
  );
}
