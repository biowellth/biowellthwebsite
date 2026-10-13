// BRAND_ASSETS_V1: regenerates every raster icon from favicon.svg, the vector source of the
// mark. Nothing here recolours an old PNG; each file is rendered fresh from the SVG paths.
//
// No package manager in this repo, so the two renderers are installed ad hoc:
//   npm i --prefix /tmp/brand @resvg/resvg-js@2.6.2 png-to-ico@2.1.8
//   NODE_PATH=/tmp/brand/node_modules node scripts/build-brand-assets.mjs
// Run from the repo root. og_final.png is NOT built here; see scripts/build-og-image.mjs.
//
// FAVICON_OLIVE_V1 (2026-10-13): the brown favicon disappeared on Chrome's dark tab strip.
// favicon.svg is now the finished icon, an olive disc with the mark in cream at 62% of the disc,
// and the tab icons are rendered from it as is. The apple-touch and manifest tiles are the same
// mark on a full-bleed olive square (iOS and the maskable mask round it themselves).
// logo.png is NOT an icon and keeps the plain brown mark, so it is built from the mark block
// alone, which is byte-identical to what this script used as `inner` before.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');
const pngToIco = require('png-to-ico');

const BROWN = '#47372B';
const OLIVE = '#59663A';
const src = fs.readFileSync('favicon.svg', 'utf8');
// FAVICON_OLIVE_V1: the mark's own geometry, the group that holds its paths. Before this change
// it was everything inside the root <svg> once the <style> was stripped; it is now nested inside
// the disc's placement group, so it is cut out by its own opening tag instead. Throws rather than
// guessing if favicon.svg changes shape.
const MARK_RE = /<g transform="scale\(0\.142450\)">[\s\S]*?<\/g><\/g>/;
const mm = src.match(MARK_RE);
if (!mm) throw new Error('build-brand-assets: the mark group was not found in favicon.svg');
const MARK = mm[0];

function render(svg, size, out) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  if (out) fs.writeFileSync(out, png);
  return png;
}
// Brown mark on transparent, for logo.png only. The paths fill about 88% of the 100x100 viewBox.
const markSvg = (fill) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="${fill}" fill-rule="evenodd">${MARK}</svg>`;
// FAVICON_OLIVE_V1: the tab icon is favicon.svg itself.
const discSvg = () => src;
// FAVICON_OLIVE_V1: the same placement as the disc, on a full-bleed olive square. The mark at 62%
// sits inside the maskable safe zone (a centred circle of 80% diameter). Was a brown square with
// the mark at 72%.
const tileSvg = () => src.replace(/<circle cx="50" cy="50" r="50" fill="#59663A"\/>/, `<rect width="100" height="100" fill="${OLIVE}"/>`);
if (tileSvg() === src) throw new Error('build-brand-assets: the disc was not found in favicon.svg');

render(markSvg(BROWN), 512, 'logo.png');
render(discSvg(), 96, 'favicon-96x96.png');
render(discSvg(), 32, 'favicon-32x32.png');
render(discSvg(), 16, 'favicon-16x16.png');
const ico = await pngToIco([16, 32, 48].map((s) => render(discSvg(), s)));
fs.writeFileSync('favicon.ico', ico);
render(tileSvg(), 180, 'apple-touch-icon.png');
render(tileSvg(), 192, 'web-app-manifest-192x192.png');
render(tileSvg(), 512, 'web-app-manifest-512x512.png');
console.log('built logo.png, favicon-96x96/32x32/16x16.png, favicon.ico, apple-touch-icon.png, web-app-manifest-192/512.png');
