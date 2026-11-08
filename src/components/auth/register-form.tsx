'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormAlert } from './form-alert';
import { SelectField } from './select-field';
import { TurnstileWidget } from './turnstile-widget';
import { textOf, useAuthForm } from './use-auth-form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Link, useRouter } from '@/i18n/navigation';
import { AFRICAN_COUNTRIES } from '@/lib/countries';

const CURRENCIES = ['XAF', 'XOF', 'USD'] as const;

export function RegisterForm({ referralCode }: { referralCode?: string }) {
  const t = useTranslations('auth');
  const tc = useTranslations('currency');
  const tl = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const countries = AFRICAN_COUNTRIES.map((code) => ({ code, name: names.of(code) ?? code })).sort(
    (a, b) => a.name.localeCompare(b.name, locale),
  );

  const { pending, formError, fieldErrors, handleSubmit } = useAuthForm({
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Field
        label={t('fields.email')}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        error={fieldErrors.email}
      />
      <Field
        label={t('fields.phone')}
        hint={t('fields.phoneHint')}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        error={fieldErrors.phone}
      />
      <Field
        label={t('fields.password')}
        hint={t('fields.passwordHint')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors.password}
      />
      <SelectField
        label={t('fields.country')}
        name="country"
        required
        defaultValue=""
        error={fieldErrors.country}
      >
        <option value="" disabled>
          {t('fields.countryPlaceholder')}
        </option>
        {countries.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t('fields.currency')}
        name="display_currency"
        defaultValue="XAF"
        error={fieldErrors.display_currency}
      >
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {tc(code)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t('fields.language')}
        name="language"
        defaultValue={locale}
        error={fieldErrors.language}
      >
        <option value="fr">{tl('fr')}</option>
        <option value="en">{tl('en')}</option>
      </SelectField>
      <Field
        label={t('register.referralLabel')}
        name="referral_code"
        defaultValue={referralCode ?? ''}
        autoComplete="off"
        error={fieldErrors.referral_code}
      />
      <TurnstileWidget />
      {formError ? <FormAlert kind="error">{formError}</FormAlert> : null}
      <Button type="submit" loading={pending} loadingLabel={t('submitting')}>
        {t('register.submit')}
      </Button>
      <p className="text-gris-600 text-sm">
        {t('register.haveAccount')}{' '}
        <Link
          href="/login"
          className="text-bleu-600 hover:text-bleu-700 -my-2 inline-flex min-h-11 min-w-11 items-center justify-center font-semibold underline-offset-4 hover:underline"
        >
          {t('register.loginLink')}
        </Link>
      </p>
    </form>
  );
}
