'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { AttachmentUpload, readApiError } from './attachment-upload';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';

const SUBJECTS = ['order', 'recharge', 'account', 'other'] as const;
const selectClass =
  'border-gris-400 bg-blanc text-encre focus-visible:outline-bleu-600 min-h-11 w-full rounded-lg border px-3 text-base font-normal focus-visible:outline-2';

export function TicketForm({ orders }: { orders: { id: string; label: string }[] }) {
  const t = useTranslations('support');
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [orderId, setOrderId] = useState('');
  const [body, setBody] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    // Contrôles de confort ; le serveur revalide tout.
    if (!subject) return setError(t('form.choose'));
    if (!body.trim()) return setError(t('form.emptyBody'));
    if (subject === 'order' && !orderId) return setError(t('form.needOrder'));
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/v1/tickets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject,
          ...(subject === 'order' ? { order_id: orderId } : {}),
          body: body.trim(),
          ...(attachmentIds.length > 0 ? { attachment_ids: attachmentIds } : {}),
        }),
      });
      if (!res.ok) {
        setError((await readApiError(res)) ?? t('form.networkError'));
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push({ pathname: '/tickets/[id]', params: { id } });
    } catch {
      setError(t('form.networkError'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      data-testid="ticket-form"
      onSubmit={handleSubmit}
      noValidate
      className="border-gris-200 bg-blanc flex flex-col gap-4 rounded-xl border p-4"
    >
      <h2 className="text-encre text-lg font-bold">{t('form.title')}</h2>
      <p className="text-gris-600 text-sm">{t('responseTime')}</p>
      <label className="text-encre flex flex-col gap-1 text-sm font-semibold">
        {t('form.subject')}
        <select
          data-testid="ticket-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={selectClass}
        >
          <option value="">{t('form.choose')}</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {t(`subjects.${s}`)}
            </option>
          ))}
        </select>
      </label>
      {subject === 'order' ? (
        <label className="text-encre flex flex-col gap-1 text-sm font-semibold">
          {t('form.order')}
          <select
            data-testid="ticket-order"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            className={selectClass}
          >
            <option value="">{t('form.orderPlaceholder')}</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-encre flex flex-col gap-1 text-sm font-semibold">
        {t('form.body')}
        <textarea
          data-testid="ticket-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={2000}
          className="border-gris-400 bg-blanc text-encre focus-visible:outline-bleu-600 w-full rounded-lg border p-3 text-base font-normal focus-visible:outline-2"
        />
      </label>
      <AttachmentUpload onChange={setAttachmentIds} />
      {error ? <FormAlert kind="error">{error}</FormAlert> : null}
      <Button
        type="submit"
        loading={pending}
        loadingLabel={t('form.sending')}
        data-testid="ticket-submit"
      >
        {t('form.send')}
      </Button>
    </form>
  );
}
