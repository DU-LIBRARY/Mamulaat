// Renders public/logo.svg into the PNG icons used by the PWA manifest.
// Usage: NODE_PATH=$(npm root -g) node scripts/generate-icons.mjs  (needs Playwright + Chromium)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/logo.svg', import.meta.url), 'utf8');
// Home-screen icons are masked by the phone (iOS rounds the corners, Android picks a shape), so
// they get the same design edge to edge: square corners, and for "maskable" the artwork pulled
// into the central safe zone while the two-tone background still fills the whole square.
const square = svg.replace('rx="14"', 'rx="0"');
const maskable = square
  .replace('<path d="M34', '<g transform="translate(32 32) scale(0.8) translate(-32 -32)"><path d="M34')
  .replace('</svg>', '</g></svg>');
// Monochrome notification badge: the same crescent and tick, in white.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M34 12a20 20 0 1 0 14 34A16 16 0 1 1 34 12z" fill="#fff"/><path transform="translate(31 21) scale(0.85)" d="M0 7.6c1.6 1.4 3.6 3.6 5 5.4c.9 1.1 2.3 1.1 3.1-.1C11 8 14.6 3.4 19.4 .4" fill="none" stroke="#fff" stroke-width="5.88" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// Icons live in a versioned folder (icons/v2/): browsers and phones cache icons by address for a
// long time, so a new logo gets new addresses. Bump the folder when the logo changes again.
const jobs = [
  { file: 'icon-192.png', size: 192, html: svg, pad: 0, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, html: svg, pad: 0, bg: 'transparent' },
  { file: 'apple-touch-icon.png', size: 180, html: square, pad: 0, bg: '#1f4d3b' },
  { file: 'icon-maskable-512.png', size: 512, html: maskable, pad: 0, bg: '#1f4d3b' },
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
  await page.screenshot({ path: `public/icons/v2/${j.file}`, omitBackground: j.bg === 'transparent' });
  console.log('wrote', j.file);
}
await browser.close();
