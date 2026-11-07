import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';

// Messages définis ici : les tests ne dépendent pas de src/messages.
export const testMessages = {
  nav: {
    home: 'Accueil',
    services: 'Services',
    blog: 'Blog',
    login: 'Connexion',
    register: 'Inscription',
    newOrder: 'Nouvelle commande',
    orders: 'Commandes',
    addFunds: 'Recharger',
    referral: 'Parrainage',
    support: 'Support',
    account: 'Compte',
    bottomOrder: 'Commander',
    mainLabel: 'Navigation principale',
    appLabel: 'Espace client',
    bottomLabel: 'Menu du bas',
  },
  footer: {
    privacy: 'Confidentialité',
    terms: 'Conditions',
    contact: 'Contact',
    label: 'Pied de page',
  },
  language: { label: 'Langue', fr: 'Français', en: 'English' },
  currency: { label: 'Devise' },
};

export function renderIntl(ui: ReactElement, locale = 'fr') {
  return render(
    <NextIntlClientProvider locale={locale} messages={testMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}
