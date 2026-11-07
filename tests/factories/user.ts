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
  const n = `${Date.now() % 100000}${counter}`;
  const email = overrides.email ?? `client-${n}@lyonpanel.test`;
  const suffix = `${String(Date.now() % 1000).padStart(3, '0')}${String(counter).padStart(3, '0')}`;
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
