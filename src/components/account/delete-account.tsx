'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { ActionButton } from '@/components/shared/action-button';
import { InlineAlert } from '@/components/shared/inline-alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/navigation';
import { callApi } from '@/lib/api-client';

// Suppression du compte : mot de passe demandé, anonymisation côté serveur (DELETE /me).
export function DeleteAccount() {
  const t = useTranslations('account.delete');
  const locale = useLocale();
  const router = useRouter();
  const passwordId = useId();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    if (!password) {
      setError(t('passwordRequired'));
      throw new Error('PASSWORD_REQUIRED');
    }
    const result = await callApi('DELETE', '/api/v1/me', { password }, locale);
    if (!result.ok) {
      setError(
        result.code === 'INVALID_CREDENTIALS' ? t('wrongPassword') : result.message || t('error'),
      );
      throw new Error(result.code);
    }
    router.replace('/login');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setPassword('');
              setError(null);
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-testid="account-delete"
              className="text-erreur border-erreur w-full sm:w-auto"
            >
              {t('open')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="lp-app border-gris-200 text-encre">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('confirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription className="text-gris-600">
                {t('confirmText')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={passwordId} className="text-encre text-sm font-medium">
                {t('password')}
              </label>
              <Input
                id={passwordId}
                data-testid="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <InlineAlert>{error}</InlineAlert> : null}
            <AlertDialogFooter>
              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
              <ActionButton
                data-testid="delete-confirm"
                variant="destructive"
                onAction={confirm}
                label={t('confirm')}
                loadingLabel={t('deleting')}
                successLabel={t('deleted')}
              />
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
