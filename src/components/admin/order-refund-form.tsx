'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { OrderActionForm } from './order-action-form';
import { Field } from '@/components/ui/field';
import { formatXaf } from '@/lib/admin-format';

type Props = {
  orderId: string;
  customer: string;
  /** Plafond : payé moins déjà rendu. */
  maxXaf: number;
  /** Part non livrée connue, ou null quand le reste à livrer est inconnu. */
  suggestedXaf: number | null;
  locale: string;
};

// Remboursement sur le solde du client. Le montant est proposé par le serveur, modifiable,
// plafonné ; la clé d'idempotence est renouvelée seulement quand la saisie change.
export function OrderRefundForm({ orderId, customer, maxXaf, suggestedXaf, locale }: Props) {
  const t = useTranslations('admin.orders');
  const [amount, setAmount] = useState(suggestedXaf === null ? '' : String(suggestedXaf));
  const [key, setKey] = useState(() => crypto.randomUUID());
  const amountXaf = /^\d+$/.test(amount) ? Number(amount) : 0;
  const valid = amountXaf >= 1 && amountXaf <= maxXaf;

  if (maxXaf <= 0) {
    return (
      <section className="border-gris-200 bg-blanc rounded-xl border p-4 sm:p-5">
        <h3 className="text-encre text-lg font-bold">{t('refund.title')}</h3>
        <p className="text-gris-600 mt-2 text-sm">{t('refund.none')}</p>
      </section>
    );
  }
  const hint =
    suggestedXaf === null
      ? t('refund.hintUnknown', { max: formatXaf(maxXaf, locale) })
      : t('refund.hintKnown', { amount: formatXaf(suggestedXaf, locale) });

  return (
    <OrderActionForm
      id="order-refund"
      title={t('refund.title')}
      path={`/api/v1/admin/orders/${orderId}/refund`}
      submitLabel={t('refund.submit')}
      confirmLabel={t('refund.confirm')}
      successText={t('refund.success')}
      fieldsValid={valid}
      buildBody={(reason) => ({ amount_xaf: amountXaf, reason })}
      recap={t('refund.recap', { amount: formatXaf(amountXaf, locale), customer })}
      headers={{ 'Idempotency-Key': key }}
      onReset={() => setKey(crypto.randomUUID())}
    >
      <Field
        label={t('refund.amount')}
        hint={hint}
        inputMode="numeric"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value.replace(/\D/g, ''));
          setKey(crypto.randomUUID());
        }}
        required
      />
    </OrderActionForm>
  );
}
