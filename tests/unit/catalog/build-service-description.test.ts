import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildServiceDescription } from '@/server/catalog/build-description';
import { buildServiceName, type NameableService } from '@/server/catalog/build-name';
import { classifyNetwork, classifyType } from '@/server/catalog/classify';

// Signature attendue (src/server/catalog/build-description.ts) :
//   buildServiceDescription(service: NameableService, locale: 'fr' | 'en'): string
// Texte écrit par nous, jamais recopié du fournisseur. Pas de temps moyen (non fourni par l'API).

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
const digits = (t: string) => t.replace(/[\s  ,.]/g, '');

const tiktok: NameableService = {
  id: 36784,
  platform: 'tiktok',
  category: 'likes',
  refill: true,
  cancel: true,
  dripfeed: false,
  min_qty: 10,
  max_qty: 5000000,
  providerName:
    'TikTok Likes [ Max 5M ] | Hidden Account | Cancel Enable | 90 Days ♻️ | Instant Start | Day 50K 🚀',
  providerCategory: 'TikTok Likes',
};
const FORBIDDEN =
  /peakerr|justanotherpanel|\bjap\b|provider|fournisseur|cancel enable|hidden account|[[\]|]|\$|\busd\b|\p{Extended_Pictographic}|♻|🚀|️/iu;

describe('buildServiceDescription : faits propres au service', () => {
  it.each(['fr', 'en'] as const)('mentionne garantie, démarrage, vitesse et min–max (%s)', (l) => {
    const d = buildServiceDescription(tiktok, l);
    expect(d).toMatch(/90/);
    expect(d).toMatch(l === 'fr' ? /jours/i : /days/i);
    expect(d).toMatch(l === 'fr' ? /instantan/i : /instant/i);
    expect(d).toMatch(/50\s?K|50[\s  ]?000/);
    expect(digits(d)).toContain('10');
    expect(digits(d)).toContain('5000000');
  });

  it.each(['fr', 'en'] as const)('mentionne la chute annoncée (%s)', (l) => {
    const noDrop = {
      ...tiktok,
      providerName: 'Instagram Followers [Real] [No Drop] [30 Days Refill]',
    };
    const lowDrop = {
      ...tiktok,
      providerName: 'Instagram Followers [Real] [Low Drop] [30 Days Refill]',
    };
    const a = buildServiceDescription(noDrop, l);
    const b = buildServiceDescription(lowDrop, l);
    expect(a).toMatch(l === 'fr' ? /sans chute|aucune chute/i : /no drop|without drop/i);
    expect(b).toMatch(l === 'fr' ? /chute faible|faible chute/i : /low drop/i);
    expect(b).not.toBe(a);
  });

  it('exprime les options refill, annulation et goutte-à-goutte selon les drapeaux', () => {
    const none = {
      ...tiktok,
      refill: false,
      cancel: false,
      dripfeed: false,
      providerName: 'TikTok Likes',
    };
    const all = { ...none, refill: true, cancel: true, dripfeed: true };
    expect(buildServiceDescription(all, 'fr')).not.toBe(buildServiceDescription(none, 'fr'));
    expect(buildServiceDescription(all, 'en')).toMatch(/refill/i);
    expect(buildServiceDescription(all, 'en')).toMatch(/cancel/i);
    expect(buildServiceDescription(all, 'en')).toMatch(/drip/i);
    expect(buildServiceDescription(none, 'en')).not.toMatch(/refill|cancel|drip/i);
  });

  it('donne deux descriptions différentes à deux services aux faits différents', () => {
    const b = { ...tiktok, providerName: 'TikTok Likes [30 Days Refill] [1K/D]', max_qty: 20000 };
    for (const l of ['fr', 'en'] as const)
      expect(buildServiceDescription(b, l)).not.toBe(buildServiceDescription(tiktok, l));
  });

  it('est écrite dans la langue demandée', () => {
    expect(buildServiceDescription(tiktok, 'fr')).not.toBe(buildServiceDescription(tiktok, 'en'));
    expect(buildServiceDescription(tiktok, 'fr')).not.toMatch(/\b(refill|instant start)\b/i);
  });

  it('reste valide sans nom ni catégorie fournisseur (pas vide, min–max présents)', () => {
    const bare = { ...tiktok, providerName: undefined, providerCategory: undefined };
    for (const l of ['fr', 'en'] as const) {
      const d = buildServiceDescription(bare, l);
      expect(d.trim().length).toBeGreaterThan(0);
      expect(digits(d)).toContain('5000000');
    }
  });
});

describe('buildServiceDescription : échantillon réel (160 services)', () => {
  it.each(['fr', 'en'] as const)(
    'jamais vide, ≤ 400 caractères, sans texte fournisseur (%s)',
    (l) => {
      for (const s of sample) {
        const d = buildServiceDescription(nameable(s), l);
        expect(d.trim().length, `service ${s.service}`).toBeGreaterThan(0);
        expect(d.length, `service ${s.service}`).toBeLessThanOrEqual(400);
        expect(d, `service ${s.service}`).not.toMatch(FORBIDDEN);
      }
    },
  );

  it.each(['fr', 'en'] as const)(
    'plus de 90 pour cent de couples (nom, description) distincts (%s)',
    (l) => {
      const pairs = new Set(
        sample.map((s) => {
          const n = nameable(s);
          const name = buildServiceName(n, l).replace(`#${n.id}`, '').trim();
          return `${name}||${buildServiceDescription(n, l)}`;
        }),
      );
      expect(pairs.size).toBeGreaterThan(sample.length * 0.9);
    },
  );

  it('ne recopie aucune étiquette entre crochets ou barres du nom fournisseur', () => {
    for (const s of sample) {
      const d = buildServiceDescription(nameable(s), 'en').toLowerCase();
      const parts = s.name
        .split(/[|[\]]/)
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 12);
      for (const part of parts) expect(d, `service ${s.service}`).not.toContain(part);
    }
  });
});
