import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exists, read } from '../home/helpers';
import { DEFAULT_OG_IMAGE, buildPageMetadata } from '@/lib/seo/page-metadata';

const OG = 'public/og/default.png';

describe('image de partage (phase 15.2)', () => {
  it('public/og/default.png existe', () => {
    expect(exists(OG)).toBe(true);
  });
  it('c’est un vrai PNG de 1200 x 630', () => {
    const b = readFileSync(OG);
    expect(b.subarray(1, 4).toString()).toBe('PNG');
    expect(b.readUInt32BE(16)).toBe(1200);
    expect(b.readUInt32BE(20)).toBe(630);
  });
  it('les métadonnées Open Graph et Twitter la référencent', () => {
    const m = buildPageMetadata(
      {
        lang: 'fr',
        path: '',
        title: 'LyonPanel : panel SMM pour l’Afrique',
        description:
          'Abonnés, likes et vues pour TikTok et Instagram, payés en Mobile Money, livrés vite et sans surprise.',
      },
      { NEXT_PUBLIC_SITE_URL: 'https://lyonpanel.com' },
    );
    expect(DEFAULT_OG_IMAGE).toBe('/og/default.png');
    expect(JSON.stringify(m.openGraph)).toContain('/og/default.png');
    expect(JSON.stringify(m.twitter)).toContain('/og/default.png');
  });
});

describe('logo en palette sombre (phase 15.2)', () => {
  for (const f of ['public/brand/01-horizontal.svg', 'public/brand/02-icone.svg']) {
    it(`${f} utilise #425EFF / #D7D7DA / #111111 et plus l’ancien bleu ni le jaune`, () => {
      const svg = read(f);
      expect(svg).toMatch(/#425EFF/i);
      expect(svg).toMatch(/#D7D7DA/i);
      expect(svg).toMatch(/#111111/i);
      expect(svg).not.toMatch(/#1D4ED8|#D9A23B|#0E1726/i);
    });
  }
});
