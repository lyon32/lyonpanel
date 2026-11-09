'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormAlert } from './form-alert';
import { TurnstileWidget } from './turnstile-widget';
import { textOf, useAuthForm } from './use-auth-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Link } from '@/i18n/navigation';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);
  const { pending, formError, fieldErrors, handleSubmit } = useAuthForm({
    path: 'password/forgot',
    buildBody: (form) => ({
      email: textOf(form, 'email'),
      turnstile_token: textOf(form, 'cf-turnstile-response'),
    }),
    onSuccess: () => setSent(true),
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <Field
        label={t('fields.email')}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        error={fieldErrors.email}
      />
      <TurnstileWidget />
      {formError ? <FormAlert kind="error">{formError}</FormAlert> : null}
      {/* Même message que l'email existe ou non : on ne révèle rien. */}
      {sent ? <FormAlert kind="success">{t('forgot.success')}</FormAlert> : null}
      <Button type="submit" loading={pending} loadingLabel={t('submitting')}>
        {t('forgot.submit')}
      </Button>
      <p className="text-sm">
        <Link
          href="/login"
          className="text-bleu-600 hover:text-bleu-700 -my-2 inline-flex min-h-11 min-w-11 items-center justify-center font-semibold underline-offset-4 hover:underline"
        >
          {t('forgot.back')}
        </Link>
      </p>
    </form>
  );
}
