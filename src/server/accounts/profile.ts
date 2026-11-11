import 'server-only';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';
import type { PatchMeInput } from '@/server/schemas/account';
import { getWallet } from '@/server/wallet/wallet';

const COLUMNS =
  'id, email, phone, country, display_currency, language, referral_code, suggestions_enabled, created_at';

export interface Me {
  id: string;
  email: string | null;
  phone: string | null;
  country: string;
  display_currency: 'XAF' | 'XOF' | 'USD';
  language: string;
  referral_code: string;
  suggestions_enabled: boolean;
  discount_pct: number;
  created_at: string;
}

/** Profil public du client : liste blanche de colonnes, jamais statut, rôle ni remise personnalisée brute. */
export async function getMe(userId: string): Promise<Me> {
  const { data, error } = await createAdminClient()
    .from('profiles')
    .select(COLUMNS)
    .eq('id', userId)
    .single();
  if (error) throw new Error(`profiles: ${error.message}`);
  const { discount_pct } = await getWallet(userId);
  return { ...data, discount_pct };
}

/**
 * Modifie les champs autorisés. Écrit avec le client service : la RLS n'ouvre au client que `language`,
 * et le téléphone doit aussi suivre dans la connexion (auth). Le corps a déjà été filtré par Zod.
 */
export async function updateMe(userId: string, input: PatchMeInput): Promise<Me> {
  const db = createAdminClient();
  let previousPhone: string | null = null;
  if (input.phone !== undefined) {
    const { data } = await db.from('profiles').select('phone').eq('id', userId).single();
    previousPhone = data?.phone ?? null;
  }

  const { error } = await db.from('profiles').update(input).eq('id', userId);
  if (error) {
    // 23505 : le téléphone appartient déjà à un autre profil (index unique).
    if (error.code === '23505') apiError('PHONE_TAKEN', { fields: { phone: 'PHONE_TAKEN' } });
    throw new Error(`profiles: ${error.message}`);
  }

  if (input.phone !== undefined) {
    const { error: authError } = await db.auth.admin.updateUserById(userId, {
      phone: input.phone,
      phone_confirm: true,
    });
    if (authError) {
      // Profil et connexion ne doivent jamais diverger : on remet l'ancien numéro.
      await db.from('profiles').update({ phone: previousPhone }).eq('id', userId);
      if (authError.code === 'phone_exists')
        apiError('PHONE_TAKEN', { fields: { phone: 'PHONE_TAKEN' } });
      throw new Error(`auth phone: ${authError.message}`);
    }
  }
  return getMe(userId);
}
