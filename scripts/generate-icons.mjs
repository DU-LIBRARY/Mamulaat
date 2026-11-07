// Renders public/favicon.svg into the PNG icons used by the PWA manifest.
// Usage: NODE_PATH=$(npm root -g) node scripts/generate-icons.mjs  (needs Playwright + Chromium)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M40 10a20 20 0 1 0 14 34A16 16 0 1 1 40 10z" fill="#fff"/><path d="M20 33l7 7 15-16" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const jobs = [
  { file: 'icon-192.png', size: 192, html: svg, pad: 0, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, html: svg, pad: 0, bg: 'transparent' },
  { file: 'apple-touch-icon.png', size: 180, html: svg, pad: 0, bg: '#0f5132' },
  { file: 'icon-maskable-512.png', size: 512, html: svg, pad: 0.12, bg: '#0f5132' },
  { file: 'badge-72.png', size: 72, html: badge, pad: 0.05, bg: 'transparent' },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  const inner = Math.round(j.size * (1 - 2 * j.pad));
  await page.setContent(
    `<html><body style="margin:0;background:${j.bg};display:flex;align-items:center;justify-content:center;width:${j.size}px;height:${j.size}px">
     <div style="width:${inner}px;height:${inner}px">${j.html.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`,
  );
  await page.screenshot({ path: `public/icons/${j.file}`, omitBackground: j.bg === 'transparent' });
  console.log('wrote', j.file);
}
await browser.close();
