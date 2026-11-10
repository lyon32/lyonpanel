'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const POLL_MS = 5_000;
const MAX_WAIT_MS = 10 * 60 * 1000;

/**
 * Tant que le paiement est en attente, demande au serveur de recalculer la page toutes les 5 s
 * (le statut est lu côté serveur, rien n'est chargé ici). S'arrête dès qu'un statut final est
 * atteint ou après 10 min ; renvoie alors `timedOut` pour inviter le client à revenir plus tard.
 */
export function usePaymentStatus(isFinal: boolean): { timedOut: boolean } {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isFinal) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        window.clearInterval(timer);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isFinal, router]);

  return { timedOut };
}
