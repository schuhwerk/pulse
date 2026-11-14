// PNG icons from the SVGs, for platforms that ignore SVG icons (iOS home screen, older Android).
// icon-180.png: apple-touch-icon, full bleed (iOS rounds the corners itself).
// icon-192.png / icon-512.png: manifest icons.
// Usage: bun run icons
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const root = join(import.meta.dir, '..');
const jobs = [
  ['icon-maskable.svg', 180, 'icon-180.png'],
  ['icon.svg', 192, 'icon-192.png'],
  ['icon.svg', 512, 'icon-512.png'],
];

const browser = await chromium.launch();
for (const [src, size, out] of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = await Bun.file(join(root, src)).text();
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: join(root, out), omitBackground: true });
  await page.close();
  console.log(out);
}
await browser.close();
