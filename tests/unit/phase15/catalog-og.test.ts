import { describe, expect, it } from 'vitest';
import { catalogMetadata } from '@/lib/seo/catalog-seo';

describe('catalogMetadata : image de partage (phase 15.2)', () => {
  it('référence /og/default.png en 1200x630 et summary_large_image', () => {
    const m = catalogMetadata({
      lang: 'en',
      path: '/services/tiktok',
      title: 'TikTok services – LyonPanel',
      description: 'd',
    });
    const img = (
      m.openGraph?.images as { url: string; width: number; height: number; alt: string }[]
    )[0];
    expect(img?.url).toBe('https://lyonpanel.com/og/default.png');
    expect(img?.width).toBe(1200);
    expect(img?.height).toBe(630);
    expect(img?.alt).toBe('TikTok services – LyonPanel');
    expect((m.twitter as { card: string }).card).toBe('summary_large_image');
    expect(JSON.stringify(m.twitter)).toContain('https://lyonpanel.com/og/default.png');
  });
});
