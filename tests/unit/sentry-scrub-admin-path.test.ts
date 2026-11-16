import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scrubEvent, type SentryLikeEvent } from '@/lib/sentry-scrub';

/*
 * Faille 7 : scrubEvent (src/lib/sentry-scrub.ts) doit masquer la valeur de process.env.ADMIN_PATH partout
 * (request.url, transaction, breadcrumbs, exception.values, tags, spans) : remplacée par « [admin] ».
 * Signature inchangée : scrubEvent(event) -> event.
 */

const SECRET = 'k7q2-test-path-9f3a';

type Loose = SentryLikeEvent & Record<string, unknown>;
const event: Loose = {
  request: { url: `https://lyonpanel.com/${SECRET}/users/abc?x=1` },
  transaction: `GET /${SECRET}/users/[id]`,
  breadcrumbs: [
    { category: 'navigation', message: `vers /${SECRET}/stats`, data: { to: `/${SECRET}/users` } },
  ],
  exception: { values: [{ type: 'Error', value: `échec sur /${SECRET}/users/abc` }] },
  tags: { route: `/${SECRET}/users`, locale: 'fr' },
  spans: [{ description: `GET /${SECRET}/stats`, span_id: 'abcdef0123456789' }],
};

beforeEach(() => {
  process.env.ADMIN_PATH = SECRET;
});
afterEach(() => {
  delete process.env.ADMIN_PATH;
});

describe('scrubEvent : adresse secrète de l’administration', () => {
  it('n’en laisse aucune trace dans l’événement envoyé', () => {
    expect(JSON.stringify(scrubEvent(event))).not.toContain(SECRET);
  });

  it('request.url garde le chemin utile avec [admin] à la place du secret', () => {
    const out = scrubEvent(event);
    expect(out.request?.url).toBe('https://lyonpanel.com/[admin]/users/abc');
  });

  it('transaction, breadcrumbs, exception.values et tags sont masqués', () => {
    const out = scrubEvent(event) as Loose;
    expect(out.transaction).toBe('GET /[admin]/users/[id]');
    expect(JSON.stringify(out.breadcrumbs)).toContain('[admin]');
    expect(JSON.stringify(out.exception)).toContain('[admin]');
    expect(JSON.stringify(out.tags)).toContain('[admin]');
  });

  it('le reste de l’événement est conservé (langue, type d’erreur, identifiant de span)', () => {
    const out = scrubEvent(event) as Loose;
    expect((out.tags as Record<string, string>).locale).toBe('fr');
    expect(JSON.stringify(out.exception)).toContain('Error');
    expect(JSON.stringify(out.spans)).toContain('abcdef0123456789');
  });

  it('sans ADMIN_PATH configuré, ne plante pas et ne masque rien de plus', () => {
    delete process.env.ADMIN_PATH;
    const out = scrubEvent(event);
    expect(out.request?.url).toBe(`https://lyonpanel.com/${SECRET}/users/abc`);
  });

  it('l’événement d’origine n’est pas modifié', () => {
    scrubEvent(event);
    expect(event.transaction).toContain(SECRET);
  });
});
