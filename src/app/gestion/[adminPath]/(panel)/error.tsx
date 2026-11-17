'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// Erreur inattendue : message neutre (jamais le détail technique) et une action.
export default function AdminPanelError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('admin');
  return (
    <div
      role="alert"
      className="border-erreur bg-erreur-fond flex flex-col gap-3 rounded-xl border p-5"
    >
      <h1 className="text-erreur text-lg font-bold">{t('common.errorTitle')}</h1>
      <p className="text-encre text-sm">{t('common.errorText')}</p>
      <div>
        <Button onClick={reset}>{t('common.retry')}</Button>
      </div>
    </div>
  );
}
