'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const POLL_MS = 30_000;

/**
 * Tant qu'une commande n'est pas finale, demande au serveur de recalculer la page toutes les 30 s
 * (les statuts sont lus côté serveur, rien n'est chargé ici). Rien n'est demandé onglet caché.
 */
export function useOrderPolling(isFinal: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (isFinal) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isFinal, router]);
}
