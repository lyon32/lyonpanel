import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { requireAdmin } from '@/server/auth/require-admin';
import { ApiError } from '@/server/http/api-error';

/**
 * Garde des pages admin : administrateur actif ET code à 6 chiffres confirmé (aal2).
 * Tout refus (visiteur, client, session expirée, code manquant) = 404, jamais de redirection
 * vers la connexion : l'existence des pages ne doit pas se deviner.
 * `cache` : layout et page partagent un seul contrôle par requête.
 */
export const requireAdminPage = cache(async (): Promise<{ id: string }> => {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof ApiError) notFound();
    throw error;
  }
});
