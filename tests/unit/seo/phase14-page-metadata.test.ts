import { describe, expect, it } from 'vitest';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

const title = 'Abonnés TikTok en Mobile Money | LyonPanel';
const description =
  'Achetez des abonnés, likes et vues TikTok et Instagram. Paiement Mobile Money en XAF, commande en quelques clics sur LyonPanel.';
const base = { path: '/services/tiktok', title, description, ogImage: '/og/tiktok.png' };
const off = {}; // non indexable
const on = { SITE_INDEXABLE: 'true' };

describe('buildPageMetadata', () => {
  it('canonical absolu sur la langue courante', () => {
    expect(buildPageMetadata({ ...base, lang: 'en' }, on).alternates?.canonical).toBe(
      'https://lyonpanel.com/en/services/tiktok',
    );
  });
  it("canonical de l'accueil sans slash final", () => {
    const m = buildPageMetadata({ ...base, path: '', lang: 'fr' }, on);
    expect(m.alternates?.canonical).toBe('https://lyonpanel.com/fr');
  });
  it('hreflang fr, en et x-default = fr', () => {
    const m = buildPageMetadata({ ...base, lang: 'en' }, on);
    expect(m.alternates?.languages).toEqual({
      fr: 'https://lyonpanel.com/fr/services/tiktok',
      en: 'https://lyonpanel.com/en/services/tiktok',
      'x-default': 'https://lyonpanel.com/fr/services/tiktok',
    });
  });
  it('Open Graph complet avec image 1200x630', () => {
    const og = buildPageMetadata({ ...base, lang: 'fr' }, on).openGraph as Record<string, unknown>;
    expect(og).toMatchObject({
      title,
      description,
      url: 'https://lyonpanel.com/fr/services/tiktok',
      siteName: 'LyonPanel',
      locale: 'fr_FR',
      type: 'website',
    });
    expect(og.images).toEqual([
      expect.objectContaining({
        url: 'https://lyonpanel.com/og/tiktok.png',
        width: 1200,
        height: 630,
      }),
    ]);
  });
  it('locale Open Graph en_US en anglais', () => {
    const og = buildPageMetadata({ ...base, lang: 'en' }, on).openGraph as { locale: string };
    expect(og.locale).toBe('en_US');
  });
  it('Twitter summary_large_image avec image absolue', () => {
    const tw = buildPageMetadata({ ...base, lang: 'fr' }, on).twitter as Record<string, unknown>;
    expect(tw).toMatchObject({ card: 'summary_large_image', title, description });
    expect(JSON.stringify(tw.images)).toContain('https://lyonpanel.com/og/');
  });
  it('robots noindex, nofollow tant que non indexable', () => {
    expect(buildPageMetadata({ ...base, lang: 'fr' }, off).robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
  it('robots index, follow quand indexable', () => {
    expect(buildPageMetadata({ ...base, lang: 'fr' }, on).robots).toMatchObject({
      index: true,
      follow: true,
    });
  });
  it('refuse un titre de plus de 60 caractères', () => {
    const long = `${title} ${'x'.repeat(30)}`;
    expect(() => buildPageMetadata({ ...base, lang: 'fr', title: long }, on)).toThrow();
  });
  it('refuse une description hors 70 à 160 caractères', () => {
    expect(() =>
      buildPageMetadata({ ...base, lang: 'fr', description: 'trop court' }, on),
    ).toThrow();
    expect(() =>
      buildPageMetadata({ ...base, lang: 'fr', description: 'x'.repeat(161) }, on),
    ).toThrow();
  });
  it('exige le nom de marque dans le titre', () => {
    expect(() => buildPageMetadata({ ...base, lang: 'fr', title: 'Abonnés TikTok' }, on)).toThrow(
      /LyonPanel/,
    );
  });
});
