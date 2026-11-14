// README screenshots → docs/screenshots/{home,detail,exercise,rest}.png (390×844 @2×).
// Usage: bun run screenshots
import { join, normalize } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dir, '..');
const out = join(root, 'docs/screenshots');

// 127.0.0.1, not localhost: on localhost the app shortens player countdowns for tests.
const server = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  async fetch(req) {
    const file = Bun.file(join(root, normalize(decodeURIComponent(new URL(req.url).pathname))));
    return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 });
  },
});

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block',
});
await ctx.addInitScript(() => { window.__SKIP_WELCOME__ = true; });
const page = await ctx.newPage();
// serviceWorkers:'block' makes SW registration throw on `.waiting`; that one is expected.
page.on('pageerror', e => { if (!e.message.includes("'waiting'")) console.error('page error:', e.message); });
const shot = async (name, wait = 800) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(`${name}.png`);
};

await page.goto(`http://127.0.0.1:${server.port}/index.html`);
await page.waitForTimeout(800);
// Show a "last done" line on the first training.
await page.evaluate(() => {
  window._pulse.getState().trainings[0].lastCompleted = new Date(Date.now() - 86400000).toISOString();
  renderHome();
});
await shot('home');

await page.locator('.training-card').first().click();
await shot('detail');

await page.evaluate(() => { startPlayer(); pl.exerciseIdx = 0; clearInterval(pl.timer); beginExercise(); });
await shot('exercise', 3300);

await page.evaluate(() => { clearInterval(pl.timer); pl.exerciseIdx = 5; beginRest(); });
await shot('rest', 2300);

await browser.close();
server.stop();
