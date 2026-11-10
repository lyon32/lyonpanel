import { describe, expect, it } from 'vitest';
import { loadProviderFixture } from '../../helpers/provider-fixture';
import { classifyNetwork, classifyType } from '@/server/catalog/classify';
import { buildServiceName } from '@/server/catalog/build-name';
import { networkLabel, typeLabel, type Network, type ServiceType } from '@/server/catalog/labels';

// Signature attendue (module src/server/catalog/build-name.ts) :
//   buildServiceName(service: NameableService, locale: 'fr' | 'en'): string
// avec NameableService = { id, platform, category, refill, cancel, dripfeed, min_qty, max_qty }
// (les champs de la vue services_public : le nom se reconstruit sans jamais voir le nom du fournisseur).

const base = {
  id: 31579,
  platform: 'telegram' as Network,
  category: 'followers' as ServiceType,
  refill: true,
  cancel: true,
  dripfeed: false,
  min_qty: 10,
  max_qty: 500000,
};

const FORBIDDEN =
  /peakerr|justanotherpanel|\bjap\b|provider|fournisseur|[[\]|]|\$|\busd\b|\bxaf\b|fcfa|&amp;|\bmq\b|max\s*:|min\s*:/i;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\u{1D400}-\u{1D7FF}]|️/u;

function strip(name: string, id: number): string {
  return name.replace(`#${id}`, '').trim();
}

describe('buildServiceName', () => {
  it('commence par « <Type> <Réseau> » dans la langue demandée', () => {
    expect(
      buildServiceName(base, 'fr').startsWith(
        `${typeLabel('followers', 'fr')} ${networkLabel('telegram', 'fr')}`,
      ),
    ).toBe(true);
    expect(
      buildServiceName(base, 'en').startsWith(
        `${typeLabel('followers', 'en')} ${networkLabel('telegram', 'en')}`,
      ),
    ).toBe(true);
  });

  it('contient le numéro #id', () => {
    expect(buildServiceName(base, 'fr')).toContain('#31579');
    expect(buildServiceName({ ...base, id: 7 }, 'en')).toContain('#7');
  });

  it('est déterministe', () => {
    expect(buildServiceName(base, 'fr')).toBe(buildServiceName({ ...base }, 'fr'));
    expect(buildServiceName(base, 'en')).toBe(buildServiceName({ ...base }, 'en'));
  });

  it('donne un nom français différent du nom anglais', () => {
    expect(buildServiceName(base, 'fr')).not.toBe(buildServiceName(base, 'en'));
  });

  it('distingue la recharge, l annulation et le goutte-à-goutte (hors numéro)', () => {
    const names = [
      strip(buildServiceName(base, 'fr'), base.id),
      strip(buildServiceName({ ...base, refill: false }, 'fr'), base.id),
      strip(buildServiceName({ ...base, cancel: false }, 'fr'), base.id),
      strip(buildServiceName({ ...base, dripfeed: true }, 'fr'), base.id),
    ];
    expect(new Set(names).size).toBe(4);
    const namesEn = [
      strip(buildServiceName(base, 'en'), base.id),
      strip(buildServiceName({ ...base, refill: false }, 'en'), base.id),
      strip(buildServiceName({ ...base, cancel: false }, 'en'), base.id),
      strip(buildServiceName({ ...base, dripfeed: true }, 'en'), base.id),
    ];
    expect(new Set(namesEn).size).toBe(4);
  });

  it('donne deux noms différents à deux services qui ne diffèrent que par le numéro', () => {
    expect(buildServiceName({ ...base, id: 1 }, 'fr')).not.toBe(
      buildServiceName({ ...base, id: 2 }, 'fr'),
    );
  });

  it.each([
    ['tiktok', 'likes'],
    ['instagram', 'views'],
    ['other', 'other'],
    ['web_traffic', 'other'],
    ['x', 'comments'],
  ] as const)('contient le libellé du réseau et du type (%s / %s)', (platform, category) => {
    for (const locale of ['fr', 'en'] as const) {
      const name = buildServiceName({ ...base, platform, category }, locale);
      expect(name).toContain(networkLabel(platform, locale));
      expect(name).toContain(typeLabel(category, locale));
    }
  });
});

describe('buildServiceName : jamais de fuite ni de bruit (vrais services)', () => {
  const all = loadProviderFixture();

  it('ne contient ni nom du fournisseur, ni prix, ni étiquette entre crochets ou barres, ni emoji', () => {
    for (const s of all) {
      const nameable = {
        id: s.service,
        platform: classifyNetwork(s.name, s.category),
        category: classifyType(s.name, s.type),
        refill: s.refill,
        cancel: s.cancel,
        dripfeed: s.dripfeed,
        min_qty: Number(s.min),
        max_qty: Number(s.max),
      };
      for (const locale of ['fr', 'en'] as const) {
        const name = buildServiceName(nameable, locale);
        expect(name, `service ${s.service}`).not.toMatch(FORBIDDEN);
        expect(name, `service ${s.service}`).not.toMatch(EMOJI);
        expect(name, `service ${s.service}`).not.toMatch(
          /\d+(\.\d+)?\s*(\$|usd|xaf|fcfa)|(\$|usd)\s*\d/i,
        );
        expect(name, `service ${s.service}`).toContain(`#${s.service}`);
        expect(name, `service ${s.service}`).not.toBe(s.name);
        expect(name.length, `service ${s.service}`).toBeLessThanOrEqual(80);
      }
    }
  });

  it('ne reprend aucun morceau du nom brut (même accidentellement)', () => {
    const s = all.find((x) => x.service === 19928)!; // catégorie « PEAKERR EXCLUSIVE », « &amp; Emojis »
    const name = buildServiceName(
      {
        id: s.service,
        platform: 'instagram',
        category: 'comments',
        refill: false,
        cancel: false,
        dripfeed: false,
        min_qty: 10,
        max_qty: 50,
      },
      'en',
    );
    expect(name.toLowerCase()).not.toContain('peakerr');
    expect(name.toLowerCase()).not.toContain('exclusive');
    expect(name.toLowerCase()).not.toContain('emojis');
    expect(name).not.toContain('MQ');
  });

  it.each(['$1.00', '0.5$', '[Max: 1M]', '| MQ 500K'])(
    'aucun motif « %s » dans les noms construits',
    (pattern) => {
      for (const s of all) {
        const name = buildServiceName(
          {
            id: s.service,
            platform: classifyNetwork(s.name, s.category),
            category: classifyType(s.name, s.type),
            refill: s.refill,
            cancel: s.cancel,
            dripfeed: s.dripfeed,
            min_qty: Number(s.min),
            max_qty: Number(s.max),
          },
          'fr',
        );
        expect(name).not.toContain(pattern);
      }
    },
  );
});
