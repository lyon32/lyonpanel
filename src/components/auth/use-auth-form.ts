'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { resetTurnstile } from './turnstile-widget';
import { postAuth } from '@/lib/auth-client';

type Options = {
  path: string;
  // Construit le corps snake_case de l'API à partir des champs du formulaire.
  buildBody: (form: FormData, locale: string) => Record<string, unknown>;
  onSuccess: () => void;
  // Faux pour un formulaire qui reste affiché après succès (le bouton se réactive).
  keepSuccess?: boolean;
};

// Durée de la coche avant la suite (redirection) : sous les 600 ms demandés.
const SUCCESS_DELAY_MS = 450;

// Logique commune des formulaires : envoi, état d'attente, erreurs par champ.
export function useAuthForm({ path, buildBody, onSuccess, keepSuccess = true }: Options) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Le serveur renvoie un code par champ ; on l'affiche dans la langue du site.
  function fieldMessage(code: string): string {
    return t.has(`fieldErrors.${code}`) ? t(`fieldErrors.${code}`) : code;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});
    const body = buildBody(new FormData(event.currentTarget), locale);
    const result = await postAuth(path, body, locale);
    setPending(false);
    if (result.ok) {
      setSuccess(true);
      window.setTimeout(() => {
        onSuccess();
        if (!keepSuccess) setSuccess(false);
      }, SUCCESS_DELAY_MS);
      return;
    }
    resetTurnstile();
    const { error } = result;
    if (!error) {
      setFormError(t('networkError'));
      return;
    }
    const { turnstile_token: turnstileCode, _: generalCode, ...inputs } = error.fields;
    const names = Object.keys(inputs);
    if (names.length > 0) {
      setFieldErrors(
        Object.fromEntries(names.map((name) => [name, fieldMessage(inputs[name] ?? name)])),
      );
    }
    // Message général seulement s'il n'y a pas d'erreur de champ à montrer.
    if (turnstileCode) setFormError(fieldMessage(turnstileCode));
    else if (generalCode) setFormError(fieldMessage(generalCode));
    else if (names.length === 0) setFormError(error.message || t('networkError'));
  }

  return { pending, success, formError, fieldErrors, setFieldErrors, fieldMessage, handleSubmit };
}

export function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
