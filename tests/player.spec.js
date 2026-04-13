// @ts-check
import { test, expect, seedState, makeState, makeTraining } from './fixtures.js';

// Player tests use localhost so the intro countdown is skipped (see index.html startPlayer).
// Exercises are 2s / rest 1s — full workout completes in ~6 real seconds.

test.describe('player', () => {
  test.beforeEach(async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card', { hasText: 'Test Workout' }).click();
    await expect(page.locator('#view-detail.active')).toBeVisible();
  });

  test('runs full cycle: exercise → rest → exercise → done', async ({ page }) => {
    test.slow();
    await page.locator('.play-fab').click();
    await expect(page.locator('#view-player.active')).toBeVisible();
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
    await expect(page.locator('#pl-name')).toHaveText('Alpha');
    await expect(page.locator('#pl-counter')).toHaveText('1 / 2');

    // Rest phase after Alpha.
    await expect(page.locator('#pl-phase')).toHaveText('REST', { timeout: 6000 });

    // Back to exercise for Bravo.
    await expect(page.locator('#pl-name')).toHaveText('Bravo', { timeout: 4000 });
    await expect(page.locator('#pl-counter')).toHaveText('2 / 2');

    // Finish screen.
    await expect(page.locator('#pl-phase')).toHaveText('DONE', { timeout: 6000 });
    await expect(page.locator('#pl-timer')).toHaveText('✓');

    // lastCompleted is persisted.
    const lastCompleted = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('pulse_data'));
      return s.trainings[0].lastCompleted;
    });
    expect(lastCompleted).toBeTruthy();
  });

  test('pause halts the timer', async ({ page }) => {
    await page.locator('.play-fab').click();
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');

    // Pause immediately.
    await page.locator('#pl-playpause').click();
    const t1 = await page.locator('#pl-timer').textContent();
    await page.waitForTimeout(1500);
    const t2 = await page.locator('#pl-timer').textContent();
    expect(t1).toBe(t2);

    // Play button (not pause) is now visible.
    await expect(page.locator('#pp-play')).toBeVisible();
  });

  test('skip advances to next exercise', async ({ page }) => {
    await page.locator('.play-fab').click();
    await expect(page.locator('#pl-name')).toHaveText('Alpha');

    // Click next (third button in controls).
    await page.locator('.player-controls button').nth(2).click();
    // Goes to rest first.
    await expect(page.locator('#pl-phase')).toHaveText('REST');
    await page.locator('.player-controls button').nth(2).click();
    await expect(page.locator('#pl-name')).toHaveText('Bravo');
  });

  test('exit returns to detail view', async ({ page }) => {
    await page.locator('.play-fab').click();
    await expect(page.locator('#view-player.active')).toBeVisible();
    await page.locator('.player-top .btn-icon').click();
    await expect(page.locator('#view-detail.active')).toBeVisible();
  });

});

// Separate describe so beforeEach doesn't pre-seed a training with exercises.
test.describe('player edge cases', () => {
  test('refuses to start with no exercises', async ({ page }) => {
    await seedState(page, makeState([makeTraining({ exercises: [] })]));
    await page.goto('/index.html');
    await page.locator('.training-card', { hasText: 'Test Workout' }).click();
    await page.locator('.play-fab').click();
    await expect(page.locator('#toast')).toHaveText(/Add exercises/);
    await expect(page.locator('#view-detail.active')).toBeVisible();
  });
});
