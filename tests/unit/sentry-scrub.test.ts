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
