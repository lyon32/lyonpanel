'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { adminFetch, apiErrorMessage, type AdminResponse } from './admin-api';

export type ActionFeedback = { kind: 'error' | 'success'; text: string } | null;

// Envoie une action admin, affiche le résultat, puis recharge les données de la page (serveur).
export function useAdminAction(texts: { error: string; success: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback>(null);

  async function run(
    path: string,
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
    onDone?: (res: AdminResponse) => string | null,
  ) {
    setPending(true);
    setFeedback(null);
    const res = await adminFetch(path, method, body);
    if (res.ok) {
      setFeedback({ kind: 'success', text: onDone?.(res) ?? texts.success });
      router.refresh();
    } else {
      setFeedback({ kind: 'error', text: apiErrorMessage(res.data) ?? texts.error });
    }
    setPending(false);
    return res;
  }

  return { pending, feedback, run };
}
