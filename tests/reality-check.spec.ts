import { test, expect } from '@playwright/test';
// Run against `wrangler pages dev dist` on :8788 (started by Claude)
test('archive proxy still responds', async ({ request }) => {
  const r = await request.get('http://localhost:8788/archive.xml');
  expect(r.status()).toBeLessThan(500); // proxy reachable, not a build-broke 5xx
});
test('hub empty state renders', async ({ page }) => {
  await page.goto('http://localhost:8788/reality-check/');
  await expect(page.locator('text=Reality Check').first()).toBeVisible();
});
// The _fixture entry is draft-excluded from real builds, so component copy
// behavior is verified against the live water page in Slice 3. (Manually
// verified against /reality-check/_fixture/ during Slice 2 review: stat copy,
// copy-all, citation anchors, and SharePack all work with source attribution.)
test.skip('stat copy button copies text with source (runs on water page in Slice 3)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('http://localhost:8788/reality-check/water/');
  await page.locator('.stat .copy').first().click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Source'); // attribution travels with the copy
});
