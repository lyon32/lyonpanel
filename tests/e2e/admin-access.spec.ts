import { expect, test } from '@playwright/test';

/*
 * Accès admin vu du navigateur (phase 11). Prérequis : ceux de client-area.spec.ts, plus ADMIN_PATH dans l'environnement
 * du serveur ET du test (ex. ADMIN_PATH=k7q2-test-path). Éléments à fournir (data-testid) sur la page de connexion
 * placée à l'adresse /<ADMIN_PATH> : admin-login-form, admin-email, admin-password, admin-submit, admin-error.
 * Règles vérifiées : tout ce qui n'est pas l'adresse secrète = 404 ; page noindex/nofollow ; adresse absente de
 * robots.txt et sitemap.xml ; mauvais mot de passe = message neutre, sans accès.
 * Le parcours complet (mot de passe, 2 appareils, code à 6 chiffres, tableau de bord) est vérifié en 11.5 (QA navigateur),
 * car il demande un vrai compte administrateur et un générateur de code TOTP.
 */

const ADMIN_PATH = process.env.ADMIN_PATH ?? '';

test.describe('adresse secrète', () => {
  test('ADMIN_PATH est défini pour ces tests', () => {
    expect(ADMIN_PATH.length).toBeGreaterThanOrEqual(8);
  });

  for (const path of [
    '/admin',
    '/admin/login',
    '/fr/admin',
    '/en/admin',
    '/administrator',
    '/wp-admin',
    '/dashboard-admin',
  ]) {
    test(`${path} répond 404`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(404);
    });
  }

  test('une adresse presque identique à la secrète répond 404', async ({ page }) => {
    const res = await page.goto(`/${ADMIN_PATH}x`);
    expect(res?.status()).toBe(404);
    const res2 = await page.goto(`/${ADMIN_PATH.toUpperCase()}`);
    expect(res2?.status()).toBe(404);
  });

  test('sans session, les pages internes de l’admin répondent 404 (pas de redirection vers la connexion)', async ({
    page,
  }) => {
    for (const sub of ['stats', 'users', 'clients']) {
      const res = await page.goto(`/${ADMIN_PATH}/${sub}`);
      expect(res?.status(), sub).toBe(404);
      expect(page.url()).toContain(`/${ADMIN_PATH}/${sub}`);
    }
  });

  test('les routes API admin répondent 404 (jamais 403) sans session', async ({ request }) => {
    for (const path of [
      '/api/v1/admin/stats',
      '/api/v1/admin/users',
      '/api/v1/admin/storage/orphans',
    ]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe('NOT_FOUND');
    }
  });
});

test.describe('page de connexion admin', () => {
  test('s’affiche à l’adresse secrète avec email et mot de passe', async ({ page }) => {
    const res = await page.goto(`/${ADMIN_PATH}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId('admin-login-form')).toBeVisible();
    await expect(page.getByTestId('admin-email')).toBeVisible();
    await expect(page.getByTestId('admin-password')).toHaveAttribute('type', 'password');
  });

  test('est en noindex, nofollow (en-tête et balise)', async ({ page }) => {
    const res = await page.goto(`/${ADMIN_PATH}`);
    const header = res?.headers()['x-robots-tag'] ?? '';
    expect(header).toContain('noindex');
    expect(header).toContain('nofollow');
    const meta = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(meta).toContain('noindex');
    expect(meta).toContain('nofollow');
  });

  test('un mauvais mot de passe affiche un message neutre et ne donne aucun accès', async ({
    page,
  }) => {
    await page.goto(`/${ADMIN_PATH}`);
    await page.getByTestId('admin-email').fill('personne@lyonpanel.test');
    await page.getByTestId('admin-password').fill('Mauvais-mot-de-passe-123');
    await page.getByTestId('admin-submit').click();
    await expect(page.getByTestId('admin-error')).toBeVisible();
    expect(page.url()).toContain(`/${ADMIN_PATH}`);
    const stats = await page.request.get('/api/v1/admin/stats');
    expect(stats.status()).toBe(404);
  });
});

test.describe('adresse secrète jamais publiée', () => {
  test('robots.txt ne la cite pas et ne parle pas d’admin', async ({ request }) => {
    const text = (await (await request.get('/robots.txt')).text()).toLowerCase();
    expect(text).not.toContain(ADMIN_PATH.toLowerCase());
    expect(text).not.toContain('admin');
  });

  test('sitemap.xml ne la cite pas', async ({ request }) => {
    const text = (await (await request.get('/sitemap.xml')).text()).toLowerCase();
    expect(text).not.toContain(ADMIN_PATH.toLowerCase());
    expect(text).not.toContain('admin');
  });

  test('la page d’accueil ne contient aucun lien vers l’admin', async ({ page }) => {
    await page.goto('/fr');
    const html = (await page.content()).toLowerCase();
    expect(html).not.toContain(ADMIN_PATH.toLowerCase());
  });
});
