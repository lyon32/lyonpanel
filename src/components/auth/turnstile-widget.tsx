'use client';

import Script from 'next/script';
import { useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, options: { sitekey: string }) => string;
  reset: () => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Un jeton Turnstile ne sert qu'une fois : après un échec, on relance la vérification.
export function resetTurnstile() {
  window.turnstile?.reset();
}

// Seule la clé publique est utilisée ici ; le champ caché « cf-turnstile-response » est créé par Cloudflare.
export function TurnstileWidget() {
  const container = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  // onReady s'exécute à chaque affichage du composant, même si le script est déjà chargé.
  function renderWidget() {
    if (rendered.current || !container.current || !window.turnstile || !siteKey) return;
    rendered.current = true;
    window.turnstile.render(container.current, { sitekey: siteKey });
  }

  // Sans clé publique (développement), pas de widget : inutile de réserver 65 px de vide.
  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={container} className="min-h-[65px]" />
    </>
  );
}
