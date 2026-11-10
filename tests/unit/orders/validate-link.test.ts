import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { validateLink } from '@/server/orders/validate-link';

/*
 * Signature attendue (LLD §4.3), fichier src/server/orders/validate-link.ts :
 *   validateLink(platform: Network, link: string): { ok: true } | { ok: false; reason: 'INVALID_LINK' }
 *   Network = type de '@/server/catalog/labels' ('tiktok', 'instagram', 'x', 'web_traffic', ...)
 * Règles choisies pour ces tests :
 *   - espaces autour du lien ignorés ; espace DANS le lien = refusé ;
 *   - http:// et https:// acceptés ; lien sans schéma (« tiktok.com/@x ») accepté ;
 *   - le nom de domaine doit être exactement le domaine de la plateforme ou l'un de ses sous-domaines
 *     (« nottiktok.com » et « tiktok.com.evil.com » refusés) ; schémas javascript:, data:, ftp: refusés ;
 *   - web_traffic : n'importe quelle adresse http(s) valide ;
 *   - longueur maximale 2 048 caractères.
 */

const ok = { ok: true };
const bad = { ok: false, reason: 'INVALID_LINK' };

describe('validateLink : bonne plateforme', () => {
  it.each([
    ['tiktok', 'https://www.tiktok.com/@client/video/7300000000000000000'],
    ['tiktok', 'https://vm.tiktok.com/ZMabc123/'],
    ['tiktok', 'https://tiktok.com/@client'],
    ['instagram', 'https://www.instagram.com/p/Cabc123/'],
    ['instagram', 'https://instagr.am/p/Cabc123/'],
    ['facebook', 'https://www.facebook.com/client.page'],
    ['facebook', 'https://fb.watch/abc123/'],
    ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['youtube', 'https://youtu.be/dQw4w9WgXcQ'],
    ['telegram', 'https://t.me/canal_client'],
    ['x', 'https://x.com/client/status/1'],
    ['x', 'https://twitter.com/client/status/1'],
    ['threads', 'https://www.threads.net/@client'],
    ['twitch', 'https://www.twitch.tv/client'],
    ['kick', 'https://kick.com/client'],
    ['linkedin', 'https://www.linkedin.com/in/client'],
    ['pinterest', 'https://www.pinterest.com/client/'],
    ['spotify', 'https://open.spotify.com/track/abc'],
    ['whatsapp', 'https://whatsapp.com/channel/abc'],
    ['discord', 'https://discord.gg/abc'],
    ['soundcloud', 'https://soundcloud.com/client/titre'],
    ['web_traffic', 'https://www.mon-site-client.cm/page?a=1'],
  ] as const)('accepte %s : %s', (platform, link) => {
    expect(validateLink(platform, link)).toEqual(ok);
  });

  it('accepte http:// (pas seulement https://)', () => {
    expect(validateLink('tiktok', 'http://www.tiktok.com/@client')).toEqual(ok);
  });

  it('ignore les espaces autour du lien', () => {
    expect(validateLink('tiktok', '  https://www.tiktok.com/@client \n')).toEqual(ok);
  });

  it('accepte un lien sans schéma (tiktok.com/@client)', () => {
    expect(validateLink('tiktok', 'tiktok.com/@client')).toEqual(ok);
    expect(validateLink('instagram', 'www.instagram.com/client')).toEqual(ok);
  });

  it('ne tient pas compte des majuscules du nom de domaine', () => {
    expect(validateLink('tiktok', 'https://WWW.TikTok.com/@client')).toEqual(ok);
  });
});

describe('validateLink : refus (INVALID_LINK)', () => {
  it('refuse le lien d une autre plateforme (Instagram sur un service TikTok)', () => {
    expect(validateLink('tiktok', 'https://www.instagram.com/p/Cabc123/')).toEqual(bad);
    expect(validateLink('instagram', 'https://www.tiktok.com/@client')).toEqual(bad);
    expect(validateLink('youtube', 'https://t.me/canal_client')).toEqual(bad);
  });

  it.each([
    'https://nottiktok.com/@client',
    'https://tiktok.com.evil.example/@client',
    'https://evil.example/?u=https://www.tiktok.com/@client',
    'https://evil.example/tiktok.com',
    'https://user@evil.example/@tiktok.com',
  ])('refuse un faux domaine : %s', (link) => {
    expect(validateLink('tiktok', link)).toEqual(bad);
  });

  it.each([
    ['texte libre', 'bonjour je veux des abonnés'],
    ['vide', ''],
    ['espaces seulement', '   '],
    ['nom d utilisateur seul', '@client'],
    ['espace dans le lien', 'https://www.tiktok.com/@cli ent'],
    ['javascript:', 'javascript:alert(1)//tiktok.com'],
    ['data:', 'data:text/html,tiktok.com'],
    ['ftp', 'ftp://tiktok.com/@client'],
  ])('refuse un lien invalide : %s', (_label, link) => {
    expect(validateLink('tiktok', link)).toEqual(bad);
  });

  it('refuse un lien trop long (plus de 2 048 caractères)', () => {
    expect(validateLink('tiktok', `https://www.tiktok.com/@${'a'.repeat(2100)}`)).toEqual(bad);
  });

  it('web_traffic refuse quand même ce qui n est pas une adresse http(s)', () => {
    expect(validateLink('web_traffic', 'pas une url')).toEqual(bad);
    expect(validateLink('web_traffic', 'javascript:alert(1)')).toEqual(bad);
  });
});
