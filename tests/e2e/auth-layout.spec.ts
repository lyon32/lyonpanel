import { expect, test, type Page } from '@playwright/test';

/*
 * Mise en page des pages de compte : aucun défilement vertical, bascule connexion ↔ inscription
 * par le panneau, retour visuel des boutons, mouvement réduit.
 * Prérequis : mêmes clés Turnstile de test que auth.spec.ts.
 */

const PAGES = {
  fr: [
    '/fr/inscription',
    '/fr/connexion',
    '/fr/mot-de-passe-oublie',
    '/fr/nouveau-mot-de-passe?token_hash=abc',
  ],
  en: ['/en/register', '/en/login', '/en/forgot-password', '/en/reset-password?token_hash=abc'],
} as const;

const SIZES = [
  { width: 360, height: 640 },
  { width: 1366, height: 768 },
] as const;

async function ready(page: Page) {
  await expect(
    page.locator('.lp-auth-pane form, .lp-auth-pane [role="alert"]').first(),
  ).toBeVisible();
}

for (const size of SIZES) {
  for (const locale of ['fr', 'en'] as const) {
    for (const path of PAGES[locale]) {
      test(`aucun défilement vertical : ${path} à ${size.width}×${size.height}`, async ({
        page,
      }) => {
        await page.setViewportSize(size);
        await page.goto(path);
        await ready(page);
        const overflow = await page.evaluate(() => {
          const pane = document.querySelector('.lp-auth-pane');
          return {
            page: document.documentElement.scrollHeight - window.innerHeight,
            pane: pane ? pane.scrollHeight - pane.clientHeight : 0,
            width: document.documentElement.scrollWidth - window.innerWidth,
          };
        });
        expect(overflow.page).toBeLessThanOrEqual(0);
        expect(overflow.pane).toBeLessThanOrEqual(0);
        expect(overflow.width).toBeLessThanOrEqual(0);
      });
    }
  }
}

test.describe('bascule par le panneau (ordinateur)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  const panelX = (page: Page) =>
    page.locator('.lp-auth-panel').evaluate((el) => el.getBoundingClientRect().left);

  test('connexion ↔ inscription sans rechargement, retour du navigateur compris', async ({
    page,
  }) => {
    await page.goto('/fr/connexion');
    await ready(page);
    const cardLeft = await page
      .locator('.lp-auth-shell main > div')
      .evaluate((el) => el.getBoundingClientRect().left);
    // Lien direct : le panneau est déjà à droite, sans glissement au chargement.
    expect(await panelX(page)).toBeGreaterThan(cardLeft + 500);
    await page.evaluate(() => Object.assign(window, { marqueur: 'meme-page' }));

    await page.locator('.lp-auth-panel a').click();
    await expect(page).toHaveURL(/\/fr\/inscription$/);
    await expect(page.locator('input[name="phone"]')).toBeVisible();
    await expect.poll(() => panelX(page)).toBeLessThan(cardLeft + 2);
    // Aucun rechargement : la variable posée sur window existe encore.
    expect(await page.evaluate(() => (window as unknown as { marqueur?: string }).marqueur)).toBe(
      'meme-page',
    );
    // Le focus est sur le premier champ du nouveau formulaire.
    await expect(page.locator('input[name="email"]')).toBeFocused();

    await page.goBack();
    await expect(page).toHaveURL(/\/fr\/connexion$/);
    await expect(page.locator('input[name="identifier"]')).toBeVisible();
    await expect.poll(() => panelX(page)).toBeGreaterThan(cardLeft + 500);

    await page.goForward();
    await expect(page).toHaveURL(/\/fr\/inscription$/);
    await expect.poll(() => panelX(page)).toBeLessThan(cardLeft + 2);
  });

  test('mouvement réduit : le panneau change de côté sans glisser', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/fr/connexion');
    await ready(page);
    const cardLeft = await page
      .locator('.lp-auth-shell main > div')
      .evaluate((el) => el.getBoundingClientRect().left);
    await page.locator('.lp-auth-panel a').click();
    // Mesure immédiate, sans attendre : pas de position intermédiaire ni de transformation.
    const state = await page.locator('.lp-auth-panel').evaluate((el) => ({
      left: el.getBoundingClientRect().left,
      transform: getComputedStyle(el).transform,
    }));
    expect(state.transform).toBe('none');
    expect(state.left).toBeLessThan(cardLeft + 2);
  });
});

test.describe('retour visuel du bouton', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("connexion : bouton occupé et désactivé pendant l'envoi", async ({ page }) => {
    await page.route('**/api/v1/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto('/fr/connexion');
    await ready(page);
    await page.locator('input[name="identifier"]').fill('+237699999999');
    await page.locator('input[name="password"]').fill('Mauvais-mdp-12345');
    await expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
      timeout: 15_000,
    });
    const button = page.locator('button[type="submit"]');
    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toBeDisabled();
    await expect(button).toContainText('Connexion…');
    // Fin de l'envoi : le bouton redevient utilisable et l'erreur s'affiche.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(button).toBeEnabled();
    await expect(button).not.toHaveAttribute('aria-busy', 'true');
  });
});

test.describe('inscription en deux étapes (téléphone)', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('étape 2, retour sans perdre la saisie, erreur affichée à la bonne étape', async ({
    page,
  }) => {
    await page.goto('/fr/inscription');
    await ready(page);
    const next = page.locator('[data-testid="register-next"]');
    // Étape 1 incomplète : on reste sur l'étape 1 avec les erreurs.
    await next.click();
    await expect(page.locator('input[name="email"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-field="country"]')).toBeHidden();

    await page.locator('input[name="email"]').fill('etape@lyonpanel.test');
    await page.locator('input[name="phone"]').fill('+237612345678');
    await page.locator('input[name="password"]').fill('Cf9!vQ2#zLm7-rTa84');
    await next.click();
    await expect(page.locator('[data-field="country"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeHidden();
    await expect(page.locator('[data-field="country"]')).toBeFocused();

    await page.getByRole('button', { name: 'Retour' }).click();
    await expect(page.locator('input[name="email"]')).toHaveValue('etape@lyonpanel.test');
    await expect(page.locator('input[name="phone"]')).toHaveValue('+237612345678');
  });
});

const overflowOf = (page: Page) =>
  page.evaluate(() => {
    const pane = document.querySelector('.lp-auth-pane');
    return {
      page: document.documentElement.scrollHeight - window.innerHeight,
      pane: pane ? pane.scrollHeight - pane.clientHeight : 0,
    };
  });

test.describe('inscription téléphone 360×640 avec erreurs affichées', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  for (const [locale, path] of [
    ['fr', '/fr/inscription'],
    ['en', '/en/register'],
  ] as const) {
    test(`aucun défilement avec les erreurs, étapes 1 et 2 (${locale})`, async ({ page }) => {
      let registerCalls = 0;
      await page.route('**/api/v1/auth/register', async (route) => {
        registerCalls += 1;
        await route.continue();
      });
      await page.goto(path);
      await ready(page);
      // Étape 1 : les 3 erreurs sont visibles et « Continuer » reste à l'écran.
      await page.locator('[data-testid="register-next"]').click();
      await expect(page.locator('.lp-auth-pane [role="alert"]')).toHaveCount(3);
      expect((await overflowOf(page)).pane).toBeLessThanOrEqual(0);
      const box = await page.locator('[data-testid="register-next"]').boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(640);

      await page.locator('input[name="email"]').fill('erreurs@lyonpanel.test');
      await page.locator('input[name="phone"]').fill('+237612345678');
      await page.locator('input[name="password"]').fill('Cf9!vQ2#zLm7-rTa84');
      await page.locator('[data-testid="register-next"]').click();
      // Étape 2 sans pays : erreur immédiate côté navigateur, rien n'est envoyé.
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('.lp-auth-pane [role="alert"]')).toHaveCount(1);
      const after = await overflowOf(page);
      expect(after.page).toBeLessThanOrEqual(0);
      expect(after.pane).toBeLessThanOrEqual(0);
      expect(registerCalls).toBe(0);
    });
  }

  test('le jeton Turnstile est déjà généré à l’étape 1', async ({ page }) => {
    await page.goto('/fr/inscription');
    await ready(page);
    await expect(page.locator('[name="cf-turnstile-response"]')).not.toHaveValue('', {
      timeout: 15_000,
    });
  });
});

for (const width of [360, 1024, 1366, 1920]) {
  for (const path of ['/fr/inscription', '/en/register']) {
    test(`devise sans texte coupé : ${path} à ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await ready(page);
      const next = page.locator('[data-testid="register-next"]');
      if (await next.isVisible()) {
        await page.locator('input[name="email"]').fill('a@lyonpanel.test');
        await page.locator('input[name="phone"]').fill('+237612345678');
        await page.locator('input[name="password"]').fill('Cf9!vQ2#zLm7-rTa84');
        await next.click();
      }
      for (const name of ['display_currency', 'language', 'country']) {
        const clipped = await page
          .locator(`[data-field="${name}"] > span`)
          .evaluate((el) => el.scrollWidth > el.clientWidth);
        expect(clipped, name).toBe(false);
      }
    });
  }
}

test.describe('animations propres (ordinateur)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('double clic rapide puis départ de la page : aucun style résiduel, aucune erreur', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/fr/connexion');
    await ready(page);
    await page.locator('.lp-auth-panel a').dblclick();
    await expect(page).toHaveURL(/\/fr\/inscription$/);
    // Sous charge, l'animation peut durer plus longtemps : on attend la fin (10 s maximum).
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Array.from(
              document.querySelectorAll<HTMLElement>(
                '.lp-auth-panel, .lp-auth-pane, .lp-auth-pane h1',
              ),
            )
              .map((el) => el.style.transform + el.style.opacity)
              .join(''),
          ),
        { timeout: 10_000 },
      )
      .toBe('');

    // Départ pendant une animation : retour à l'accueil par le logo.
    await page.locator('.lp-auth-panel a').click();
    await page.locator('header a').first().click();
    await expect(page).toHaveURL(/\/fr$/);
    await page.waitForTimeout(500);
    expect(errors.filter((message) => !/favicon|Failed to load resource/.test(message))).toEqual(
      [],
    );
  });

  test('changer de langue garde le lien de réinitialisation', async ({ page }) => {
    await page.goto('/fr/nouveau-mot-de-passe?token_hash=abc');
    await ready(page);
    await page.locator('header button[lang="en"]').click();
    await expect(page).toHaveURL(/\/en\/reset-password\?token_hash=abc$/);
  });
});

test.describe('double clic sur le bouton de bascule', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  for (const [locale, login, register] of [
    ['fr', '/fr/connexion', /\/fr\/inscription$/],
    ['en', '/en/login', /\/en\/register$/],
  ] as const) {
    test(`on finit sur la page cible, une seule entrée d'historique (${locale})`, async ({
      page,
    }) => {
      await page.goto(login);
      await ready(page);
      const before = await page.evaluate(() => history.length);
      await page.locator('.lp-auth-panel a').dblclick();
      await expect(page).toHaveURL(register);
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(register);
      await expect(page.locator('input[name="phone"]')).toBeVisible();
      expect(await page.evaluate(() => history.length)).toBe(before + 1);
    });
  }
});

test.describe('bascule immédiate, indépendante du réseau', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  for (const [locale, login, register, phone, identifier] of [
    [
      'fr',
      '/fr/connexion',
      /\/fr\/inscription$/,
      'input[name="phone"]',
      'input[name="identifier"]',
    ],
    ['en', '/en/login', /\/en\/register$/, 'input[name="phone"]', 'input[name="identifier"]'],
  ] as const) {
    test(`le panneau part au clic et le formulaire apparaît sans attendre le serveur (${locale})`, async ({
      page,
    }) => {
      await page.goto(login);
      await ready(page);
      // Navigation ralentie : toute requête de page Next (RSC) attend 2 s.
      await page.route(/_rsc=/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await route.continue();
      });
      // Mesure dans la page (sans le délai de Playwright) : temps entre le clic et le premier déplacement.
      await page.evaluate(() => {
        const panel = document.querySelector('.lp-auth-panel') as HTMLElement;
        const start = panel.getBoundingClientRect().left;
        const win = window as unknown as { __firstMove?: number };
        document.querySelector('.lp-auth-panel a')?.addEventListener(
          'click',
          () => {
            const t0 = performance.now();
            const tick = () => {
              if (Math.abs(panel.getBoundingClientRect().left - start) > 20) {
                win.__firstMove = performance.now() - t0;
              } else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          },
          true,
        );
      });
      await page.locator('.lp-auth-panel a').click();
      const t0 = Date.now();
      // Le panneau part au clic. Seuil large : `next dev` (rendu non optimisé) ajoute du délai ; 90 à 250 ms mesurés.
      await expect
        .poll(() =>
          page.evaluate(() => (window as unknown as { __firstMove?: number }).__firstMove ?? 9999),
        )
        .toBeLessThan(400);
      // Fin du mouvement (~1 s) : le formulaire d'inscription est là, l'adresse n'a pas besoin d'avoir changé.
      await expect(page.locator(phone)).toBeVisible({ timeout: 1200 });
      await expect(page.locator(identifier)).toHaveCount(0);
      expect(Date.now() - t0).toBeLessThan(1500);
      await expect(page.locator('input[name="email"]')).toBeFocused();
      // La navigation se termine ensuite : même formulaire, bonne adresse, un seul formulaire.
      await expect(page).toHaveURL(register, { timeout: 15_000 });
      await expect(page.locator('.lp-auth-pane form')).toHaveCount(1);
    });
  }

  test('sens : « S’inscrire » va vers la gauche, « Se connecter » vers la droite', async ({
    page,
  }) => {
    await page.goto('/fr/connexion');
    await ready(page);
    const left = () =>
      page.locator('.lp-auth-panel').evaluate((el) => el.getBoundingClientRect().left);
    const cardLeft = await page
      .locator('.lp-auth-shell main > div')
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(await left()).toBeGreaterThan(cardLeft + 500);
    await page.locator('.lp-auth-panel a').click();
    await expect.poll(left, { timeout: 5000 }).toBeLessThan(cardLeft + 2);
    // Le formulaire d'inscription est à droite du panneau.
    const form = await page.locator('input[name="email"]').boundingBox();
    expect(form?.x ?? 0).toBeGreaterThan(cardLeft + 400);
    await page.locator('.lp-auth-panel a').click();
    await expect.poll(left, { timeout: 5000 }).toBeGreaterThan(cardLeft + 500);
    const login = await page.locator('input[name="identifier"]').boundingBox();
    expect(login?.x ?? 9999).toBeLessThan(cardLeft + 400);
  });
});
