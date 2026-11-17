'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = { ticketId: string; status: string };

// Réponse (FR ou EN, texte libre) et fermeture / réouverture d'un ticket.
// Le serveur remet à zéro la limite de messages du client à chaque réponse.
export function TicketActions({ ticketId, status }: Props) {
  const t = useTranslations('admin');
  const reply = useAdminAction({ error: t('common.error'), success: t('tickets.replySent') });
  const toggle = useAdminAction({
    error: t('common.error'),
    success: t(status === 'closed' ? 'tickets.reopened_ok' : 'tickets.closed_ok'),
  });
  const [body, setBody] = useState('');
  const base = `/api/v1/admin/tickets/${ticketId}`;
  const valid = body.trim().length > 0;

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reply.pending || !valid) return;
    const res = await reply.run(`${base}/messages`, 'POST', { body: body.trim() });
    if (res.ok) setBody('');
  }

  return (
    <div className="flex flex-col gap-4">
      {status !== 'closed' ? (
        <form
          onSubmit={sendReply}
          aria-labelledby="ticket-reply-title"
          className="border-gris-200 bg-blanc flex flex-col gap-3 rounded-xl border p-4 sm:p-5"
        >
          <h2 id="ticket-reply-title" className="text-encre text-lg font-bold">
            {t('tickets.replyTitle')}
          </h2>
          <p className="text-gris-600 text-sm">{t('tickets.replyHint')}</p>
          <label htmlFor="ticket-reply" className="text-encre text-sm font-semibold">
            {t('tickets.replyLabel')}
          </label>
          <Textarea
            id="ticket-reply"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              reply.clearFeedback();
            }}
            maxLength={5000}
            disabled={reply.pending}
            required
          />
          {reply.feedback ? (
            <FormAlert kind={reply.feedback.kind}>{reply.feedback.text}</FormAlert>
          ) : null}
          <Button
            type="submit"
            className="w-full sm:w-fit"
            loading={reply.pending}
            loadingLabel={t('orders.sending')}
            disabled={reply.pending || !valid}
          >
            {t('tickets.replySubmit')}
          </Button>
        </form>
      ) : null}

      <div className="flex flex-col gap-2">
        {toggle.feedback ? (
          <FormAlert kind={toggle.feedback.kind}>{toggle.feedback.text}</FormAlert>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-fit"
          loading={toggle.pending}
          loadingLabel={t('orders.sending')}
          disabled={toggle.pending}
          onClick={() =>
            void toggle.run(base, 'PATCH', { status: status === 'closed' ? 'open' : 'closed' })
          }
        >
          {status === 'closed' ? t('tickets.reopen') : t('tickets.close')}
        </Button>
      </div>
    </div>
  );
}
