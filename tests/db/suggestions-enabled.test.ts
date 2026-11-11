import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUsers, makeFundedUser } from '../helpers/orders-db';
import { adminClient, userClient } from './helpers/client';

/*
 * Colonne attendue (migration lp-db) : profiles.suggestions_enabled boolean not null default true.
 * Un client ne peut modifier que la sienne (RLS profiles_update_own).
 */

const created: string[] = [];
afterEach(() => cleanupUsers(created));

const enabledOf = async (id: string) =>
  (await adminClient().from('profiles').select('suggestions_enabled').eq('id', id).single()).data
    ?.suggestions_enabled;

describe('profiles.suggestions_enabled', () => {
  it('existe et vaut true par défaut pour un nouveau client', async () => {
    const u = await makeFundedUser(created);
    const { data, error } = await adminClient()
      .from('profiles')
      .select('suggestions_enabled')
      .eq('id', u.id)
      .single();
    expect(error).toBeNull();
    expect(data?.suggestions_enabled).toBe(true);
  });

  it('refuse la valeur null', async () => {
    const u = await makeFundedUser(created);
    const { error } = await adminClient()
      .from('profiles')
      .update({ suggestions_enabled: null })
      .eq('id', u.id);
    expect(error?.code).toBe('23502'); // not_null_violation
  });

  it("un client ne peut pas modifier la colonne d'un autre client", async () => {
    const a = await makeFundedUser(created);
    const b = await makeFundedUser(created);
    const client = await userClient(a.id);
    await client.from('profiles').update({ suggestions_enabled: false }).eq('id', b.id);
    expect(await enabledOf(b.id)).toBe(true);
  });
});
