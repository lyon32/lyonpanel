'use client';

import { Repeat, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { ServiceName } from '@/components/shared/service-name';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';

type Props = {
  service: { id: number; name: string; platform: string };
  quantity: number;
  // Enregistre le choix en base (PATCH /me) ; la carte se ferme ensuite.
  onDisable: () => void | Promise<void>;
};

// Suggestion de commande : calculée par le serveur, jamais mémorisée dans le navigateur.
// La croix ferme la carte pour cette visite seulement.
export function SuggestionCard({ service, quantity, onDisable }: Props) {
  const t = useTranslations('suggestion');
  const locale = useLocale();
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (closed) return null;

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      await onDisable();
      setClosed(true);
    } finally {
      setBusy(false);
    }
  }

  const count = new Intl.NumberFormat(locale).format(quantity);
  return (
    <Card
      data-testid="suggestion-card"
      className="relative flex flex-col gap-3 p-4 pr-14 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pr-16"
    >
      <button
        type="button"
        data-testid="suggestion-dismiss"
        aria-label={t('dismiss')}
        onClick={() => setClosed(true)}
        className="text-gris-600 hover:bg-gris-50 focus-visible:ring-bleu-100 absolute top-1 right-1 inline-flex size-11 items-center justify-center rounded-lg outline-none focus-visible:ring-4"
      >
        <X size={18} aria-hidden="true" />
      </button>
      <div className="flex min-w-0 items-start gap-3">
        <span className="bg-bleu-50 text-bleu-600 mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Repeat size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-gris-600 text-sm">{t('title')}</p>
          <ServiceName name={service.name} className="text-encre block font-semibold" />
          <p className="text-gris-600 text-sm tabular-nums">{t('quantity', { count })}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          data-testid="suggestion-order"
          href={{ pathname: '/order', query: { service: service.id, quantity } }}
          className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg px-4 font-semibold outline-none focus-visible:ring-4"
        >
          {t('order')}
        </Link>
        <button
          type="button"
          data-testid="suggestion-disable"
          disabled={busy}
          onClick={() => void disable()}
          className="text-gris-600 hover:text-encre focus-visible:ring-bleu-100 inline-flex min-h-11 items-center rounded-lg px-3 text-sm underline underline-offset-4 outline-none focus-visible:ring-4 disabled:opacity-60"
        >
          {t('disable')}
        </button>
      </div>
    </Card>
  );
}
