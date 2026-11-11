'use client';

import { Heart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { ActionButton } from '@/components/shared/action-button';
import { useRouter } from '@/i18n/navigation';
import { callApi } from '@/lib/api-client';

type Props = { serviceId: number; initialFavorite: boolean };

// Ajoute ou retire un service des favoris (PUT / DELETE /favorites/{id}).
// L'état de départ vient du serveur ; le bouton garde un nom fixe, aria-pressed dit l'état.
export function FavoriteToggle({ serviceId, initialFavorite }: Props) {
  const t = useTranslations('favorites');
  const locale = useLocale();
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);

  async function toggle() {
    const result = await callApi(
      favorite ? 'DELETE' : 'PUT',
      `/api/v1/favorites/${serviceId}`,
      null,
      locale,
    );
    if (!result.ok) {
      toast.error(t('toggleError'));
      throw new Error(result.code);
    }
    setFavorite(!favorite);
    router.refresh();
  }

  return (
    <ActionButton
      data-testid="favorite-toggle"
      variant="outline"
      aria-pressed={favorite}
      onAction={toggle}
      icon={
        <Heart aria-hidden="true" className="size-4" fill={favorite ? 'currentColor' : 'none'} />
      }
      label={t('toggle')}
      loadingLabel={t('saving')}
      successLabel={t('saved')}
      className="w-full sm:w-auto"
    />
  );
}
