import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const load = (l: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), 'src/messages', `${l}.json`), 'utf8'));

function flatten(obj: unknown, prefix = ''): Record<string, unknown> {
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    return Object.entries(obj).reduce<Record<string, unknown>>(
      (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
      {},
    );
  }
  return { [prefix]: obj };
}

describe('messages fr/en', () => {
  const fr = flatten(load('fr'));
  const en = flatten(load('en'));

  it('contiennent au moins une clé', () => {
    expect(Object.keys(fr).length).toBeGreaterThan(0);
  });
  it('ont exactement les mêmes clés', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });
  it.each([
    ['fr', fr],
    ['en', en],
  ] as const)('%s : aucune valeur vide', (_l, msgs) => {
    const empty = Object.entries(msgs).filter(([, v]) => typeof v !== 'string' || v.trim() === '');
    expect(empty.map(([k]) => k)).toEqual([]);
  });
});
