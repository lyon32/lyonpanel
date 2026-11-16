'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { adminFetch, asMfaStatus } from './admin-api';
import { CodeStep, EnrollStep } from './admin-mfa-steps';
import { FormAlert } from '@/components/auth/form-alert';
import { TurnstileWidget, resetTurnstile } from '@/components/auth/turnstile-widget';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { postAuth } from '@/lib/auth-client';

type Step = 'password' | 'code' | 'enroll';

// Connexion de l'admin en 3 temps : mot de passe, code à 6 chiffres, puis (une seule fois) 2 appareils.
export function AdminLogin({ adminPath }: { adminPath: string }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [step, setStep] = useState<Step>('password');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  // Décide l'étape suivante d'après l'état réel côté serveur.
  async function next() {
    const res = await adminFetch('/api/v1/admin/mfa/status', 'GET');
    const status = res.ok ? asMfaStatus(res.data) : null;
    if (!status) {
      // Compte ordinaire connecté par erreur : on le déconnecte et on reste neutre.
      await postAuth('logout', null, locale);
      setError(true);
      setStep('password');
      return;
    }
    if (status.verified === 0) setStep('enroll');
    else if (!status.aal2) setStep('code');
    else if (status.needsMoreDevices) setStep('enroll');
    else window.location.assign(`/${adminPath}/stats`);
  }

  async function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(false);
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === 'string' ? value : '';
    };
    const result = await postAuth(
      'login',
      {
        identifier: text('email'),
        password: text('password'),
        turnstile_token: text('cf-turnstile-response'),
      },
      locale,
    );
    if (result.ok) await next();
    else {
      // Message unique : rien ne dit si c'est l'adresse ou le mot de passe qui est faux.
      setError(true);
      resetTurnstile();
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-encre text-2xl font-bold">{t('title')}</h1>
      {step === 'password' ? (
        <form
          onSubmit={handlePassword}
          className="flex flex-col gap-3"
          noValidate
          data-testid="admin-login-form"
        >
          <Field
            label={t('email')}
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            data-testid="admin-email"
          />
          <Field
            label={t('password')}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            data-testid="admin-password"
          />
          <TurnstileWidget />
          {error ? (
            <div data-testid="admin-error">
              <FormAlert kind="error">{t('error')}</FormAlert>
            </div>
          ) : null}
          <Button
            type="submit"
            loading={pending}
            loadingLabel={t('loading')}
            data-testid="admin-submit"
          >
            {t('submit')}
          </Button>
        </form>
      ) : null}
      {step === 'code' ? <CodeStep onDone={next} /> : null}
      {step === 'enroll' ? <EnrollStep onDone={next} /> : null}
    </div>
  );
}
