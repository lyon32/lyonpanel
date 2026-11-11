'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { getGreetingKey } from '@/lib/greeting';

const subscribe = () => () => {};

// Côté client : heure locale de l'appareil. Côté serveur (et hydratation) : null,
// donc « Bonjour » neutre, car l'heure du serveur (UTC) serait fausse en Afrique.
export function Greeting({ name }: { name?: string }) {
  const t = useTranslations('dashboard.greeting');
  const hour = useSyncExternalStore(
    subscribe,
    () => new Date().getHours(),
    () => null,
  );
  const word = t(hour === null ? 'morning' : getGreetingKey(hour));
  return (
    <h1 className="text-encre text-2xl font-bold md:text-3xl" suppressHydrationWarning>
      {name ? `${word}, ${name}` : word}
    </h1>
  );
}
