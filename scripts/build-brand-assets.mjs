// BRAND_ASSETS_V1: regenerates every raster icon from favicon.svg, the vector source of the
// mark. Nothing here recolours an old PNG; each file is rendered fresh from the SVG paths.
//
// No package manager in this repo, so the two renderers are installed ad hoc:
//   npm i --prefix /tmp/brand @resvg/resvg-js@2.6.2 png-to-ico@2.1.8
//   NODE_PATH=/tmp/brand/node_modules node scripts/build-brand-assets.mjs
// Run from the repo root. og_final.png is NOT built here; see scripts/build-og-image.mjs.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');
const pngToIco = require('png-to-ico');

const BROWN = '#47372B';
const CREAM = '#F8F2EC';
const src = fs.readFileSync('favicon.svg', 'utf8');
// The inner geometry of the mark, with the root <svg> wrapper and its fill stripped.
// BRAND_ASSETS_V1: the <style> block is stripped too. favicon.svg carries a
// prefers-color-scheme rule for browser tabs, and a CSS path fill would override the
// cream fill these rasters set, so every icon here is coloured only by markSvg and tileSvg.
const inner = src.replace(/^<svg[^>]*>/, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<\/svg>\s*$/, '');

function render(svg, size, out) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  if (out) fs.writeFileSync(out, png);
  return png;
}
// Brown mark on transparent. The paths fill about 88% of the 100x100 viewBox, which is the
// same framing the previous icons used.
const markSvg = (fill) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="${fill}" fill-rule="evenodd">${inner}</svg>`;
// Cream mark on a solid brown square. The mark is scaled to 72% of the tile, inside the
// maskable safe zone (a centred circle of 80% diameter), so no platform mask clips it.
function tileSvg() {
  const MARK = 0.72 / 0.885;                 // viewBox scale that makes the drawn mark 72% wide
  const off = (1 - MARK) * 50;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="100" height="100" fill="${BROWN}"/>` +
    `<svg x="${off}" y="${off}" width="${MARK * 100}" height="${MARK * 100}" viewBox="0 0 100 100" fill="${CREAM}" fill-rule="evenodd">${inner}</svg></svg>`;
}

render(markSvg(BROWN), 512, 'logo.png');
render(markSvg(BROWN), 96, 'favicon-96x96.png');
render(markSvg(BROWN), 32, 'favicon-32x32.png');
render(markSvg(BROWN), 16, 'favicon-16x16.png');
const ico = await pngToIco([16, 32, 48].map((s) => render(markSvg(BROWN), s)));
fs.writeFileSync('favicon.ico', ico);
render(tileSvg(), 180, 'apple-touch-icon.png');
render(tileSvg(), 192, 'web-app-manifest-192x192.png');
render(tileSvg(), 512, 'web-app-manifest-512x512.png');
console.log('built logo.png, favicon-96x96/32x32/16x16.png, favicon.ico, apple-touch-icon.png, web-app-manifest-192/512.png');
