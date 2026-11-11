'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { SuggestionCard } from '@/components/order/suggestion-card';
import { callApi } from '@/lib/api-client';

type Props = { service: { id: number; name: string; platform: string }; quantity: number };

// Branche « ne plus afficher » sur le profil du client (base de données, tous ses appareils).
export function SuggestionSlot({ service, quantity }: Props) {
  const t = useTranslations('suggestion');
  const locale = useLocale();

  async function disable() {
    const result = await callApi('PATCH', '/api/v1/me', { suggestions_enabled: false }, locale);
    if (!result.ok) {
      toast.error(t('disableError'));
      throw new Error(result.code);
    }
  }

  return <SuggestionCard service={service} quantity={quantity} onDisable={disable} />;
}
