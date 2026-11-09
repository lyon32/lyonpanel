'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { AuthCard } from './auth-card';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

const noop = () => () => {};

// Paramètres d'adresse (?reset=1, ?ref=CODE) lus côté navigateur : la carte est gardée par le
// layout, elle ne reçoit pas les paramètres de page. Côté serveur : chaîne vide.
function useQuery(name: string): string {
  const search = useSyncExternalStore(
    noop,
    () => window.location.search,
    () => '',
  );
  return new URLSearchParams(search).get(name) ?? '';
}

// Connexion et inscription sont affichées par la carte elle-même : le changement d'écran
// ne dépend ainsi ni du réseau ni du rendu de la nouvelle page.
export function LoginLayer() {
  const t = useTranslations('auth');
  const resetDone = useQuery('reset') === '1';
  return (
    <AuthCard title={t('login.title')} intro={t('login.intro')}>
      <LoginForm resetDone={resetDone} />
    </AuthCard>
  );
}

export function RegisterLayer() {
  const t = useTranslations('auth');
  const ref = useQuery('ref').slice(0, 32);
  return (
    <AuthCard compactOnPhone title={t('register.title')} intro={t('register.intro')}>
      <RegisterForm key={ref} referralCode={ref || undefined} />
    </AuthCard>
  );
}
