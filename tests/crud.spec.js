// @ts-check
import { test, expect, seedState, makeState } from './fixtures.js';

// ─── training CRUD ──────────────────────────────────────────────────────────
test.describe('training CRUD', () => {
  test('inline +10 / −10 adjusts exercise duration', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();

    const alphaCard = page.locator('.exercise-card', { hasText: 'Alpha' });
    await expect(alphaCard.locator('.ex-dur')).toContainText('2s');

    await alphaCard.getByRole('button', { name: '+10' }).click();
    await expect(alphaCard.locator('.ex-dur')).toContainText('12s');

    await alphaCard.getByRole('button', { name: '−10' }).click();
    await expect(alphaCard.locator('.ex-dur')).toContainText('5s'); // min clamp = 5

    // Persisted.
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_data') ?? '{}'));
    expect(s.trainings[0].exercises[0].s).toBe(5);
  });

  test('duplicate exercise', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('.exercise-card', { hasText: 'Alpha' }).getByTitle('Duplicate').click();
    await expect(page.locator('.exercise-card', { hasText: 'Alpha' })).toHaveCount(2);
  });

  test('remove exercise', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('.exercise-card', { hasText: 'Alpha' }).getByTitle('Remove').click();
    await expect(page.locator('.exercise-card', { hasText: 'Alpha' })).toHaveCount(0);
    await expect(page.locator('.exercise-card', { hasText: 'Bravo' })).toBeVisible();
  });

  test('delete training via modal', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();

    page.once('dialog', d => d.accept()); // confirm()
    await page.locator('#view-detail .header').getByTitle('Edit').click();
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('#view-home.active')).toBeVisible();
    await expect(page.locator('.training-card', { hasText: 'Test Workout' })).toHaveCount(0);
  });

  test('duplicate training', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('#view-detail .header').getByTitle('Edit').click();
    // Scope to modal — "Duplicate" also exists as an exercise-card button.
    await page.locator('#modal-body').getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.locator('.training-card', { hasText: 'Test Workout' })).toHaveCount(2);
  });

  test('edit training name persists', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('#view-detail .header').getByTitle('Edit').click();
    await page.fill('#ed-tname', 'Renamed');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#detail-title')).toHaveText('Renamed');
    // Navigate to home (bare URL — no hash) to verify the rename persisted.
    await page.goto('/index.html');
    await expect(page.locator('.training-card', { hasText: 'Renamed' })).toBeVisible();
  });
});
