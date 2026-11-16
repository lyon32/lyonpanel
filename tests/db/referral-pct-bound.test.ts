import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminClient } from './helpers/client';

/*
 * Borne de settings.referral_pct (phase 11, décision 4a) : un nombre entre 0 et 100, vérifié PAR LA BASE
 * (contrainte ou déclencheur sur settings, clé « referral_pct »), quel que soit le chemin d'écriture.
 * Une valeur refusée ne change rien. Les autres clés de settings ne sont pas concernées.
 */

const db = adminClient();
let before: unknown;
const read = async () =>
  (await db.from('settings').select('value').eq('key', 'referral_pct').single()).data!.value;
const write = (value: unknown) => db.from('settings').upsert({ key: 'referral_pct', value });

beforeAll(async () => {
  await write(5);
  before = await read();
});
afterAll(async () => {
  await write(5);
});

describe('settings.referral_pct borné à 0..100 en base', () => {
  it.each([0, 5, 12.5, 100])('accepte %j', async (v) => {
    expect((await write(v)).error).toBeNull();
    expect(await read()).toBe(v);
  });

  it.each([-1, -0.01, 100.01, 101, 1000])('refuse %j et garde l’ancienne valeur', async (v) => {
    await write(5);
    const { error } = await write(v);
    expect(error).not.toBeNull();
    expect(await read()).toBe(5);
  });

  it.each([['"abc"'], [null], [true], [[5]], [{ pct: 5 }]])(
    'refuse une valeur qui n’est pas un nombre (%j)',
    async (v) => {
      await write(5);
      const { error } = await write(v);
      expect(error).not.toBeNull();
      expect(await read()).toBe(5);
    },
  );

  it('refuse aussi une modification (update) hors bornes', async () => {
    await write(5);
    const { error } = await db.from('settings').update({ value: 250 }).eq('key', 'referral_pct');
    expect(error).not.toBeNull();
    expect(await read()).toBe(5);
  });

  it('les autres réglages ne sont pas touchés par la borne (ex. multiplicateur à 4)', async () => {
    const key = 'default_multiplier';
    const old = (await db.from('settings').select('value').eq('key', key).single()).data!.value;
    expect((await db.from('settings').upsert({ key, value: 4 })).error).toBeNull();
    await db.from('settings').upsert({ key, value: old });
  });

  it('la valeur de départ était bien valide (le test n’a rien laissé de cassé)', () => {
    expect(before).toBe(5);
  });
});
