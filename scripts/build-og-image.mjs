// BRAND_ASSETS_V1: rebuilds og_final.png (1200x630), the share image every og:image and
// twitter:image tag points at. The filename stays so no tag or URL changes.
// Every word on it is copied from the live homepage hero; nothing new is said here.
//
// Rendered by Chromium through Playwright so Fraunces and Instrument Sans set exactly as they
// do on the site. Fonts come from @fontsource, installed ad hoc (no package manager here):
//   npm i --prefix /tmp/brand playwright @fontsource/fraunces@5.1.0 @fontsource/instrument-sans@5.1.0
//   FONT_DIR=/tmp/brand/node_modules/@fontsource NODE_PATH=/tmp/brand/node_modules node scripts/build-og-image.mjs
// Run from the repo root. Set CHROMIUM_PATH if Playwright's own browser is not installed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const FONT_DIR = process.env.FONT_DIR;
const font = (pkg, file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(FONT_DIR, pkg, 'files', file)).toString('base64');
// The <style> in favicon.svg (its dark-tab rule) is dropped so the share image is always the
// brown mark, whatever colour scheme the rendering browser reports.
const mark = fs.readFileSync('favicon.svg', 'utf8').replace(/<style>[\s\S]*?<\/style>/, '').replace('aria-hidden="true"', 'width="46" height="46"');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;font-weight:400;font-style:normal;src:url(${font('fraunces', 'fraunces-latin-400-normal.woff2')})}
@font-face{font-family:Fraunces;font-weight:400;font-style:italic;src:url(${font('fraunces', 'fraunces-latin-400-italic.woff2')})}
@font-face{font-family:Fraunces;font-weight:500;font-style:normal;src:url(${font('fraunces', 'fraunces-latin-500-normal.woff2')})}
@font-face{font-family:'Instrument Sans';font-weight:400;src:url(${font('instrument-sans', 'instrument-sans-latin-400-normal.woff2')})}
@font-face{font-family:'Instrument Sans';font-weight:500;src:url(${font('instrument-sans', 'instrument-sans-latin-500-normal.woff2')})}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px}
body{background:#F8F2EC;color:#47372B;position:relative;overflow:hidden;font-family:'Instrument Sans',sans-serif}
.brand{position:absolute;left:80px;top:64px;display:flex;align-items:center;gap:14px;font-family:Fraunces;font-weight:500;font-size:36px;letter-spacing:-.01em}
h1{position:absolute;left:80px;top:178px;font-family:Fraunces;font-weight:400;font-size:76px;line-height:1.06;letter-spacing:-.02em}
h1 em{display:block;font-style:italic;color:#9C5E47}
.sub{position:absolute;left:80px;top:392px;width:900px;font-size:28px;line-height:1.45;color:#6B5545}
.url{position:absolute;left:80px;bottom:52px;font-size:22px;font-weight:500;letter-spacing:.01em}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:#D47C65}
</style></head><body>
<div class="brand">${mark}BioWellth</div>
<h1>Your tests came back normal.<em>You're still exhausted.</em></h1>
<p class="sub">A blood panel read for South Asian women. Tracked over time. Explained by Sana.</p>
<div class="url">biowellth.ai</div>
<div class="bar"></div>
</body></html>`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const ok = await page.evaluate(() => ['500 36px Fraunces', 'italic 400 76px Fraunces', '400 28px "Instrument Sans"'].every((f) => document.fonts.check(f)));
if (!ok) throw new Error('a brand font did not load; refusing to render a fallback-font share image');
await page.screenshot({ path: 'og_final.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('built og_final.png 1200x630');
