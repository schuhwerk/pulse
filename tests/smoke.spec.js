// @ts-check
import { test, expect } from './fixtures.js';

// ─── smoke: create → play → finish ─────────────────────────────────────────
test.describe('smoke: create → play → finish', () => {
  test('home renders with builtin trainings', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#view-home.active')).toBeVisible();
    // BUILTIN_TRAININGS seeds at least one card on first load.
    await expect(page.locator('.training-card').first()).toBeVisible();
  });

  test('create a training via the + FAB', async ({ page }) => {
    await page.goto('/index.html');
    page.once('dialog', d => d.accept('Test Training'));
    await page.locator('#view-home .fab').click();
    await expect(page.locator('.training-card', { hasText: 'Test Training' })).toBeVisible();
  });

  test('add a manual exercise and reach player', async ({ page }) => {
    await page.goto('/index.html');

    // Create training.
    page.once('dialog', d => d.accept('Quick'));
    await page.locator('#view-home .fab').click();
    await page.locator('.training-card', { hasText: 'Quick' }).click();
    await expect(page.locator('#view-detail.active')).toBeVisible();

    // Open add-exercise, switch to Manual tab, fill, add.
    await page.locator('#view-detail .fab').last().click();
    await page.locator('.tab[data-tab="manual"]').click();
    await page.fill('#man-name', 'Jumping Jacks');
    await page.fill('#man-dur', '10');
    await page.locator('#tab-manual button.btn-primary').click();

    // Back on detail — exercise visible.
    await expect(page.locator('.exercise-card', { hasText: 'Jumping Jacks' })).toBeVisible();

    // Start player — opens in a 5s GET READY prepause, showing the upcoming exercise.
    await page.locator('.play-fab').click();
    await expect(page.locator('#view-player.active')).toBeVisible();
    await expect(page.locator('#pl-phase')).toHaveText('GET READY');
  });

  test('localStorage persists across reload', async ({ page }) => {
    await page.goto('/index.html');
    page.once('dialog', d => d.accept('Persist Me'));
    await page.locator('#view-home .fab').click();
    await expect(page.locator('.training-card', { hasText: 'Persist Me' })).toBeVisible();

    await page.reload();
    await expect(page.locator('.training-card', { hasText: 'Persist Me' })).toBeVisible();
  });

  test('share link round-trip via internal helpers', async ({ page }) => {
    await page.goto('/index.html');

    const result = await page.evaluate(() => {
      const t = { id: 'tst', name: 'RT', restSeconds: 5, exercises: [{ id:'e1', name:'A', emoji:'💪', s:20 }] };
      // @ts-ignore
      const url = encodeShareUrl(t);
      const payload = url.split('#import=')[1];
      // @ts-ignore
      const decoded = decodeSharePayload(payload);
      return { url, decoded };
    });

    expect(result.url).toContain('#import=');
    expect(result.decoded.name).toBe('RT');
    expect(result.decoded.exercises[0].name).toBe('A');
  });
});
