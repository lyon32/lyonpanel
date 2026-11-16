import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminSessionExpired } from './admin-session';
import { createAdminClient } from '@/server/db/supabase-admin';
import { createSessionClient } from '@/server/db/supabase-server';
import { apiError } from '@/server/http/api-error';

/**
 * Premier niveau : le compte est l'administrateur, actif, session de moins de 12 h.
 * Tout le reste (visiteur, client, admin bloqué ou sans session valide) reçoit NOT_FOUND :
 * l'existence des routes admin ne doit jamais se deviner (jamais 403).
 * Ne vérifie PAS le code à 6 chiffres : sert à la connexion et à l'enrôlement des appareils.
 */
export async function requireAdminUser(): Promise<{ id: string; supabase: SupabaseClient }> {
  let userId: string | null = null;
  let supabase: SupabaseClient | null = null;
  try {
    supabase = (await createSessionClient()) as unknown as SupabaseClient;
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      const signedInAt = data.user.last_sign_in_at;
      // Ceinture et bretelles : Supabase coupe déjà la session à 12 h (timebox).
      if (!signedInAt || !isAdminSessionExpired(signedInAt)) userId = data.user.id;
    }
  } catch {
    // Cookie invalide ou Supabase injoignable : même issue qu'un visiteur.
  }
  if (!userId || !supabase) apiError('NOT_FOUND');

  const { data: profile, error } = await createAdminClient()
    .from('profiles')
    .select('is_admin, status')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);
  if (!profile?.is_admin || profile.status !== 'active') apiError('NOT_FOUND');
  return { id: userId, supabase };
}

/**
 * Garde de toutes les routes /api/v1/admin/* : administrateur ET code à 6 chiffres confirmé (aal2).
 * - aal1 avec un appareil déjà enregistré : MFA_REQUIRED (401), pour afficher la saisie du code ;
 * - aal1 sans aucun appareil : NOT_FOUND, comme pour un inconnu (l'enrôlement passe par requireAdminUser).
 */
export async function requireAdmin(): Promise<{ id: string }> {
  const { id, supabase } = await requireAdminUser();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) apiError('NOT_FOUND');
  if (data.currentLevel === 'aal2') return { id };
  if (data.nextLevel === 'aal2') apiError('MFA_REQUIRED');
  apiError('NOT_FOUND');
}
