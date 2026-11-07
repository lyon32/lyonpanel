/*
 * Limites connues de ces fabriques :
 * - removeUser échoue en silence quand des lignes de journal immuables
 *   (wallet_transactions, audit_log) référencent l'utilisateur : c'est voulu.
 * - Les comptes de test s'accumulent donc dans la base locale.
 * - Les tests utilisent des valeurs uniques (email, téléphone, ref) : ils ne
 *   dépendent pas de l'état restant.
 * - Lancer `supabase db reset` de temps en temps pour repartir d'une base propre.
 */
import { randomInt } from 'node:crypto';
import { adminClient, TEST_PASSWORD } from '../db/helpers/client';

let counter = 0;

export type TestUser = { id: string; email: string; phone: string };

export type UserOverrides = {
  email?: string;
  phone?: string;
  password?: string;
  country?: string; // code ISO, défaut CM
  language?: 'fr' | 'en';
  referral?: string; // referral_code du parrain
};

/**
 * Crée un vrai utilisateur auth. Le déclencheur de 1.2 crée profil et portefeuille.
 * Contrat : auth.users.email / auth.users.phone + raw_user_meta_data { country, language, referral }.
 */
export async function makeUser(overrides: UserOverrides = {}): Promise<TestUser> {
  counter += 1;
  const n = `${process.pid}-${Date.now() % 100000}-${counter}-${randomInt(1000)}`;
  const email = overrides.email ?? `client-${n}@lyonpanel.test`;
  // +237600 + 6 chiffres : aléa (1 000 000 valeurs) mêlé au compteur et au processus.
  const suffix = String(
    (randomInt(1_000_000) + counter * 7919 + process.pid * 104729) % 1_000_000,
  ).padStart(6, '0');
  const phone = overrides.phone ?? `+237600${suffix}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    phone,
    password: overrides.password ?? TEST_PASSWORD,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      country: overrides.country ?? 'CM',
      language: overrides.language ?? 'fr',
      ...(overrides.referral ? { referral: overrides.referral } : {}),
    },
  });
  if (error || !data.user) throw new Error(`makeUser a échoué : ${error?.message}`);
  return { id: data.user.id, email, phone };
}

/** Supprime un faux client (cascade sur profil et portefeuille). */
export async function removeUser(id: string): Promise<void> {
  await adminClient().auth.admin.deleteUser(id);
}
