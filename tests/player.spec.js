// @ts-check
import { test, expect, seedState, makeState, makeTraining } from './fixtures.js';

// The player ticks via setInterval anchored to Date.now(). Tests that depend on
// elapsed time install Playwright's fake clock before navigation and advance it
// explicitly with `page.clock.runFor(ms)`, so they don't depend on real-time
// scheduling under parallel load.
// The player opens in a 5s GET READY prepause; tests skip through it with the
// Next button.
const skipPrepause = (page) => page.locator('.player-controls button').nth(2).click();

// ─── player: cycle, pause, skip, exit ───────────────────────────────────────
test.describe('player', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card', { hasText: 'Test Workout' }).click();
    await expect(page.locator('#view-detail.active')).toBeVisible();
  });

  test('runs full cycle: exercise → rest → exercise → done', async ({ page }) => {
    await page.locator('.play-fab').click();
    await expect(page.locator('#view-player.active')).toBeVisible();
    // Prepause first — shows upcoming Alpha with a GET READY label.
    await expect(page.locator('#pl-phase')).toHaveText('GET READY');
    await expect(page.locator('#pl-name')).toHaveText('Alpha');
    await skipPrepause(page);

    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
    await expect(page.locator('#pl-name')).toHaveText('Alpha');
    await expect(page.locator('#pl-counter')).toHaveText('1 / 2');

    // Rest phase after Alpha (2s).
    await page.clock.runFor(2000);
    await expect(page.locator('#pl-phase')).toHaveText('REST');

    // Back to exercise for Bravo after 1s rest.
    await page.clock.runFor(1000);
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
    await expect(page.locator('#pl-name')).toHaveText('Bravo');
    await expect(page.locator('#pl-counter')).toHaveText('2 / 2');

    // Finish screen after Bravo (2s).
    await page.clock.runFor(2000);
    await expect(page.locator('#pl-phase')).toHaveText('DONE');
    await expect(page.locator('#pl-timer')).toHaveText('✓');

    // lastCompleted is persisted.
    const lastCompleted = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('pulse_data') ?? '{}');
      return s.trainings[0].lastCompleted;
    });
    expect(lastCompleted).toBeTruthy();
  });

  test('pause halts the timer', async ({ page }) => {
    await page.locator('.play-fab').click();
    await expect(page.locator('#pl-phase')).toHaveText('GET READY');
    await skipPrepause(page);
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');

    // Pause immediately.
    await page.locator('#pl-playpause').click();
    const t1 = await page.locator('#pl-timer').textContent();
    await page.clock.runFor(3000);
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
    const t2 = await page.locator('#pl-timer').textContent();
    expect(t1).toBe(t2);

    // Play button (not pause) is now visible.
    await expect(page.locator('#pp-play')).toBeVisible();
  });

  test('skip advances to next exercise', async ({ page }) => {
    await page.locator('.play-fab').click();
    await skipPrepause(page);
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
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
    // First btn-icon in player-top is the exit button (second is settings).
    await page.locator('.player-top .btn-icon').first().click();
    await expect(page.locator('#view-detail.active')).toBeVisible();
  });

});

// ─── player: playerPrev navigation ──────────────────────────────────────────
test.describe('playerPrev', () => {
  /** @param {import('@playwright/test').Page} page */
  const prevBtn = (page) => page.locator('.player-controls button').nth(0);
  /** @param {import('@playwright/test').Page} page */
  const nextBtn = (page) => page.locator('.player-controls button').nth(2);

  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await seedState(page, makeState([makeTraining({
      exercises: [
        { id: 'e1', name: 'Alpha', emoji: '💪', s: 10, description: '' },
        { id: 'e2', name: 'Bravo', emoji: '🔥', s: 10, description: '' },
        { id: 'e3', name: 'Charlie', emoji: '⚡', s: 10, description: '' },
      ],
      restSeconds: 10,
    })]));
    await page.goto('/index.html');
    await page.locator('.training-card', { hasText: 'Test Workout' }).click();
    await page.locator('.play-fab').click();
    await expect(page.locator('#view-player.active')).toBeVisible();
    await nextBtn(page).click(); // skip prepause
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
    await expect(page.locator('#pl-name')).toHaveText('Alpha');
  });

  test('at start of first exercise: back goes to prepause', async ({ page }) => {
    await prevBtn(page).click();
    await expect(page.locator('#pl-phase')).toHaveText('GET READY');
  });

  test('mid-exercise: back restarts current exercise', async ({ page }) => {
    // Advance 3 ticks so the timer is below the atStart threshold of maxDur-1=9.
    await page.clock.runFor(3000);
    await expect(page.locator('#pl-timer')).toHaveText('7');
    await prevBtn(page).click();
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
    await expect(page.locator('#pl-name')).toHaveText('Alpha');
    await expect(page.locator('#pl-timer')).toHaveText('10');
  });

  test('at start of exercise N: back goes to preceding rest', async ({ page }) => {
    await nextBtn(page).click(); // Alpha → REST
    await nextBtn(page).click(); // REST → Bravo
    await expect(page.locator('#pl-name')).toHaveText('Bravo');
    await prevBtn(page).click(); // Bravo start → REST after Alpha
    await expect(page.locator('#pl-phase')).toHaveText('REST');
    await expect(page.locator('#pl-counter')).toHaveText('1 / 3'); // exerciseIdx=0
  });

  test('at start of rest: back returns to exercise', async ({ page }) => {
    await nextBtn(page).click(); // Alpha → REST
    await expect(page.locator('#pl-phase')).toHaveText('REST');
    await prevBtn(page).click();
    await expect(page.locator('#pl-phase')).toHaveText('EXERCISE');
    await expect(page.locator('#pl-name')).toHaveText('Alpha');
  });
});

// ─── player: edge cases ─────────────────────────────────────────────────────
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

// ─── player: swipe navigation ───────────────────────────────────────────────
test.describe('player swipe', () => {
  /**
   * Horizontal mouse drag across the timer (not a button).
   * @param {import('@playwright/test').Page} page
   * @param {number} dx
   */
  const swipe = async (page, dx) => {
    const box = await page.locator('#pl-timer').boundingBox();
    if (!box) throw new Error('no timer');
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + (dx * i) / 8, y);
    await page.mouse.up();
  };
  const phase = (page) => page.locator('#pl-phase');
  const name = (page) => page.locator('#pl-name');
  const badge = (page) => page.locator('#pl-upnext');

  test.beforeEach(async ({ page }) => {
    await page.clock.install();
    await seedState(page, makeState([makeTraining({
      exercises: [
        { id: 'e1', name: 'Alpha', emoji: '💪', s: 10, description: '' },
        { id: 'e2', name: 'Bravo', emoji: '🔥', s: 10, description: '' },
      ],
      restSeconds: 10,
    })]));
    await page.goto('/index.html');
    await page.locator('.training-card', { hasText: 'Test Workout' }).click();
    await page.locator('.play-fab').click();
    await expect(phase(page)).toHaveText('GET READY');
  });

  test('swipe left steps forward, swipe right steps back', async ({ page }) => {
    await expect(badge(page)).toHaveClass(/\bon\b/);
    await swipe(page, -200);
    await expect(phase(page)).toHaveText('EXERCISE');
    await expect(name(page)).toHaveText('Alpha');
    await expect(badge(page)).not.toHaveClass(/\bon\b/);

    await swipe(page, -200);
    await expect(phase(page)).toHaveText('REST');
    await expect(name(page)).toHaveText('Bravo');
    await expect(badge(page)).toHaveClass(/\bon\b/);

    // Back from rest goes to the exercise, even mid-segment.
    await page.clock.runFor(3000);
    await swipe(page, 200);
    await expect(phase(page)).toHaveText('EXERCISE');
    await expect(name(page)).toHaveText('Alpha');

    await swipe(page, 200);
    await expect(phase(page)).toHaveText('GET READY');
  });

  test('swipe right at prepause and short drags do nothing', async ({ page }) => {
    await swipe(page, 200);
    await expect(phase(page)).toHaveText('GET READY');
    await swipe(page, -20);
    await expect(phase(page)).toHaveText('GET READY');
    await expect(page.locator('#pl-card')).not.toHaveAttribute('style', /translate/);
  });

  test('swipe past the last exercise finishes', async ({ page }) => {
    for (const p of ['EXERCISE', 'REST', 'EXERCISE', 'DONE']) {
      await swipe(page, -200);
      await expect(phase(page)).toHaveText(p);
    }
    await expect(page.locator('.pl-ghost[id]')).toHaveCount(0);
  });
});
