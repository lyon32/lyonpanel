'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { OrderActionForm } from './order-action-form';
import { OrderRefundForm } from './order-refund-form';

type Props = {
  orderId: string;
  status: string;
  customer: string;
  locale: string;
  maxRefundXaf: number;
  suggestedRefundXaf: number | null;
  resent: boolean;
};

// Actions de la fiche commande. Le serveur contrôle chaque règle ; l'écran ne montre
// que ce qui a un sens pour le statut courant.
export function OrderActions(p: Props) {
  const t = useTranslations('admin.orders');
  const [verified, setVerified] = useState(false);
  const base = `/api/v1/admin/orders/${p.orderId}`;
  const open = p.status === 'pending' || p.status === 'in_progress';
  const review = p.status === 'to_review';

  return (
    <div className="flex flex-col gap-4">
      <OrderRefundForm
        orderId={p.orderId}
        customer={p.customer}
        maxXaf={p.maxRefundXaf}
        suggestedXaf={p.suggestedRefundXaf}
        locale={p.locale}
      />
      {open ? (
        <OrderActionForm
          id="order-cancel"
          title={t('cancel.title')}
          hint={t('cancel.hint')}
          path={`${base}/cancel`}
          submitLabel={t('cancel.submit')}
          confirmLabel={t('cancel.confirm')}
          successText={t('cancel.success')}
          destructive
          fieldsValid
          buildBody={(reason) => ({ reason })}
        />
      ) : null}
      {review && !p.resent ? (
        <OrderActionForm
          id="order-resend"
          title={t('resend.title')}
          hint={t('resend.hint')}
          path={`${base}/resend`}
          submitLabel={t('resend.submit')}
          confirmLabel={t('resend.confirm')}
          successText={t('resend.success')}
          fieldsValid={verified}
          buildBody={(reason) => ({ confirm_verified: true, reason })}
          onReset={() => setVerified(false)}
        >
          <label className="flex min-h-11 items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="accent-bleu-600 focus-visible:ring-bleu-100 mt-0.5 size-6 shrink-0 outline-none focus-visible:ring-4"
            />
            <span>{t('resend.verified')}</span>
          </label>
        </OrderActionForm>
      ) : null}
      {review && p.resent ? (
        <p className="border-gris-200 bg-blanc text-gris-600 rounded-xl border p-4 text-sm">
          {t('resentDone')}
        </p>
      ) : null}
      {review ? (
        <OrderActionForm
          id="order-close"
          title={t('close.title')}
          hint={t('close.hint')}
          path={`${base}/close`}
          submitLabel={t('close.submit')}
          confirmLabel={t('close.confirm')}
          successText={t('close.success')}
          fieldsValid
          buildBody={(reason) => ({ reason })}
        />
      ) : null}
    </div>
  );
}
