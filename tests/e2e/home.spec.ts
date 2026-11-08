import { expect, test } from '@playwright/test';

test("affiche le héros sur la page d'accueil", async ({ page }) => {
  // Mobile 360 x 740 : aucun défilement horizontal
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mobile Money');

  const noHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(noHorizontalScroll).toBe(true);
});

test('les sections réagissent : FAQ, bandeau, pas de débordement à 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/fr');
  const second = page.getByRole('button', { name: 'Comment payer ?' });
  await second.scrollIntoViewIfNeeded();
  await expect(second).toHaveAttribute('aria-expanded', 'false');
  await second.click();
  await expect(second).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('list', { name: 'Réseaux pris en charge' })).toBeAttached();
  const ok = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(ok).toBe(true);
});

test('cite tous les réseaux du catalogue (sans prix)', async ({ page }) => {
  await page.goto('/fr');
  for (const name of [
    'X (Twitter)',
    'Telegram',
    'Spotify',
    'Snapchat',
    'Twitch',
    'SoundCloud',
    'LinkedIn',
    'WhatsApp',
    'Discord',
    'Trafic web',
  ]) {
    await expect(page.getByRole('heading', { name, level: 3 })).toBeAttached();
  }
});

test('onglets des atouts : le panneau suit le choix', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/fr');
  const tab = page.getByRole('tab', { name: 'Un seul solde' });
  await tab.scrollIntoViewIfNeeded();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText('débitée de votre solde');
});

test('mouvement réduit : les trois étapes restent empilées et lisibles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/fr');
  await page.waitForTimeout(800);
  await expect(page.locator('[data-pinned="true"]')).toHaveCount(0);
  for (const name of ['Créez votre compte', 'Rechargez en Mobile Money', 'Commandez et suivez']) {
    await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
  }
});

test('étapes épinglées : une carte visible à la fois au défilement', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/fr');
  const section = page.locator('section[data-pinned]');
  await expect(section).toHaveAttribute('data-pinned', 'true');
  const top = await section.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const opacities = async () =>
    page
      .locator('[data-step-card]')
      .evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)));
  await page.evaluate((y) => window.scrollTo(0, y + 5), top);
  await page.waitForTimeout(900);
  expect((await opacities()).every((o) => o < 0.2)).toBe(true);
  await page.evaluate((y) => window.scrollTo(0, y + 740 * 0.55), top);
  await page.waitForTimeout(900);
  const mid = await opacities();
  expect(mid[0]).toBeGreaterThan(0.8);
  expect(mid[2]).toBeLessThan(0.2);
});
