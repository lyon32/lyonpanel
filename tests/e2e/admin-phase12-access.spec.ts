import { expect, test } from '@playwright/test';

/*
 * Accès aux écrans et routes admin de la phase 12, vu du navigateur, SANS session (mêmes prérequis que admin-access.spec.ts :
 * ADMIN_PATH dans l'environnement du serveur ET du test). Règles vérifiées :
 *   - pages /<ADMIN_PATH>/orders, /services, /settings, /tickets, /audit : 404 sans session, sans redirection ;
 *   - routes /api/v1/admin/* de la phase 12 : 404 NOT_FOUND (jamais 403) en lecture ET en écriture ;
 *   - faille n°9 : une écriture venant d'une origine étrangère reçoit aussi 404 (la garde passe avant l'origine).
 * Le parcours complet (remboursement, renvoi, clôture, marge avec aperçu, réponse à un ticket) demande un vrai compte
 * administrateur avec code TOTP : il est vérifié en 12.5 (QA navigateur), pas ici.
 */
const ADMIN_PATH = process.env.ADMIN_PATH ?? '';
const ID = '00000000-0000-4000-8000-000000000000';

test.describe('écrans admin de la phase 12', () => {
  test('ADMIN_PATH est défini pour ces tests', () => {
    expect(ADMIN_PATH.length).toBeGreaterThanOrEqual(8);
  });

  for (const sub of [
    'orders',
    'orders/' + ID,
    'services',
    'settings',
    'tickets',
    'tickets/' + ID,
    'audit',
  ]) {
    test(`/${'<ADMIN_PATH>'}/${sub} répond 404 sans session, sans redirection`, async ({
      page,
    }) => {
      const res = await page.goto(`/${ADMIN_PATH}/${sub}`);
      expect(res?.status(), sub).toBe(404);
      expect(page.url()).toContain(`/${ADMIN_PATH}/${sub}`);
    });
  }

  test('ces pages sont en noindex', async ({ page }) => {
    const res = await page.goto(`/${ADMIN_PATH}/orders`);
    expect(res?.headers()['x-robots-tag'] ?? '').toContain('noindex');
  });
});

test.describe('routes API admin de la phase 12 sans session', () => {
  const reads = [
    '/api/v1/admin/orders',
    `/api/v1/admin/orders/${ID}`,
    '/api/v1/admin/payments',
    '/api/v1/admin/services',
    '/api/v1/admin/settings',
    '/api/v1/admin/tickets',
    '/api/v1/admin/audit',
  ];
  for (const path of reads) {
    test(`GET ${path} : 404 NOT_FOUND`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(404);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    });
  }

  const writes: Array<['POST' | 'PATCH', string]> = [
    ['POST', `/api/v1/admin/orders/${ID}/refund`],
    ['POST', `/api/v1/admin/orders/${ID}/cancel`],
    ['POST', `/api/v1/admin/orders/${ID}/resend`],
    ['POST', `/api/v1/admin/orders/${ID}/close`],
    ['PATCH', '/api/v1/admin/services/1'],
    ['POST', '/api/v1/admin/services/1/preview'],
    ['PATCH', '/api/v1/admin/settings'],
    ['POST', `/api/v1/admin/tickets/${ID}/messages`],
    ['PATCH', `/api/v1/admin/tickets/${ID}`],
  ];
  for (const [method, path] of writes) {
    test(`${method} ${path} avec origine étrangère : 404 NOT_FOUND, pas 403`, async ({
      request,
    }) => {
      const res = await request.fetch(path, {
        method,
        headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
        data: {},
      });
      expect(res.status()).toBe(404);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    });
  }
});
