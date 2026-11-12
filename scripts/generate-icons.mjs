// Renders public/icons/v3/logo.svg into the PNG icons used by the PWA manifest.
// Usage: NODE_PATH=$(npm root -g) node scripts/generate-icons.mjs  (needs Playwright + Chromium)
//
// Icons live in a versioned folder (icons/v3/): browsers and phones cache icons by address for a
// long time, so a new logo gets new addresses. When the logo changes, copy it into a new folder,
// update DIR here and the references (index.html, vite.config.ts manifest, src/sw.ts, and the
// <img> tags in Layout.tsx, quiet.tsx and SignIn.tsx), then run this script.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const DIR = 'public/icons/v3';
const svg = readFileSync(new URL(`../${DIR}/logo.svg`, import.meta.url), 'utf8');
// Home-screen icons are masked by the phone (iOS rounds the corners, Android picks a shape), so
// they get the background edge to edge with square corners; "maskable" also pulls the artwork
// into the central safe zone.
const square = svg.replace(/(<rect id="bg"[^>]*?)rx="[\d.]+"/, '$1rx="0"');
const maskable = square.replace('<g id="art">', '<g id="art" transform="translate(32 32) scale(0.8) translate(-32 -32)">');
// Monochrome notification badge: the book in white with the tick cut out.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><mask id="m"><rect width="64" height="64" fill="#fff"/><path d="M32 22v26" stroke="#000" stroke-width="2"/><path transform="translate(23.5 26.5) scale(0.85)" d="M0 7.6c1.6 1.4 3.6 3.6 5 5.4c.9 1.1 2.3 1.1 3.1-.1C11 8 14.6 3.4 19.4 .4" fill="none" stroke="#000" stroke-width="5.9" stroke-linecap="round" stroke-linejoin="round"/></mask><path d="M32 22c-5-4-11-5-18-4v26c7-1 13 0 18 4c5-4 11-5 18-4V18c-7-1-13 0-18 4z" fill="#fff" mask="url(#m)" transform="translate(32 33) scale(1.25) translate(-32 -33)"/></svg>`;
const jobs = [
  { file: 'icon-192.png', size: 192, html: svg, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, html: svg, bg: 'transparent' },
  { file: 'apple-touch-icon.png', size: 180, html: square, bg: '#15553a' },
  { file: 'icon-maskable-512.png', size: 512, html: maskable, bg: '#15553a' },
  { file: 'badge-72.png', size: 72, html: badge, bg: 'transparent' },
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewportSize({ width: j.size, height: j.size });
  await page.setContent(
    `<html><body style="margin:0;background:${j.bg};width:${j.size}px;height:${j.size}px">${j.html.replace('<svg ', `<svg width="${j.size}" height="${j.size}" `)}</body></html>`,
  );
  await page.screenshot({ path: `${DIR}/${j.file}`, omitBackground: j.bg === 'transparent' });
  console.log('wrote', j.file);
}
await browser.close();
