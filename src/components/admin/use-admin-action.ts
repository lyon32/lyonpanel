'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { adminFetch, apiErrorMessage, type AdminResponse } from './admin-api';

export type ActionFeedback = { kind: 'error' | 'success'; text: string } | null;

// Le bandeau de succès disparaît seul après quelques secondes.
const SUCCESS_DISPLAY_MS = 4000;

// Envoie une action admin, affiche le résultat, puis recharge les données de la page (serveur).
export function useAdminAction(texts: { error: string; success: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback>(null);
  const timer = useRef<number | undefined>(undefined);

  async function run(
    path: string,
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
    onDone?: (res: AdminResponse) => string | null,
  ) {
    setPending(true);
    window.clearTimeout(timer.current);
    setFeedback(null);
    const res = await adminFetch(path, method, body);
    if (res.ok) {
      setFeedback({ kind: 'success', text: onDone?.(res) ?? texts.success });
      timer.current = window.setTimeout(() => setFeedback(null), SUCCESS_DISPLAY_MS);
      router.refresh();
    } else {
      setFeedback({ kind: 'error', text: apiErrorMessage(res.data) ?? texts.error });
    }
    setPending(false);
    return res;
  }

  return { pending, feedback, run };
}
