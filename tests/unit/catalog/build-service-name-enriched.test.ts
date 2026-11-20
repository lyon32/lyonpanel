import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildServiceName, type NameableService } from '@/server/catalog/build-name';
import { classifyNetwork, classifyType } from '@/server/catalog/classify';

// Noms enrichis (décision 2026-11-17). Mesure de départ sur l'échantillon (FR, sans « #id ») :
// 141 noms distincts sur 160 (88 %). On exige une amélioration claire : au moins 95 % (152 sur 160).
type Raw = {
  service: number;
  name: string;
  type: string;
  min: number | string;
  max: number | string;
  dripfeed: boolean;
  refill: boolean;
  cancel: boolean;
  category: string;
};
const sample = JSON.parse(
  readFileSync('tests/fixtures/provider-services-sample.json', 'utf8'),
) as Raw[];
const nameable = (s: Raw): NameableService => ({
  id: s.service,
  platform: classifyNetwork(s.name, s.category),
  category: classifyType(s.name, s.type),
  refill: s.refill,
  cancel: s.cancel,
  dripfeed: s.dripfeed,
  min_qty: Number(s.min),
  max_qty: Number(s.max),
  providerName: s.name,
  providerCategory: s.category,
});
const bare = (n: NameableService, l: 'fr' | 'en') =>
  buildServiceName(n, l).replace(`#${n.id}`, '').trim();

const base: NameableService = {
  id: 36784,
  platform: 'tiktok',
  category: 'likes',
  refill: true,
  cancel: true,
  dripfeed: false,
  min_qty: 10,
  max_qty: 5000000,
  providerName: 'TikTok Likes [ Max 5M ] | Cancel Enable | 90 Days ♻️ | Instant Start | Day 50K 🚀',
  providerCategory: 'TikTok Likes',
};

describe('buildServiceName enrichi', () => {
  it.each(['fr', 'en'] as const)(
    'au moins 95 pour cent de noms distincts sur l échantillon (%s)',
    (l) => {
      const distinct = new Set(sample.map((s) => bare(nameable(s), l))).size;
      expect(distinct).toBeGreaterThanOrEqual(Math.ceil(sample.length * 0.95));
    },
  );

  it('extrait la vitesse par jour quand elle est annoncée', () => {
    expect(bare(base, 'fr')).toMatch(/50\s?K/);
    const alt = { ...base, providerName: 'Instagram Followers [Real] [1K/D] [0-1/H]' };
    expect(bare(alt, 'en')).toMatch(/1\s?K/);
  });

  it('extrait le maximum annoncé quand il diffère du maximum technique', () => {
    const n = { ...base, providerName: 'TikTok Likes [ Max 5M ]', max_qty: 2147483647 };
    expect(bare(n, 'en')).toMatch(/5\s?M/);
  });

  it('deux services qui ne diffèrent que par la vitesse ont deux noms différents', () => {
    const a = { ...base, providerName: 'TikTok Likes [Real] [1K/D]' };
    const b = { ...base, providerName: 'TikTok Likes [Real] [10K/D]' };
    for (const l of ['fr', 'en'] as const) expect(bare(a, l)).not.toBe(bare(b, l));
  });

  it.each(['fr', 'en'] as const)('au plus 95 caractères avant « #id » (%s)', (l) => {
    for (const s of sample) {
      const n = nameable(s);
      expect(bare(n, l).length, `service ${s.service}`).toBeLessThanOrEqual(95);
      expect(buildServiceName(n, l).endsWith(`#${n.id}`)).toBe(true);
    }
  });

  it('ne laisse fuiter ni emoji, ni crochets, ni nom du fournisseur', () => {
    for (const s of sample)
      expect(bare(nameable(s), 'en'), `service ${s.service}`).not.toMatch(
        /peakerr|provider|[[\]|]|\p{Extended_Pictographic}|♻|️/iu,
      );
  });
});
