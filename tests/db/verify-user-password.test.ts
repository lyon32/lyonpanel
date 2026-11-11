import { createClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { makeUser, removeUser } from '../factories/user';
import { adminClient, TEST_PASSWORD, userClient } from './helpers/client';

const db = adminClient();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await removeUser(id);
});

async function verify(user: string, password: string) {
  return db.rpc('verify_user_password', { p_user: user, p_password: password });
}

describe('verify_user_password', () => {
  it('bon mot de passe → true', async () => {
    const u = await makeUser();
    created.push(u.id);
    const { data, error } = await verify(u.id, TEST_PASSWORD);
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it('mauvais mot de passe → false', async () => {
    const u = await makeUser();
    created.push(u.id);
    expect((await verify(u.id, 'mauvais-mot-de-passe')).data).toBe(false);
  });

  it('utilisateur inconnu → false', async () => {
    const { data, error } = await verify('00000000-0000-4000-8000-000000000000', TEST_PASSWORD);
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it('mot de passe vide → false', async () => {
    const u = await makeUser();
    created.push(u.id);
    expect((await verify(u.id, '')).data).toBe(false);
  });

  it('clé anon refusée', async () => {
    const u = await makeUser();
    created.push(u.id);
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await anon.rpc('verify_user_password', {
      p_user: u.id,
      p_password: TEST_PASSWORD,
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('client authentifié refusé', async () => {
    const u = await makeUser();
    created.push(u.id);
    const client = await userClient(u.id);
    const { data, error } = await client.rpc('verify_user_password', {
      p_user: u.id,
      p_password: TEST_PASSWORD,
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
