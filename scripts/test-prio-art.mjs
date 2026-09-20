#!/usr/bin/env node
// PRIO_ART_V1 -- the priority card drawings, extracted from dashboard.html so the suite exercises
// shipped source rather than a copy that can drift. Same technique as test-dob-gate.mjs.
//
// THE LOAD-BEARING PROPERTY is that a safety-class priority carries NO drawing. A heavy-metals,
// autoimmune or tumour-marker card is not a place for a decorative mark, and the exclusion lives
// inside the renderer rather than at the call site so a future caller cannot forget it. The second
// is that an unmapped system falls back to NOTHING: a generic shape would be decoration pretending
// to be information about a system we have no drawing for.
//
// The system comes from the DRIVER MARKER via chipSysByMarker, never priority.system_id, which the
// note beside the verdict builder records as model-chosen and unstable.
//
//   node scripts/test-prio-art.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

function extract(name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found in " + FILE + ": " + name);
  let i = HTML.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced braces: " + name);
  return HTML.slice(m.index, end);
}
function extractBlock(name) {
  const re = new RegExp("const\\s+" + name + "\\s*=\\s*\\{");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a block const in " + FILE + ": " + name);
  let i = HTML.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced block: " + name);
  return HTML.slice(m.index, end) + ";";
}
function extractLine(name) {
  const re = new RegExp("^const\\s+" + name + "\\s*=.*;\\s*$", "m");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a one-line const in " + FILE + ": " + name);
  return m[0];
}

const src = [extractLine("SENSITIVE_SYSTEMS"), extractBlock("PRIO_ART"), extractBlock("PRIO_ART_TONE"),
             extractBlock("CANONICAL_TITLE"), extract("prioArtSVG"),
             ";globalThis.__art = prioArtSVG; globalThis.__set = PRIO_ART; globalThis.__tone = PRIO_ART_TONE;",
             ";globalThis.__titles = CANONICAL_TITLE; globalThis.__sens = SENSITIVE_SYSTEMS;"].join("\n");
new Function(src)();
const art = globalThis.__art, SET = globalThis.__set, TONE = globalThis.__tone;
const TITLES = globalThis.__titles, SENS = globalThis.__sens;
const strokeOf = (html) => { const m = /stroke="([^"]+)"/.exec(html); return m ? m[1] : null; };
const tintOf = (html) => { const m = /background:([^;]+);/.exec(html); return m ? m[1] : null; };

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const artCount = (html) => (html.match(/class="prio-art"/g) || []).length;
const pathCount = (html) => (html.match(/<path /g) || []).length;

console.log("ONE DRAWING PER MAPPED SYSTEM");
{
  const html = art("iron_status", 0, "t-coral");
  eq(artCount(html), 1, "ART-1: a mapped system renders exactly one drawing");
  ok(pathCount(html) >= 1, "ART-2: and it carries at least one path  (" + pathCount(html) + ")");
  ok(html.includes('viewBox="0 0 124 104"'), "ART-3: the viewBox is 124 by 104");
  ok(html.includes('aria-hidden="true"'), "ART-4: the drawing is hidden from assistive tech, being decorative");
  ok(html.includes("--pa-i:0"), "ART-5: the card index rides along for the stagger");
  ok(art("liver", 2, "t-coral").includes("--pa-i:2"), "ART-6: and it is the card's own index");
}

console.log("NO DRAWING RATHER THAN A GENERIC ONE");
{
  eq(art("no_such_system", 0, "t-coral"), "", "ART-7: an unmapped system renders nothing");
  eq(art(null, 0, "t-coral"), "", "ART-8: a missing system renders nothing");
  eq(art(undefined, 0, "t-coral"), "", "ART-9: undefined renders nothing");
  eq(art("", 0, "t-coral"), "", "ART-10: an empty system renders nothing");
}

console.log("SAFETY CLASSES CARRY NO DECORATION");
{
  eq(art("heavy_metals", 0, "t-coral"), "", "SAFE-1: a heavy-metals priority renders no drawing");
  eq(art("autoimmune", 0, "t-amber"), "", "SAFE-2: an autoimmune priority renders no drawing");
  eq(art("tumor_markers", 0, "t-neutral"), "", "SAFE-3: a tumour-marker priority renders no drawing");
  // The control: an ordinary priority beside them DOES draw, so SAFE-1 to SAFE-3 are not passing
  // against a renderer that returns nothing for everything.
  ok(artCount(art("thyroid", 1, "t-coral")) === 1, "SAFE-4: an ordinary priority beside them still draws");
  for (const id of SENS) ok(art(id, 0, "t-coral") === "", "SAFE-5." + id + ": every id in SENSITIVE_SYSTEMS draws nothing");
  ok(SENS.size >= 3, "SAFE-6: the extracted safety set is the real one, not an empty stand-in  (" + SENS.size + ")");
}

console.log("THE SET ITSELF");
{
  const keys = Object.keys(SET);
  ok(keys.length > 0, "SET-1: the drawing set is not empty  (" + keys.length + " systems)");
  // "covers each system id exactly once" -- an object cannot hold a duplicate key, so the check
  // that means something is against the SOURCE text, where a repeated key would silently win.
  const block = extractBlock("PRIO_ART");
  for (const k of keys) {
    const hits = (block.match(new RegExp("^\\s*" + k + ":", "gm")) || []).length;
    eq(hits, 1, "SET-2." + k + ": declared exactly once in the source");
  }
  for (const k of keys) ok(!SENS.has(k), "SET-3." + k + ": is not a safety class");
  for (const k of keys) ok(Object.prototype.hasOwnProperty.call(TITLES, k),
    "SET-4." + k + ": is a real system id, present in CANONICAL_TITLE");
  for (const k of keys) {
    const a = SET[k];
    ok(Array.isArray(a) && a.length > 0, "SET-5." + k + ": is a plain array of paths, shape only");
    ok(a.every(p => typeof p === "string" && p.length > 2), "SET-6." + k + ": every entry is a path string");
  }
  // THE SYSTEM-TO-ACCENT MAPPING IS GONE. Colour comes from the card's tone now, so no drawing may
  // carry a colour of its own; that mapping was a choice this codebase had not made.
  const artBlock = extractBlock("PRIO_ART");
  ok(artBlock.indexOf("stroke:") === -1, "SET-8: no per-system stroke survives in the drawing set");
  ok(artBlock.indexOf("tint:") === -1, "SET-9: nor a per-system tint");
}

console.log("COLOUR FOLLOWS TONE, NOT SYSTEM");
{
  const coral = art("iron_status", 0, "t-coral");
  const amber = art("iron_status", 1, "t-amber");
  const neutral = art("iron_status", 2, "t-neutral");
  const strokes = [strokeOf(coral), strokeOf(amber), strokeOf(neutral)];
  eq(new Set(strokes).size, 3, "TONE-1: three tones render three different strokes  (" + strokes.join(", ") + ")");
  const tints = [tintOf(coral), tintOf(amber), tintOf(neutral)];
  eq(new Set(tints).size, 3, "TONE-2: and three different tints  (" + tints.join(", ") + ")");
  // The SAME system in three tones, so the difference can only be the tone.
  const shapes = [coral, amber, neutral].map(h => (h.match(/ d="[^"]+"/g) || []).join("|"));
  eq(new Set(shapes).size, 1, "TONE-3: the SHAPE is identical across tones, because shape still means system");
  // And two different systems in one tone share a colour but not a shape.
  const a = art("iron_status", 0, "t-coral"), b = art("thyroid", 0, "t-coral");
  eq(strokeOf(a), strokeOf(b), "TONE-4: two systems in one tone share the stroke");
  ok((a.match(/ d="[^"]+"/g) || []).join("|") !== (b.match(/ d="[^"]+"/g) || []).join("|"),
     "TONE-5: and still differ in shape");
  for (const k of Object.keys(TONE)) {
    ok(TONE[k].stroke.indexOf("var(--") === 0, "TONE-6." + k + ": strokes with an existing token");
    ok(TONE[k].tint.indexOf("var(--") === 0, "TONE-7." + k + ": tints with an existing token");
  }
  eq(strokeOf(art("iron_status", 0, "t-nonsense")), TONE["t-neutral"].stroke,
     "TONE-8: an unknown tone falls to neutral, never to no drawing");
  eq(strokeOf(art("iron_status", 0, undefined)), TONE["t-neutral"].stroke, "TONE-9: and so does a missing tone");
}

// THE SOURCE-TEXT SECTION IS GONE, and that is the lesson of this file's own outage. It used to
// assert things like /if\(!PRIO_ART_DRAWN\)\{/.test(HTML), which passed while the identifier was
// declared inside the priorities map callback and threw ReferenceError at runtime. A regex proves a
// string is present in a file; it cannot prove an identifier resolves. Everything those assertions
// claimed is now claimed by scripts/test-dashboard-e2e.mjs, which RUNS renderDashboard in a browser
// and reads computed styles and rendered DOM instead of file text.

console.log("KNOWN-POSITIVE CONTROLS -- the harness can actually fail");
{
  let threw = false;
  try { extract("thisFunctionDoesNotExist"); } catch (_) { threw = true; }
  ok(threw, "CTRL-1: extract() throws on a missing function, so a silent no-op is impossible");
  let threw2 = false;
  try { extractBlock("NOT_A_REAL_BLOCK"); } catch (_) { threw2 = true; }
  ok(threw2, "CTRL-2: extractBlock() throws too");
  // Source-text, and labelled as such. The RENDERED claim, that no coral border paints on a
  // real card, is asserted from computed style in scripts/test-dashboard-e2e.mjs.
  ok(HTML.indexOf("border-left:4px solid var(--coral)") === -1,
     "CTRL-3: the removed border string is gone from the file");
  ok(HTML.indexOf("border-radius:16px") > -1,
     "CTRL-4: and a neighbouring .prio property IS still present, so CTRL-3 is not matching an empty file");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
