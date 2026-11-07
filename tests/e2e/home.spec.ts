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
