'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { getGreetingKey } from '@/lib/greeting';

const subscribe = () => () => {};

// Côté client : heure locale de l'appareil. Côté serveur (et hydratation) : null,
// donc « Bonjour » neutre, car l'heure du serveur (UTC) serait fausse en Afrique.
export function Greeting() {
  const t = useTranslations('dashboard.greeting');
  const hour = useSyncExternalStore(
    subscribe,
    () => new Date().getHours(),
    () => null,
  );
  return (
    <h1 className="text-gris-900 text-2xl font-semibold" suppressHydrationWarning>
      {t(hour === null ? 'morning' : getGreetingKey(hour))}
    </h1>
  );
}
