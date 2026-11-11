'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ServiceName } from '@/components/shared/service-name';
import { ActionButton } from '@/components/shared/action-button';
import { Link, useRouter } from '@/i18n/navigation';
import { callApi } from '@/lib/api-client';

type Props = { id: number; name: string; priceLabel: string };

// Un favori : commander (formulaire ouvert sur ce service) ou le retirer (DELETE /favorites/{id}).
export function FavoriteRow({ id, name, priceLabel }: Props) {
  const t = useTranslations('favorites');
  const locale = useLocale();
  const router = useRouter();

  async function remove() {
    const result = await callApi('DELETE', `/api/v1/favorites/${id}`, null, locale);
    if (!result.ok) {
      toast.error(t('removeError'));
      throw new Error(result.code);
    }
    // Laisse voir « Retiré » un instant avant que la ligne disparaisse.
    window.setTimeout(() => router.refresh(), 600);
  }

  return (
    <li
      data-testid="favorite-row"
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <ServiceName name={name} className="text-encre block font-medium" />
        <p className="text-gris-600 text-sm tabular-nums">{t('price', { price: priceLabel })}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={{ pathname: '/order', query: { service: id } }}
          className="bg-bleu-600 text-blanc hover:bg-bleu-700 focus-visible:ring-bleu-100 inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 font-semibold outline-none focus-visible:ring-4 sm:flex-none"
        >
          {t('order')}
        </Link>
        <ActionButton
          data-testid="favorite-remove"
          variant="outline"
          onAction={remove}
          label={t('remove')}
          loadingLabel={t('removing')}
          successLabel={t('removed')}
          className="flex-1 sm:flex-none"
        />
      </div>
    </li>
  );
}
