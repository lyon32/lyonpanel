'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { FormAlert } from './form-alert';
import { SelectField } from './select-field';
import { TurnstileWidget } from './turnstile-widget';
import { textOf, useAuthForm } from './use-auth-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useRouter } from '@/i18n/navigation';
import { AFRICAN_COUNTRIES } from '@/lib/countries';
import { cn } from '@/lib/cn';

const CURRENCIES = ['XAF', 'XOF', 'USD'] as const;
const STEP_ONE_FIELDS = ['email', 'phone', 'password'];

// Sur téléphone, le formulaire tient en deux étapes courtes (pas de défilement) ;
// sur ordinateur, tous les champs sont visibles d'un coup (`lg:`).
function StepItem({
  step,
  current,
  className,
  children,
}: {
  step: 1 | 2;
  current: 1 | 2;
  className: string;
  children: ReactNode;
}) {
  return (
    <div data-step={step} className={cn(className, step !== current && 'max-lg:hidden')}>
      {children}
    </div>
  );
}

export function RegisterForm({ referralCode }: { referralCode?: string }) {
  const t = useTranslations('auth');
  const tc = useTranslations('currency');
  const tl = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  // Calculé une seule fois par langue : la liste des pays ne change pas.
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return AFRICAN_COUNTRIES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    );
  }, [locale]);

  const { pending, success, formError, fieldErrors, setFieldErrors, fieldMessage, handleSubmit } =
    useAuthForm({
      path: 'register',
      buildBody: (form, lang) => {
        const referral = textOf(form, 'referral_code').trim();
        return {
          email: textOf(form, 'email'),
          phone: textOf(form, 'phone'),
          password: textOf(form, 'password'),
          country: textOf(form, 'country'),
          display_currency: textOf(form, 'display_currency'),
          language: textOf(form, 'language') || lang,
          ...(referral ? { referral_code: referral } : {}),
          turnstile_token: textOf(form, 'cf-turnstile-response'),
        };
      },
      onSuccess: () => {
        router.push('/dashboard');
        router.refresh();
      },
    });

  // Une erreur du serveur sur un champ de l'étape 1 ramène à l'étape 1.
  const [seenErrors, setSeenErrors] = useState(fieldErrors);
  if (seenErrors !== fieldErrors) {
    setSeenErrors(fieldErrors);
    if (STEP_ONE_FIELDS.some((name) => fieldErrors[name])) setStep(1);
  }

  // Focus : premier champ en erreur, ou premier champ de l'étape affichée après un changement.
  const focusStep = useRef(false);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (focusStep.current) {
      focusStep.current = false;
      form
        .querySelector<HTMLElement>(
          `[data-step="${step}"] input:not([type="hidden"]), [data-step="${step}"] [data-field]`,
        )
        ?.focus({ preventScroll: true });
      return;
    }
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus({ preventScroll: true });
  }, [step, fieldErrors]);

  function isDesktop() {
    return window.matchMedia('(min-width: 1024px)').matches;
  }

  // Étape 1 → 2 : on vérifie que les trois champs sont remplis avant de continuer.
  function goNext() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const errors: Record<string, string> = {};
    if (!form.querySelector<HTMLInputElement>('[name="email"]')?.checkValidity()) {
      errors.email = fieldMessage('INVALID_EMAIL');
    }
    if (!textOf(data, 'phone').trim()) errors.phone = fieldMessage('INVALID_PHONE');
    if (!textOf(data, 'password')) errors.password = fieldMessage('PASSWORD_REQUIRED');
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    focusStep.current = true;
    setStep(2);
  }

  function goBack() {
    focusStep.current = true;
    setStep(1);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // « Entrée » à l'étape 1 sur téléphone : on passe à l'étape 2 au lieu d'envoyer.
    if (step === 1 && !isDesktop()) {
      event.preventDefault();
      goNext();
      return;
    }
    // Pays obligatoire : erreur immédiate, sans aller-retour avec le serveur.
    if (!textOf(new FormData(event.currentTarget), 'country')) {
      event.preventDefault();
      setFieldErrors({ country: fieldMessage('INVALID_COUNTRY') });
      return;
    }
    void handleSubmit(event);
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-3"
      noValidate
      data-step-current={step}
    >
      <div className="flex flex-col gap-1.5 lg:hidden">
        <p className="text-gris-600 text-sm font-semibold" aria-live="polite">
          {t('register.step', { current: step, total: 2 })}
        </p>
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="bg-bleu-600 h-1 flex-1 rounded-full" />
          <span
            className={cn('h-1 flex-1 rounded-full', step === 2 ? 'bg-bleu-600' : 'bg-gris-200')}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StepItem step={1} current={step} className="col-span-2 lg:col-span-3">
          <Field
            label={t('fields.email')}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            error={fieldErrors.email}
          />
        </StepItem>
        <StepItem step={1} current={step} className="col-span-2 lg:col-span-3">
          <Field
            label={t('fields.phone')}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+237612345678"
            required
            error={fieldErrors.phone}
          />
        </StepItem>
        <StepItem step={1} current={step} className="col-span-2 lg:col-span-3">
          <Field
            label={t('fields.password')}
            hint={fieldErrors.password ? undefined : t('fields.passwordHint')}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            error={fieldErrors.password}
          />
        </StepItem>
        <StepItem step={2} current={step} className="col-span-2 lg:col-span-3">
          <SelectField
            label={t('fields.country')}
            name="country"
            options={countries.map(({ code, name }) => ({ value: code, label: name }))}
            placeholder={t('fields.countryPlaceholder')}
            searchPlaceholder={t('fields.countrySearch')}
            noResultsLabel={t('fields.countryNone')}
            error={fieldErrors.country}
          />
        </StepItem>
        <StepItem step={2} current={step} className="col-span-1 lg:col-span-2">
          <SelectField
            label={t('fields.currency')}
            name="display_currency"
            defaultValue="XAF"
            options={CURRENCIES.map((code) => ({ value: code, label: tc(code), short: code }))}
            error={fieldErrors.display_currency}
          />
        </StepItem>
        <StepItem step={2} current={step} className="col-span-1 lg:col-span-2">
          <SelectField
            label={t('fields.language')}
            name="language"
            defaultValue={locale}
            options={[
              { value: 'fr', label: tl('fr') },
              { value: 'en', label: tl('en') },
            ]}
            error={fieldErrors.language}
          />
        </StepItem>
        <StepItem step={2} current={step} className="col-span-2 lg:col-span-2">
          <Field
            label={t('register.referralLabel')}
            name="referral_code"
            defaultValue={referralCode ?? ''}
            autoComplete="off"
            error={fieldErrors.referral_code}
          />
        </StepItem>
      </div>
      <div className={cn(step === 1 && 'max-lg:hidden')}>
        <TurnstileWidget />
      </div>
      {formError ? <FormAlert kind="error">{formError}</FormAlert> : null}
      <div className="flex gap-3">
        {step === 2 ? (
          <Button type="button" variant="secondary" onClick={goBack} className="lg:hidden">
            {t('register.back')}
          </Button>
        ) : null}
        {step === 1 ? (
          <Button
            type="button"
            data-testid="register-next"
            onClick={goNext}
            className="flex-1 lg:hidden"
          >
            {t('register.next')}
          </Button>
        ) : null}
        <Button
          type="submit"
          className={cn('flex-1', step === 1 && 'max-lg:hidden')}
          loading={pending}
          loadingLabel={t('register.loading')}
          success={success}
          successLabel={t('register.done')}
        >
          {t('register.submit')}
        </Button>
      </div>
    </form>
  );
}
