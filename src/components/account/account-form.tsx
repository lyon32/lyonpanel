'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { ActionButton } from '@/components/shared/action-button';
import { InlineAlert } from '@/components/shared/inline-alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from '@/i18n/navigation';
import { setCurrencyCookie } from '@/lib/actions/currency';
import { callApi } from '@/lib/api-client';
import { CURRENCIES, parseCurrency, type Currency } from '@/lib/currency';

type Props = {
  email: string | null;
  currency: Currency;
  language: 'fr' | 'en';
  phone: string | null;
  suggestionsEnabled: boolean;
};

const SELECT_CLASS =
  'border-gris-200 bg-blanc text-encre focus-visible:border-bleu-600 focus-visible:ring-bleu-100 min-h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-4';

// Préférences du compte : un seul bouton enregistre ce qui a changé (PATCH /me).
export function AccountForm(props: Props) {
  const t = useTranslations('account');
  const tc = useTranslations('currency');
  const tl = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  const ids = { currency: useId(), language: useId(), phone: useId(), suggestions: useId() };
  const [currency, setCurrency] = useState<Currency>(props.currency);
  const [language, setLanguage] = useState(props.language);
  const [phone, setPhone] = useState(props.phone ?? '');
  const [suggestions, setSuggestions] = useState(props.suggestionsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setPhoneError(null);
    const body: Record<string, unknown> = {};
    if (currency !== props.currency) body.display_currency = currency;
    if (language !== props.language) body.language = language;
    if (phone.trim() && phone.trim() !== (props.phone ?? '')) body.phone = phone.trim();
    if (suggestions !== props.suggestionsEnabled) body.suggestions_enabled = suggestions;
    if (Object.keys(body).length === 0) return;
    const result = await callApi('PATCH', '/api/v1/me', body, locale);
    if (!result.ok) {
      const code = result.fields.phone ?? (result.code === 'PHONE_TAKEN' ? 'PHONE_TAKEN' : null);
      if (code === 'PHONE_TAKEN' || code === 'INVALID_PHONE')
        setPhoneError(t(`phoneErrors.${code}`));
      else setError(result.message || t('saveError'));
      throw new Error(result.code);
    }
    // La devise d'en-tête vient d'un cookie d'affichage : on l'aligne sur le profil.
    if (body.display_currency) await setCurrencyCookie(parseCurrency(currency));
    if (body.language && language !== locale) router.replace('/account', { locale: language });
    else router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('preferences')}</CardTitle>
        {props.email ? <CardDescription>{props.email}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.currency} className="text-encre text-sm font-medium">
              {t('currency')}
            </label>
            <select
              id={ids.currency}
              data-testid="account-currency"
              value={currency}
              onChange={(e) => setCurrency(parseCurrency(e.target.value))}
              className={SELECT_CLASS}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {tc(c)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.language} className="text-encre text-sm font-medium">
              {t('language')}
            </label>
            <select
              id={ids.language}
              data-testid="account-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value === 'en' ? 'en' : 'fr')}
              className={SELECT_CLASS}
            >
              <option value="fr">{tl('fr')}</option>
              <option value="en">{tl('en')}</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.phone} className="text-encre text-sm font-medium">
            {t('phone')}
          </label>
          <Input
            id={ids.phone}
            data-testid="account-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? `${ids.phone}-error` : undefined}
            onChange={(e) => setPhone(e.target.value)}
          />
          {phoneError ? (
            <p id={`${ids.phone}-error`} role="alert" className="text-erreur text-sm">
              {phoneError}
            </p>
          ) : (
            <p className="text-gris-600 text-xs">{t('phoneHint')}</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p id={ids.suggestions} className="text-encre text-sm font-medium">
              {t('suggestions')}
            </p>
            <p className="text-gris-600 text-xs">{t('suggestionsHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={suggestions}
            aria-labelledby={ids.suggestions}
            data-testid="account-suggestions"
            onClick={() => setSuggestions((v) => !v)}
            className="focus-visible:ring-bleu-100 inline-flex min-h-11 min-w-14 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-4"
          >
            <span
              aria-hidden="true"
              className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-150 ease-out motion-reduce:transition-none ${suggestions ? 'bg-bleu-600' : 'bg-gris-200'}`}
            >
              <span
                className={`bg-blanc size-5 rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none ${suggestions ? 'translate-x-5' : ''}`}
              />
            </span>
          </button>
        </div>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <div>
          <ActionButton
            data-testid="account-save"
            onAction={save}
            label={t('save')}
            loadingLabel={t('saving')}
            successLabel={t('saved')}
            className="w-full sm:w-auto"
          />
        </div>
      </CardContent>
    </Card>
  );
}
