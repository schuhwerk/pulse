// @ts-check
import { test, expect, seedState, makeState } from './fixtures.js';

test.describe('settings', () => {
  test('audio volume persists across reload', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('button[title="Settings"]').click();

    // Default audioVolume (0.6) → slider at 60.
    await expect(page.locator('#vol-slider')).toHaveValue('60');

    // Mute: set slider to 0 and fire oninput to trigger save.
    await page.locator('#vol-slider').evaluate(el => {
      el.value = '0';
      el.dispatchEvent(new Event('input'));
    });

    await page.reload();
    await page.locator('button[title="Settings"]').click();
    await expect(page.locator('#vol-slider')).toHaveValue('0');
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
