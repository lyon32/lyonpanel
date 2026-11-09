'use client';

import { useTranslations } from 'next-intl';
import { FormAlert } from './form-alert';
import { TurnstileWidget } from './turnstile-widget';
import { textOf, useAuthForm } from './use-auth-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';

export function LoginForm({ resetDone = false }: { resetDone?: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const { pending, success, formError, fieldErrors, handleSubmit } = useAuthForm({
    path: 'login',
    buildBody: (form) => ({
      identifier: textOf(form, 'identifier'),
      password: textOf(form, 'password'),
      turnstile_token: textOf(form, 'cf-turnstile-response'),
    }),
    onSuccess: () => {
      router.push('/dashboard');
      router.refresh();
    },
  });

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {resetDone ? <FormAlert kind="success">{t('reset.success')}</FormAlert> : null}
      <Field
        label={t('login.identifier')}
        name="identifier"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        error={fieldErrors.identifier}
      />
      <Field
        label={t('fields.password')}
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldErrors.password}
      />
      <TurnstileWidget />
      {formError ? <FormAlert kind="error">{formError}</FormAlert> : null}
      <Button
        type="submit"
        loading={pending}
        loadingLabel={t('login.loading')}
        success={success}
        successLabel={t('login.done')}
      >
        {t('login.submit')}
      </Button>
      <p className="text-sm">
        <Link
          href="/forgot-password"
          className="text-bleu-600 hover:text-bleu-700 -my-2 inline-flex min-h-11 min-w-11 items-center justify-center font-semibold underline-offset-4 hover:underline"
        >
          {t('login.forgot')}
        </Link>
      </p>
    </form>
  );
}
