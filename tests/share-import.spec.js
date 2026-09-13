// @ts-check
import { test, expect, seedState, makeState, makeTraining } from './fixtures.js';

// ─── share links & import ───────────────────────────────────────────────────
test.describe('share links & import', () => {
  test('importing a share link shows confirm modal then adds training', async ({ page }) => {
    // Start with one training so we can build a share link via the app itself.
    await seedState(page, makeState());
    await page.goto('/index.html');

    const url = await page.evaluate(async () => {
      // @ts-ignore
      currentTrainingId = state.trainings[0].id;
      // @ts-ignore
      return await encodeShareUrl(state.trainings[0]);
    });
    const hash = new URL(url).hash; // "#import=..."

    // Now wipe state and navigate to the share URL — simulates a fresh user
    // opening a shared link.
    await page.evaluate(() => localStorage.removeItem('pulse_data'));
    await page.goto('/index.html' + hash);

    await expect(page.locator('#modal.open')).toBeVisible();
    await expect(page.locator('#modal-title')).toHaveText('Import Training');
    await expect(page.locator('#modal-body')).toContainText('Test Workout');
    await expect(page.locator('#modal-body')).toContainText('Alpha');

    await page.getByRole('button', { name: 'Import' }).click();

    // Imported and routed into detail view for the new training.
    await expect(page.locator('#view-detail.active')).toBeVisible();
    await expect(page.locator('#detail-title')).toHaveText('Test Workout');
  });

  test('invalid share link shows toast', async ({ page }) => {
    // Trigger via hashchange after initial load so routeHash definitely fires
    // (avoids any ambiguity about init-time ordering with the hash present).
    await page.goto('/index.html');
    await page.evaluate(() => { location.hash = '#import=%%%not-base64%%%'; });
    await expect(page.locator('#toast')).toContainText('Invalid share link');
    await expect(page.locator('#view-home.active')).toBeVisible();
  });

  test('import JSON backup via file input (overwrite flow)', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('button[title="Settings"]').click();

    const backup = {
      trainings: [makeTraining({ id: 'b1', name: 'From Backup', exercises: [
        { id: 'bx', name: 'Squats', emoji: '🦵', s: 30 },
      ]})],
      settings: { restDefault: 8, audioEnabled: false },
    };

    // Feed the hidden file input directly.
    await page.locator('#import-file').setInputFiles({
      name: 'pulse-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });

    await expect(page.locator('#modal-title')).toHaveText('Import Backup');
    await expect(page.locator('#modal-body')).toContainText('overwrite all your data');
    await page.getByRole('button', { name: 'Overwrite' }).click();

    // commitFullImport → goHome() is a no-op when hash is already empty, so
    // the home list isn't re-rendered in-place. Reloading reads the new state.
    await page.reload();
    await expect(page.locator('#view-home.active')).toBeVisible();
    await expect(page.locator('.training-card', { hasText: 'From Backup' })).toBeVisible();
    await expect(page.locator('.training-card', { hasText: 'Test Workout' })).toHaveCount(0);
  });

  test('share payload round-trip preserves exercises', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    const result = await page.evaluate(async () => {
      // @ts-ignore
      const t = state.trainings[0];
      // @ts-ignore
      const url = await encodeShareUrl(t);
      const b64 = url.split('#import=')[1];
      // @ts-ignore
      const decoded = await decodeSharePayload(b64);
      return { decoded, original: { name: t.name, exCount: t.exercises.length, firstName: t.exercises[0].name } };
    });
    expect(result.decoded.name).toBe(result.original.name);
    expect(result.decoded.exercises.length).toBe(result.original.exCount);
    expect(result.decoded.exercises[0].name).toBe(result.original.firstName);
  });

  test('share link is compressed (smaller than raw base64) and round-trips', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    const r = await page.evaluate(async () => {
      // wger descriptions are verbose, repetitive HTML — exactly what compresses well.
      const desc = '<p>Keep your core tight and breathe steadily throughout the movement.</p>'.repeat(8);
      // @ts-ignore
      const t = { name: 'Heavy', restSeconds: 8, exercises: Array.from({ length: 12 }, (_, i) => ({
        name: 'Exercise ' + i, emoji: '💪', s: 30, description: desc,
        imageUrl: 'https://wger.de/media/exercise-images/' + i + '/Some-Exercise-1.png',
      })) };
      // @ts-ignore
      const url = await encodeShareUrl(t);
      const b64 = url.split('#import=')[1];
      const json = JSON.stringify(t);
      const rawLen = btoa(unescape(encodeURIComponent(json))).length;
      // @ts-ignore
      const decoded = await decodeSharePayload(b64);
      return { compressedLen: b64.length, rawLen, name: decoded.name, exCount: decoded.exercises.length, firstImg: decoded.exercises[0].imageUrl };
    });
    expect(r.compressedLen).toBeLessThan(r.rawLen);
    expect(r.name).toBe('Heavy');
    expect(r.exCount).toBe(12);
    // wger host stripped from the payload to save space.
    expect(r.firstImg).toBe('/media/exercise-images/0/Some-Exercise-1.png');
  });

  test('imported wger image url is re-expanded to absolute', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    const url = await page.evaluate(async () => {
      // @ts-ignore
      const t = { name: 'Pic', restSeconds: 8, exercises: [
        { name: 'Squat', emoji: '🦵', s: 30, imageUrl: 'https://wger.de/media/x.png' },
      ] };
      // @ts-ignore
      return await encodeShareUrl(t);
    });
    await page.evaluate(() => localStorage.removeItem('pulse_data'));
    await page.goto('/index.html' + new URL(url).hash);
    await page.getByRole('button', { name: 'Import' }).click();
    const img = await page.evaluate(() => {
      // @ts-ignore
      return state.trainings[state.trainings.length - 1].exercises[0].imageUrl;
    });
    expect(img).toBe('https://wger.de/media/x.png');
  });

  test('oversized workout warns instead of sharing a broken link', async ({ page }) => {
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.evaluate(() => {
      // @ts-ignore
      currentTrainingId = state.trainings[0].id;
      // Incompressible random content large enough to exceed SHARE_URL_MAX even after deflate.
      const rnd = (n) => Array.from({ length: n }, () => Math.random().toString(36)[2]).join('');
      // @ts-ignore
      const t = getTraining();
      t.exercises = Array.from({ length: 60 }, (_, i) => ({ id: 'big' + i, name: rnd(400), emoji: '💪', s: 30, description: rnd(400) }));
    });
    await page.evaluate(() => shareTraining());
    await expect(page.locator('#toast')).toContainText('too large for a link');
  });
});
