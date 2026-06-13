import { test, expect } from '@playwright/test';
// Serves dist/ on :4321 via `npm run preview` (started by Claude before running)
test('homepage renders hero + both signup forms', async ({ page }) => {
  await page.goto('http://localhost:4321/');
  await expect(page.locator('text=Progressives for AI').first()).toBeVisible();
  await expect(page.locator('#heroForm')).toBeVisible();
  await expect(page.locator('#footerForm')).toBeVisible();
  await page.screenshot({ path: 'tests/__shots__/home-astro.png', fullPage: true });
});
