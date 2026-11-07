import { describe, expect, it } from 'vitest';
import { scrubEvent } from '@/lib/sentry-scrub';

describe('scrubEvent', () => {
  it('supprime user.email, user.ip_address et user.phone', () => {
    const out = scrubEvent({
      user: {
        id: 'u1',
        email: 'client-1@lyonpanel.test',
        ip_address: '1.2.3.4',
        phone: '+237600000001',
      },
    });
    expect(out.user?.email).toBeUndefined();
    expect(out.user?.ip_address).toBeUndefined();
    expect(out.user?.phone).toBeUndefined();
  });

  it('supprime les en-têtes Authorization et Cookie et les cookies', () => {
    const out = scrubEvent({
      request: {
        headers: { Authorization: 'Bearer x', Cookie: 'a=b', 'user-agent': 'ua' },
        cookies: { a: 'b' },
      },
    });
    const keys = Object.keys(out.request?.headers ?? {}).map((k) => k.toLowerCase());
    expect(keys).not.toContain('authorization');
    expect(keys).not.toContain('cookie');
    expect(out.request?.cookies).toBeUndefined();
  });

  it('supprime le corps des requêtes', () => {
    const out = scrubEvent({ request: { data: { phone: '+237600000001', amountXaf: 5000 } } });
    expect(out.request?.data).toBeUndefined();
  });

  it('masque un email et un numéro +237… dans le message', () => {
    const out = scrubEvent({
      message: 'Échec pour client-1@lyonpanel.test au +237600000001',
    });
    expect(out.message).toBe('Échec pour [email] au [téléphone]');
  });

  it('ne garde que user.id (username, clés en casse différente)', () => {
    const out = scrubEvent({
      user: { id: 'u1', username: 'jean', IP_ADDRESS: '1.2.3.4', Phone: '+237677123456' },
    });
    expect(out.user).toEqual({ id: 'u1' });
  });

  it('applique une liste blanche aux en-têtes, sans tenir compte de la casse', () => {
    const out = scrubEvent({
      request: {
        headers: {
          'X-Api-Key': 'k',
          'Proxy-Authorization': 'p',
          'X-Forwarded-For': '1.2.3.4',
          Referer: 'https://a.test/?email=a@b.co',
          'User-Agent': 'ua',
          'Accept-Language': 'fr',
        },
      },
    });
    expect(out.request?.headers).toEqual({ 'User-Agent': 'ua', 'Accept-Language': 'fr' });
  });

  it('retire query_string et nettoie la query de request.url', () => {
    const out = scrubEvent({
      request: {
        url: 'https://lyonpanel.com/a?email=x@y.com&token=abc#h',
        query_string: 'token=abc',
      },
    });
    expect(out.request?.url).toBe('https://lyonpanel.com/a');
    expect(out.request?.query_string).toBeUndefined();
  });

  it('masque exception, breadcrumbs, extra et tags sans muter l’entrée', () => {
    const input = {
      message: 'm',
      exception: { values: [{ value: 'Échec jean@localhost' }] },
      breadcrumbs: [{ message: 'tel 677123456', data: { to: 'a@b.com' } }],
      extra: { n: ['+237-677-123-456'] },
      tags: { who: '00237677123456' },
    };
    const out = scrubEvent(input);
    expect(out.exception.values[0]?.value).toBe('Échec [email]');
    expect(out.breadcrumbs[0]).toEqual({ message: 'tel [téléphone]', data: { to: '[email]' } });
    expect(out.extra.n[0]).toBe('[téléphone]');
    expect(out.tags.who).toBe('[téléphone]');
    expect(input.exception.values[0]?.value).toBe('Échec jean@localhost');
  });

  it('masque les formats de téléphone variés', () => {
    const out = scrubEvent({ message: '+237(677)123456 et 00237677123456 et 677 123 456' });
    expect(out.message).toBe('[téléphone] et [téléphone] et [téléphone]');
  });

  it('laisse intacts les autres champs', () => {
    const out = scrubEvent({
      user: { id: 'u1' },
      request: { headers: { 'user-agent': 'ua' } },
      message: 'Erreur simple',
    });
    expect(out.user?.id).toBe('u1');
    expect(out.request?.headers?.['user-agent']).toBe('ua');
    expect(out.message).toBe('Erreur simple');
  });
});
