import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

// Commentaires personnalisés : une ligne par commentaire.
export function CommentsField({
  value,
  error,
  disabled,
  onChange,
}: {
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('order');
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="order-comments" className="text-encre text-sm font-semibold">
        {t('commentsLabel')}
      </label>
      <textarea
        id="order-comments"
        name="comments"
        data-testid="order-comments"
        rows={5}
        value={value}
        disabled={disabled}
        aria-describedby="order-comments-hint"
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="border-gris-200 bg-blanc text-encre focus-visible:border-bleu-600 focus-visible:ring-bleu-100 aria-invalid:border-erreur w-full rounded-lg border px-3 py-2 text-base outline-none focus-visible:ring-4 disabled:opacity-50"
      />
      <p id="order-comments-hint" className="text-gris-600 text-sm">
        {t('commentsHint')}
      </p>
      {error ? (
        <p role="alert" className="text-erreur text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Solde insuffisant : le montant manquant et le chemin vers la recharge.
export function MissingBalance({ amount }: { amount: string }) {
  const t = useTranslations('order');
  return (
    <div className="flex flex-col gap-3">
      <p
        role="alert"
        data-testid="missing-balance"
        className="text-erreur bg-erreur-fond rounded-lg p-3 text-sm font-semibold tabular-nums"
      >
        {t('missingBalance', { amount })}
      </p>
      <Link
        href="/add-funds"
        data-testid="topup-link"
        className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold outline-none focus-visible:ring-4"
      >
        {t('topUp')}
      </Link>
    </div>
  );
}

// Solde actuel affiché en haut de l'écran de commande.
export function WalletBalance({ amount }: { amount: string }) {
  const t = useTranslations('order');
  return (
    <p
      data-testid="wallet-balance"
      className="bg-gris-50 flex max-w-md items-baseline justify-between rounded-lg px-3 py-3 text-sm tabular-nums"
    >
      <span className="text-gris-600">{t('balance')}</span>
      <span className="text-bleu-600 text-lg font-bold">{amount}</span>
    </p>
  );
}
