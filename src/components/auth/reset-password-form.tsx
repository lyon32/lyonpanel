'use client';

import { useTranslations } from 'next-intl';
import { FormAlert } from './form-alert';
import { textOf, useAuthForm } from './use-auth-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { pending, formError, fieldErrors, handleSubmit } = useAuthForm({
    path: 'password/reset',
    buildBody: (form) => ({ token, new_password: textOf(form, 'new_password') }),
    // Toutes les sessions sont fermées : retour à la connexion avec un message.
    onSuccess: () => router.push({ pathname: '/login', query: { reset: '1' } }),
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        label={t('reset.newPassword')}
        hint={t('fields.passwordHint')}
        name="new_password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors.new_password}
      />
      {/* Un lien invalide ou expiré revient du serveur sur le champ « token ». */}
      {fieldErrors.token ? <FormAlert kind="error">{fieldErrors.token}</FormAlert> : null}
      {formError ? <FormAlert kind="error">{formError}</FormAlert> : null}
      <Button type="submit" loading={pending} loadingLabel={t('submitting')}>
        {t('reset.submit')}
      </Button>
    </form>
  );
}
