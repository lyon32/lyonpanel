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
