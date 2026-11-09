'use client';

import { LogOut } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/i18n/navigation';
import { postAuth } from '@/lib/auth-client';

export function LogoutButton() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await postAuth('logout', null, locale);
    router.push('/login');
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="secondary"
      data-testid="logout"
      loading={pending}
      loadingLabel={t('submitting')}
      onClick={logout}
      className="max-sm:w-11 max-sm:px-0"
    >
      <LogOut size={18} aria-hidden="true" />
      <span className="max-sm:sr-only">{t('logout')}</span>
    </Button>
  );
}
