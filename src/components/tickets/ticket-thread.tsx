'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ticketErrorMessage } from './attachment-upload';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

// Même plafond que le schéma serveur (MAX_BODY_LENGTH) ; le code client n'importe pas @/server.
const MAX_BODY_LENGTH = 4000;

export type ThreadTicket = {
  id: string;
  subject: string;
  status: string;
  order_short_id: string | null;
  created_at: string;
  updated_at: string;
};
export type ThreadMessage = {
  id: string;
  from_admin: boolean;
  body: string;
  attachments: { id: string; url: string }[];
  created_at: string;
};

export function TicketThread({
  ticket,
  messages,
}: {
  ticket: ThreadTicket;
  messages: ThreadMessage[];
}) {
  const t = useTranslations('support');
  const locale = useLocale();
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const closed = ticket.status === 'closed';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  async function call(url: string, method: string, payload: unknown): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await ticketErrorMessage(res, t));
        return false;
      }
      return true;
    } catch {
      setError(t('form.networkError'));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function send() {
    if (pending || !reply.trim()) return;
    if (await call(`/api/v1/tickets/${ticket.id}/messages`, 'POST', { body: reply.trim() })) {
      setReply('');
      router.refresh();
    }
  }

  async function close() {
    if (pending) return;
    if (await call(`/api/v1/tickets/${ticket.id}`, 'PATCH', { status: 'closed' })) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {messages.map((m) => (
          <li
            key={m.id}
            data-testid="ticket-message"
            data-from-admin={m.from_admin ? 'true' : 'false'}
            className={
              m.from_admin
                ? 'bg-bleu-50 border-bleu-600/40 text-encre mr-6 flex flex-col gap-2 rounded-xl rounded-tl-sm border p-3'
                : 'border-gris-200 bg-gris-50 text-encre ml-6 flex flex-col gap-2 rounded-xl rounded-tr-sm border p-3'
            }
          >
            <p className="text-gris-600 text-xs">
              <span className="font-semibold">
                {m.from_admin ? t('thread.team') : t('thread.you')}
              </span>{' '}
              · {date.format(new Date(m.created_at))}
            </p>
            {/* Texte brut : React échappe tout, aucune balise n'est interprétée. */}
            <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
            {m.attachments.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire, pas d'optimisation possible
              <img
                key={a.id}
                data-testid="ticket-attachment"
                src={a.url}
                alt={t('thread.attachment')}
                className="border-gris-200 max-h-40 max-w-full self-start rounded-lg border object-contain"
              />
            ))}
          </li>
        ))}
      </ul>
      {closed ? (
        <p
          data-testid="ticket-closed-notice"
          className="bg-gris-50 text-gris-600 border-gris-200 rounded-lg border p-3 text-sm"
        >
          {t('thread.closedNotice')}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        <label className="text-encre flex flex-col gap-1 text-sm font-semibold">
          {t('thread.reply')}
          <textarea
            data-testid="ticket-reply-body"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            maxLength={MAX_BODY_LENGTH}
            className="border-gris-400 bg-blanc text-encre focus-visible:outline-bleu-600 w-full rounded-lg border p-3 text-base font-normal focus-visible:outline-2"
          />
        </label>
        {error ? <FormAlert kind="error">{error}</FormAlert> : null}
        <Button
          type="button"
          onClick={send}
          loading={pending}
          loadingLabel={t('thread.sending')}
          data-testid="ticket-reply-send"
        >
          {t('thread.send')}
        </Button>
        {closed ? null : (
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={pending}
            data-testid="ticket-close"
          >
            {t('thread.close')}
          </Button>
        )}
      </div>
    </div>
  );
}
