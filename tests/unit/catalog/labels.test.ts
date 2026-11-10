import { describe, expect, it } from 'vitest';
import { NETWORKS, SERVICE_TYPES, networkLabel, typeLabel } from '@/server/catalog/labels';

// Module attendu : src/server/catalog/labels.ts
//   NETWORKS, SERVICE_TYPES : listes de constantes (identifiants de code, en anglais)
//   networkLabel(network, locale) / typeLabel(type, locale) : libellés affichés

describe('identifiants de réseaux et de types', () => {
  it('liste exactement les 17 réseaux décidés', () => {
    expect([...NETWORKS].sort()).toEqual(
      [
        'instagram',
        'tiktok',
        'facebook',
        'youtube',
        'telegram',
        'x',
        'kick',
        'threads',
        'twitch',
        'linkedin',
        'pinterest',
        'spotify',
        'whatsapp',
        'discord',
        'soundcloud',
        'web_traffic',
        'other',
      ].sort(),
    );
  });

  it('liste exactement les 6 types décidés', () => {
    expect([...SERVICE_TYPES].sort()).toEqual(
      ['comments', 'followers', 'likes', 'other', 'shares', 'views'].sort(),
    );
  });
});

describe('libellés', () => {
  it('traduit les types en français et en anglais', () => {
    expect(typeLabel('followers', 'fr')).toBe('Abonnés');
    expect(typeLabel('followers', 'en')).toBe('Followers');
  });

  it('donne un libellé non vide, distinct par type, dans chaque langue', () => {
    for (const locale of ['fr', 'en'] as const) {
      const labels = SERVICE_TYPES.map((t) => typeLabel(t, locale));
      for (const l of labels) expect(l.trim().length).toBeGreaterThan(0);
      expect(new Set(labels).size).toBe(SERVICE_TYPES.length);
    }
  });

  it('donne un libellé non vide, distinct par réseau, dans chaque langue', () => {
    for (const locale of ['fr', 'en'] as const) {
      const labels = NETWORKS.map((n) => networkLabel(n, locale));
      for (const l of labels) expect(l.trim().length).toBeGreaterThan(0);
      expect(new Set(labels).size).toBe(NETWORKS.length);
    }
  });

  it('écrit les marques avec leur graphie officielle', () => {
    expect(networkLabel('tiktok', 'fr')).toBe('TikTok');
    expect(networkLabel('youtube', 'en')).toBe('YouTube');
    expect(networkLabel('instagram', 'fr')).toBe('Instagram');
  });

  it('traduit « autres réseaux »', () => {
    expect(networkLabel('other', 'fr')).toBe('Autres réseaux');
    expect(networkLabel('other', 'en')).toMatch(/other/i);
  });

  it('ne cite jamais le fournisseur', () => {
    for (const locale of ['fr', 'en'] as const) {
      for (const n of NETWORKS)
        expect(networkLabel(n, locale)).not.toMatch(/peakerr|jap|provider|fournisseur/i);
      for (const t of SERVICE_TYPES)
        expect(typeLabel(t, locale)).not.toMatch(/peakerr|jap|provider|fournisseur/i);
    }
  });
});
