// @ts-check
import { test, expect, seedState, makeState, makeTraining } from './fixtures.js';

// A trimmed /api/v2/exerciseinfo/ result: text and image carry their own license and author.
const SQUAT = {
  id: 615,
  category: { name: 'Legs' },
  muscles: [],
  equipment: [],
  translations: [
    { language: 2, name: 'Squat', description: '<p>Feet shoulder-width apart.</p>', license: 1, license_author: 'Jane Doe' },
  ],
  images: [
    {
      image: 'https://wger.de/media/exercise-images/615/squat.png',
      thumbnails: { small: 'https://wger.de/media/exercise-images/615/squat.png.200x200_q85.png' },
      is_main: true, license: 2, license_author: 'Photo Person',
    },
  ],
};

async function stubSearch(page, results = [SQUAT]) {
  await page.route(/wger\.de\/api\/v2\/exerciseinfo/, route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ results }),
  }));
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('pulse_data') ?? '{}'));

// ─── wger: attribution ──────────────────────────────────────────────────────
test.describe('wger attribution', () => {
  test('picking a search result stores and shows its license credit', async ({ page }) => {
    await stubSearch(page);
    await seedState(page, makeState());
    // Open the add view by URL: clicking + also re-routes on hashchange, which can clear the box.
    await page.goto('/index.html#add:t1');
    await expect(page.locator('#view-add')).toHaveClass(/active/);
    await page.fill('#wger-search', 'squat');

    const result = page.locator('#wger-results .search-result');
    await expect(result).toHaveCount(1);
    // Search cards load the 200px thumbnail, not the full image.
    expect(await result.locator('img').getAttribute('src')).toContain('200x200');
    await result.click();

    const ex = (await stored(page)).trainings[0].exercises.at(-1);
    expect(ex).toMatchObject({
      name: 'Squat',
      imageUrl: 'https://wger.de/media/exercise-images/615/squat.png',
      src: { wger: 615, text: { lic: 1, by: 'Jane Doe' }, img: { lic: 2, by: 'Photo Person' } },
    });

    await page.locator('.exercise-card', { hasText: 'Squat' }).locator('.ex-name').click();
    const credit = page.locator('#ed-credit');
    await expect(credit).toContainText('wger.de exercise #615');
    await expect(credit).toContainText('Text by Jane Doe, CC BY-SA 3.0');
    await expect(credit).toContainText('Image by Photo Person, CC BY-SA 4.0');
    await expect(credit.locator('a', { hasText: 'CC BY-SA 3.0' }))
      .toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/3.0/');
    await expect(credit.locator('a', { hasText: '#615' }))
      .toHaveAttribute('href', 'https://wger.de/en/exercise/615/view-base');
  });

  test('enhance from wger sets the credit on save', async ({ page }) => {
    await stubSearch(page);
    await seedState(page, makeState());
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('.exercise-card', { hasText: 'Alpha' }).locator('.ex-name').click();
    await expect(page.locator('#ed-credit')).toBeEmpty();

    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.locator('#ed-wger-status .search-result').click();
    await expect(page.locator('#ed-credit')).toContainText('Text by Jane Doe');
    await page.getByRole('button', { name: 'Save' }).click();

    const ex = (await stored(page)).trainings[0].exercises[0];
    expect(ex.src).toEqual({ wger: 615, text: { lic: 1, by: 'Jane Doe' }, img: { lic: 2, by: 'Photo Person' } });
  });

  test('image credit is dropped when the wger image is replaced', async ({ page }) => {
    await seedState(page, makeState([makeTraining({ exercises: [
      { id: 'e1', name: 'Squat', emoji: '🦵', s: 2, description: 'x', imageUrl: 'images/squats.svg',
        src: { wger: 615, text: { lic: 1, by: 'Jane Doe' }, img: { lic: 2, by: 'Photo Person' } } },
    ] })]));
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('.exercise-card .ex-name').click();
    await expect(page.locator('#ed-credit')).toContainText('Text by Jane Doe');
    await expect(page.locator('#ed-credit')).not.toContainText('Image');
  });

  test('legacy wger image without src gets a generic credit', async ({ page }) => {
    await seedState(page, makeState([makeTraining({ exercises: [
      { id: 'e1', name: 'Old', emoji: '🦵', s: 2, description: '', imageUrl: 'https://wger.de/media/x.png' },
    ] })]));
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('.exercise-card .ex-name').click();
    await expect(page.locator('#ed-credit')).toContainText('Image from wger.de');
  });

  test('player: wger exercise shows more, and the sheet carries the credit', async ({ page }) => {
    await seedState(page, makeState([makeTraining({ exercises: [
      { id: 'e1', name: 'Mine', emoji: '💪', s: 10, description: 'Short.' },
      { id: 'e2', name: 'Squat', emoji: '🦵', s: 10, description: 'Short.', src: { wger: 615, text: { lic: 1, by: 'Jane Doe' } } },
    ] })]));
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('.play-fab').click();
    await page.locator('.player-controls button').nth(2).click(); // → exercise "Mine"
    await expect(page.locator('#pl-name')).toHaveText('Mine');
    await expect(page.locator('#pl-more')).toBeHidden();
    await page.locator('.player-controls button').nth(2).click(); // → rest, showing "Squat"
    await expect(page.locator('#pl-name')).toHaveText('Squat');
    await page.locator('#pl-more').click();
    await expect(page.locator('#modal-body .credit')).toContainText('Text by Jane Doe, CC BY-SA 3.0');
  });

  test('about text names the license', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => /** @type {any} */ (window).openSettings());
    await expect(page.locator('.about')).toContainText('CC BY-SA');
    await expect(page.locator('.about')).not.toContainText('nothing is sent to any server');
  });
});

// ─── wger: share & import keep attribution ──────────────────────────────────
test.describe('wger share & import', () => {
  test('src survives the share payload round trip', async ({ page }) => {
    const src = { wger: 615, text: { lic: 1, by: 'Jane Doe' }, img: { lic: 2 } };
    await seedState(page, makeState([makeTraining({ exercises: [
      { id: 'e1', name: 'Squat', emoji: '🦵', s: 2, description: '', imageUrl: 'https://wger.de/media/x.png', src },
    ] })]));
    await page.goto('/index.html');
    const back = await page.evaluate(() => {
      // @ts-ignore
      const p = JSON.parse(JSON.stringify(toSharePayload(state.trainings[0])));
      // @ts-ignore
      return { payload: p.exercises[0].src, hydrated: hydrateTraining(p).exercises[0].src };
    });
    expect(back.payload).toEqual(src);
    expect(back.hydrated).toEqual(src);
  });

  test('imported src is sanitized', async ({ page }) => {
    await page.goto('/index.html');
    const out = await page.evaluate(() => {
      // @ts-ignore
      const h = e => hydrateTraining({ name: 'x', exercises: [e] }).exercises[0].src;
      return {
        bad: h({ name: 'a', src: { wger: 'javascript:alert(1)' } }),
        junk: h({ name: 'a', src: { wger: 5, text: { lic: 'x', by: 'Eve', extra: 1 }, img: 'nope', other: 1 } }),
      };
    });
    expect(out.bad).toBeUndefined();
    expect(out.junk).toEqual({ wger: 5, text: { lic: 0, by: 'Eve' } });
  });

  test('author names are escaped in the credit', async ({ page }) => {
    await seedState(page, makeState([makeTraining({ exercises: [
      { id: 'e1', name: 'Squat', emoji: '🦵', s: 2, description: '', src: { wger: 1, text: { lic: 1, by: '<img src=x onerror=alert(1)>' } } },
    ] })]));
    await page.goto('/index.html');
    await page.locator('.training-card').click();
    await page.locator('.exercise-card .ex-name').click();
    await expect(page.locator('#ed-credit img')).toHaveCount(0);
    await expect(page.locator('#ed-credit')).toContainText('<img src=x');
  });
});
