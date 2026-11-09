import { describe, expect, it } from 'vitest';
import { resolveMultiplier } from '@/server/pricing/multipliers';

// Règle : surcharge du service > règle (réseau, type) > multiplicateur par défaut (réglage).
const rules = [
  { platform: 'tiktok', category: 'followers', multiplier: 4 },
  { platform: 'instagram', category: 'likes', multiplier: 2.5 },
];
const base = { platform: 'tiktok', category: 'followers', rules, defaultMultiplier: 3 };

describe('resolveMultiplier', () => {
  it('prend la surcharge du service avant tout le reste', () => {
    expect(resolveMultiplier({ ...base, override: 7 })).toBe(7);
  });

  it("prend la règle (réseau, type) quand le service n'a pas de surcharge", () => {
    expect(resolveMultiplier({ ...base, override: null })).toBe(4);
    expect(resolveMultiplier({ ...base })).toBe(4);
  });

  it('prend le multiplicateur par défaut quand aucune règle ne correspond', () => {
    expect(resolveMultiplier({ ...base, platform: 'youtube', category: 'views' })).toBe(3);
    expect(resolveMultiplier({ ...base, category: 'likes' })).toBe(3);
    expect(resolveMultiplier({ ...base, rules: [] })).toBe(3);
  });

  it("une règle ne s'applique qu'au couple exact réseau + type", () => {
    expect(resolveMultiplier({ ...base, platform: 'instagram', category: 'likes' })).toBe(2.5);
    expect(resolveMultiplier({ ...base, platform: 'instagram', category: 'followers' })).toBe(3);
  });

  it('suit le multiplicateur par défaut quand il change (jamais en dur)', () => {
    expect(resolveMultiplier({ ...base, rules: [], defaultMultiplier: 5 })).toBe(5);
    expect(resolveMultiplier({ ...base, rules: [], defaultMultiplier: 1.5 })).toBe(1.5);
  });

  it('accepte une surcharge décimale', () => {
    expect(resolveMultiplier({ ...base, override: 2.75 })).toBe(2.75);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuse une surcharge invalide (%s)',
    (override) => {
      expect(() => resolveMultiplier({ ...base, override })).toThrow();
    },
  );

  it.each([0, -3, Number.NaN])('refuse un multiplicateur par défaut invalide (%s)', (d) => {
    expect(() => resolveMultiplier({ ...base, rules: [], defaultMultiplier: d })).toThrow();
  });

  it.each([0, -2, Number.NaN])('refuse une règle au multiplicateur invalide (%s)', (m) => {
    const bad = [{ platform: 'tiktok', category: 'followers', multiplier: m }];
    expect(() => resolveMultiplier({ ...base, rules: bad })).toThrow();
  });
});
