// @ts-check
import { test, expect, seedState, makeState, makeTraining } from './fixtures.js';

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
    await page.locator('.exercise-card', { hasText: 'Alpha' }).locator('.ex-name').click();
    await page.locator('#modal-body').getByRole('button', { name: 'Delete exercise' }).click();
    await expect(page.locator('#modal')).not.toHaveClass(/open/);
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

  test('edit exercise: image overrides emoji, clearing it falls back', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    const alpha = page.locator('.exercise-card', { hasText: 'Alpha' });
    await alpha.locator('.ex-name').click();

    await page.fill('#ed-emoji', '🔥');
    await expect(page.locator('#ed-illu')).not.toHaveClass(/has-img/);
    await page.fill('#ed-img', 'images/plank.svg');
    await expect(page.locator('#ed-illu')).toHaveClass(/has-img/);
    await expect(page.locator('#ed-illu-img')).toHaveAttribute('src', 'images/plank.svg');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(alpha.locator('.thumb img')).toHaveAttribute('src', 'images/plank.svg');

    await alpha.locator('.ex-name').click();
    await expect(page.locator('#ed-emoji')).toHaveValue('🔥');
    await page.fill('#ed-img', '');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(alpha.locator('.thumb')).toHaveText('🔥');
  });

  test('broken image URL falls back to the emoji', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    const alpha = page.locator('.exercise-card', { hasText: 'Alpha' });
    await alpha.locator('.ex-name').click();
    await page.fill('#ed-emoji', '🔥');
    await page.fill('#ed-img', 'images/does-not-exist.png');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(alpha.locator('.thumb img')).toHaveCount(0);
    await expect(alpha.locator('.thumb')).toHaveText('🔥');
  });

  test('manual add uses the same form', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('#view-detail .btn-add').click();
    await page.locator('.tab[data-tab="manual"]').click();
    await page.fill('#man-name', 'Burpees');
    await page.fill('#man-emoji', '🐸');
    await page.fill('#man-rest', '7');
    await page.locator('#tab-manual button.btn-primary').click();
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_data') ?? '{}'));
    const ex = s.trainings[0].exercises.at(-1);
    expect(ex).toMatchObject({ name: 'Burpees', emoji: '🐸', imageUrl: '', restAfterSeconds: 7 });
  });

  test('long-press drag reorders exercises; tap opens edit', async ({ page }) => {
    await seedState(page, makeState());
    await page.clock.install();
    await page.goto('/index.html');
    await page.locator('.training-card').click();

    const alpha = await page.locator('.exercise-card', { hasText: 'Alpha' }).locator('.ex-name').boundingBox();
    const bravo = await page.locator('.exercise-card', { hasText: 'Bravo' }).boundingBox();
    if (!alpha || !bravo) throw new Error('cards not laid out');
    await page.mouse.move(alpha.x + 5, alpha.y + 5);
    await page.mouse.down();
    await page.clock.runFor(500); // long-press threshold is 400ms
    await page.mouse.move(alpha.x + 5, bravo.y + bravo.height - 4, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('.exercise-card .ex-name')).toHaveText(['Bravo', 'Alpha']);
    await expect(page.locator('#modal')).not.toHaveClass(/open/); // the drop must not open edit

    await page.clock.runFor(400); // clicks are swallowed for 350ms after a drop
    await page.locator('.exercise-card', { hasText: 'Alpha' }).locator('.ex-name').click();
    await expect(page.locator('#modal-title')).toHaveText('Edit exercise');
  });

  test('long-press drag reorders trainings on home; tap opens detail', async ({ page }) => {
    await seedState(page, makeState([
      makeTraining({ id: 't1', name: 'First' }),
      makeTraining({ id: 't2', name: 'Second' }),
    ]));
    await page.clock.install();
    await page.goto('/index.html');

    const first = await page.locator('.training-card', { hasText: 'First' }).locator('.name').boundingBox();
    const second = await page.locator('.training-card', { hasText: 'Second' }).boundingBox();
    if (!first || !second) throw new Error('cards not laid out');
    await page.mouse.move(first.x + 5, first.y + 5);
    await page.mouse.down();
    await page.clock.runFor(500);
    await page.mouse.move(first.x + 5, second.y + second.height - 4, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('.training-card .name')).toHaveText(['Second', 'First']);
    await expect(page.locator('#view-home')).toHaveClass(/active/); // the drop must not open the training

    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('pulse_data') ?? '{}'));
    expect(s.trainings.map(t => t.name)).toEqual(['Second', 'First']);

    await page.clock.runFor(400);
    await page.locator('.training-card', { hasText: 'First' }).locator('.name').click();
    await expect(page.locator('#detail-title')).toHaveText('First');
  });
});

// ─── unsaved-changes guard ──────────────────────────────────────────────────
test.describe('unsaved-changes guard', () => {
  test('edit modal: clean close does not ask, dirty close asks', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    const alpha = page.locator('.exercise-card', { hasText: 'Alpha' });
    const modal = page.locator('#modal');
    let dialogs = 0;
    page.on('dialog', d => { dialogs++; d.dismiss(); });

    await alpha.locator('.ex-name').click();
    await page.fill('#ed-wger-q', 'something'); // search box is not form data
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/open/);
    expect(dialogs).toBe(0);

    await alpha.locator('.ex-name').click();
    await page.fill('#ed-name', 'Changed');
    await page.keyboard.press('Escape');      // dismissed → stays open
    await expect(modal).toHaveClass(/open/);
    expect(dialogs).toBe(1);

    await page.getByRole('button', { name: 'Save' }).click(); // save never asks
    await expect(modal).not.toHaveClass(/open/);
    expect(dialogs).toBe(1);
    await expect(page.locator('.exercise-card', { hasText: 'Changed' })).toBeVisible();
  });

  test('manual add: leaving with changes asks, accepting leaves', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('#view-detail .btn-add').click();
    await page.locator('.tab[data-tab="manual"]').click();
    await page.fill('#man-name', 'Half typed');

    const back = page.locator('#view-add .header .btn-icon');
    // The confirm fires from hashchange, after click() resolves — await it explicitly.
    let dlg = page.waitForEvent('dialog');
    await back.click();
    await (await dlg).dismiss();
    await expect(page.locator('#view-add.active')).toBeVisible();
    await expect(page.locator('#man-name')).toHaveValue('Half typed');

    dlg = page.waitForEvent('dialog');
    await back.click();
    await (await dlg).accept();
    await expect(page.locator('#view-detail.active')).toBeVisible();
    await expect(page.locator('.exercise-card', { hasText: 'Half typed' })).toHaveCount(0);
  });
});
