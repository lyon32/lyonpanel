import { adminClient, TEST_PASSWORD } from '../db/helpers/client';

let counter = 0;

export type TestUser = { id: string; email: string; phone: string };

export type UserOverrides = { email?: string; phone?: string; password?: string };

/** Crée un vrai utilisateur auth (le déclencheur de 1.2 créera profil et portefeuille). */
export async function makeUser(overrides: UserOverrides = {}): Promise<TestUser> {
  counter += 1;
  const n = `${Date.now() % 100000}${counter}`;
  const email = overrides.email ?? `client-${n}@lyonpanel.test`;
  const phone = overrides.phone ?? `+237600000${String(counter).padStart(3, '0')}`;
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    phone,
    password: overrides.password ?? TEST_PASSWORD,
    email_confirm: true,
    phone_confirm: true,
  });
  if (error || !data.user) throw new Error(`makeUser a échoué : ${error?.message}`);
  return { id: data.user.id, email, phone };
}
