// @ts-check
import { test, expect, seedState, makeState } from './fixtures.js';

test.describe('settings', () => {
  test('toggle audio persists across reload', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('button[title="Settings"]').click();

    await expect(page.locator('.setting-row').first()).toContainText('Enabled');
    await page.getByRole('button', { name: 'Enabled' }).click();
    await expect(page.locator('.setting-row').first()).toContainText('Disabled');

    await page.reload();
    await page.locator('button[title="Settings"]').click();
    await expect(page.locator('.setting-row').first()).toContainText('Disabled');
  });

  test('reset all restores builtins', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await expect(page.locator('.training-card', { hasText: 'Test Workout' })).toBeVisible();

    await page.locator('button[title="Settings"]').click();
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(page.locator('.training-card', { hasText: 'Test Workout' })).toHaveCount(0);
    // BUILTIN_TRAININGS repopulated the home list.
    await expect(page.locator('.training-card').first()).toBeVisible();
  });

  test('escape closes modal', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('button[title="Settings"]').click();
    await expect(page.locator('#modal.open')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal.open')).not.toBeVisible();
  });
});
