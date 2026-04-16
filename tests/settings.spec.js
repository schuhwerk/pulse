// @ts-check
import { test, expect, seedState, makeState, APP_VERSION } from './fixtures.js';

/** A stored training that pretends to be the 7min builtin but with a stale hash. */
function staleBuiltin(nameOverride = '7 Minute Workout') {
  return {
    id: 't-7min', builtinId: '7min', builtinHash: 'outdated',
    name: nameOverride, restSeconds: 7, exercises: [],
  };
}

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

  test('auto-update toggle is on by default', async ({ page }) => {
    await seedState(page, makeState()); // no autoUpdate key → defaults to true
    await page.goto('/index.html');
    await page.locator('button[title="Settings"]').click();
    await expect(page.locator('.toggle input[type=checkbox]')).toBeChecked();
  });

  test('auto-update toggle persists when disabled', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('button[title="Settings"]').click();
    await page.locator('.toggle').click(); // the input is visually hidden; click the label

    await page.reload();
    await page.locator('button[title="Settings"]').click();
    await expect(page.locator('.toggle input[type=checkbox]')).not.toBeChecked();
  });

  test('builtin-update modal appears when hash differs on version change', async ({ page }) => {
    await seedState(page, { ...makeState([staleBuiltin()]), version: '1.0.0' });
    await page.goto('/index.html');
    await expect(page.locator('#modal-title')).toHaveText('Built-in trainings updated');
  });

  test('keep mine closes modal and preserves training', async ({ page }) => {
    await seedState(page, { ...makeState([staleBuiltin('My Custom Name')]), version: '1.0.0' });
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Keep mine' }).click();
    await expect(page.locator('#modal.open')).not.toBeVisible();
    await expect(page.locator('.training-card', { hasText: 'My Custom Name' })).toBeVisible();
  });

  test('update replaces stale builtin training', async ({ page }) => {
    await seedState(page, { ...makeState([staleBuiltin('My Custom Name')]), version: '1.0.0' });
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.locator('#modal.open')).not.toBeVisible();
    await expect(page.locator('#toast')).toHaveText('Trainings updated!');
    await expect(page.locator('.training-card', { hasText: '7 Minute Workout' })).toBeVisible();
    await expect(page.locator('.training-card', { hasText: 'My Custom Name' })).toHaveCount(0);
  });

  test('no builtin-update modal when version already current', async ({ page }) => {
    // Same stale hash but version already matches APP_VERSION — no prompt expected.
    // APP_VERSION is read from index.html at test time (see fixtures.js) so the
    // pre-commit auto-bump doesn't break this assertion.
    await seedState(page, { ...makeState([staleBuiltin()]), version: APP_VERSION });
    await page.goto('/index.html');
    await expect(page.locator('#modal.open')).not.toBeVisible();
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
