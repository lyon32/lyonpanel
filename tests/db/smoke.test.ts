import { describe, expect, it } from 'vitest';
import { adminClient, userClient } from './helpers/client';

// Test de fumée : prouve que l'outillage atteint la base Supabase locale.
describe('base de données locale', () => {
  it('se connecte à la base locale et lit settings', async () => {
    const { data, error } = await adminClient().from('settings').select('key').limit(1);
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it('expose un client utilisateur distinct du client admin', () => {
    expect(typeof userClient).toBe('function');
    expect(typeof adminClient).toBe('function');
  });
});
