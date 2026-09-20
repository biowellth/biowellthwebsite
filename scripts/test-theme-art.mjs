#!/usr/bin/env node
// THEME_ART_V1 -- the theme card motifs, extracted from dashboard.html so the suite exercises
// shipped source rather than a copy that can drift.
//
// THE LOAD-BEARING PROPERTY is that every motif is a real shape for a system the theme actually
// talks about, and never a safety-class one. Nothing in this repo can say which SYSTEMS a theme
// contains: THEME_DEFS carries only key, label and desc, membership is per MARKER through
// RANGES_LOOKUP.themes_by_marker_id, and the two marker-to-system maps are built at runtime from
// the payload on screen. So the membership claim this file can make, and does make, is that the
// chosen system's CANONICAL_TITLE shares a word with that theme's own authored label or desc.
//
// NO ASSERTION HERE IS A SOURCE-TEXT REGEX. That mistake shipped once already: a regex proved
// PRIO_ART_DRAWN was written in the file while it was out of scope at runtime. Everything below
// either runs themeArtSVG or inspects an object that was evaluated out of the shipped source.
// The rendered claims, that the motif is behind the text and that an unmapped theme has none,
// belong to scripts/test-dashboard-e2e.mjs, which renders the real page.
//
//   node scripts/test-theme-art.mjs        (or DASH=path/to/dashboard.html)
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
// Brace or bracket matched blocks, at any indentation, so a const declared inside a function
// (THEME_SENSITIVE is) can still be loaded rather than retyped here.
function extractBlock(name, open = "{") {
  const close = open === "{" ? "}" : "]";
  const re = new RegExp("const\\s+" + name + "\\s*=\\s*(?:new Set\\()?\\s*\\" + open);
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a block const in " + FILE + ": " + name);
  let i = HTML.indexOf(open, m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === open) depth++;
    else if (HTML[j] === close) { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced block: " + name);
  const isSet = /new Set\(/.test(m[0]);
  return "const " + name + " = " + (isSet ? "new Set(" : "") + HTML.slice(i, end) + (isSet ? ")" : "") + ";";
}
function extractLine(name) {
  const re = new RegExp("^const\\s+" + name + "\\s*=.*;\\s*$", "m");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a one-line const in " + FILE + ": " + name);
  return m[0];
}

const src = [extractLine("SENSITIVE_SYSTEMS"), extractBlock("PRIO_ART"), extractBlock("THEME_ART"),
             extractBlock("CANONICAL_TITLE"), extractBlock("THEME_DEFS", "["),
             extractBlock("THEME_SENSITIVE", "["), extract("themeArtSVG"),
             ";globalThis.__art = themeArtSVG; globalThis.__map = THEME_ART; globalThis.__shapes = PRIO_ART;",
             ";globalThis.__titles = CANONICAL_TITLE; globalThis.__defs = THEME_DEFS;",
             ";globalThis.__sens = SENSITIVE_SYSTEMS; globalThis.__tsens = THEME_SENSITIVE;"].join("\n");
new Function(src)();
const art = globalThis.__art, MAP = globalThis.__map, SHAPES = globalThis.__shapes;
const TITLES = globalThis.__titles, DEFS = globalThis.__defs;
const SENS = globalThis.__sens, TSENS = globalThis.__tsens;

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

// Words worth matching on. "and", "the" and the like would make every claim true.
const STOP = new Set(["and", "the", "of", "a", "an", "b", "health", "markers", "signals", "cells", "red", "&"]);
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w));

console.log("THE MAP -- real systems, real shapes, real themes");
{
  const keys = Object.keys(MAP);
  ok(keys.length > 0, "MAP-1: the map is not empty  (" + keys.length + " themes)");
  const defKeys = DEFS.map(d => d.key);
  for (const k of keys) ok(defKeys.includes(k), "MAP-2." + k + ": is a real THEME_DEFS key");
  for (const k of keys) {
    const sys = MAP[k];
    ok(Object.prototype.hasOwnProperty.call(TITLES, sys),
       "MAP-3." + k + ": " + sys + " is a real system id, present in CANONICAL_TITLE");
    ok(Array.isArray(SHAPES[sys]) && SHAPES[sys].length > 0,
       "MAP-4." + k + ": " + sys + " has a PRIO_ART shape to draw");
  }
  ok(SENS.size >= 3, "MAP-5: the extracted safety set is the real one  (" + SENS.size + ")");
  ok(TSENS.size >= 4 && TSENS.has("genetic"),
     "MAP-6: THEME_SENSITIVE was extracted too, carrying genetic  (" + [...TSENS].join(", ") + ")");
  for (const k of keys) {
    ok(!SENS.has(MAP[k]), "MAP-7." + k + ": not in SENSITIVE_SYSTEMS");
    ok(!TSENS.has(MAP[k]), "MAP-8." + k + ": not in THEME_SENSITIVE either");
  }
}

console.log("MEMBERSHIP -- the theme's own words name the system it gets");
{
  for (const d of DEFS) {
    const sys = MAP[d.key];
    if (!sys) { ok(true, "MEMBER-0." + d.key + ": no mapping, so nothing to justify"); continue; }
    const theme = new Set(words(d.label).concat(words(d.desc)));
    const title = words(TITLES[sys]);
    const shared = title.filter(w => theme.has(w));
    ok(shared.length > 0,
       "MEMBER-1." + d.key + ": \"" + TITLES[sys] + "\" shares " + JSON.stringify(shared) +
       " with \"" + d.label + " / " + d.desc + "\"");
  }
  // The control: a deliberately wrong pairing must NOT satisfy the same test, or the rule is vacuous.
  const energy = DEFS.find(d => d.key === "energy");
  const theme = new Set(words(energy.label).concat(words(energy.desc)));
  const wrong = words(TITLES["kidney"]).filter(w => theme.has(w));
  eq(wrong.length, 0, "MEMBER-2: kidney shares no word with the energy theme, so MEMBER-1 is discriminating");
}

console.log("THE RENDERER");
{
  const svg = art("energy");
  ok(svg.indexOf('class="theme-art"') > -1, "ART-1: a mapped theme renders a motif");
  ok(svg.indexOf('viewBox="0 0 124 104"') > -1, "ART-2: at the shared 124 by 104 viewBox");
  ok(svg.indexOf('aria-hidden="true"') > -1, "ART-3: hidden from assistive tech, being decorative");
  eq((svg.match(/<path /g) || []).length, SHAPES[MAP.energy].length, "ART-4: every path of the shape is drawn");
  ok(svg.indexOf("stroke=") === -1, "ART-5: no inline stroke, so it cannot carry a tone colour");
  ok(svg.indexOf("fill=") === -1, "ART-6: and no fill attribute either");
  eq(art("no_such_theme"), "", "ART-7: an unmapped theme renders nothing");
  eq(art(null), "", "ART-8: a missing theme renders nothing");
  eq(art(""), "", "ART-9: an empty theme renders nothing");
  // Same shape as the priority card's, which is the point: one drawing set, two uses.
  const sameShape = art("organ_function").match(/ d="([^"]+)"/g).join("|");
  const fromSet = SHAPES[MAP.organ_function].map(p => ' d="' + p + '"').join("|");
  eq(sameShape, fromSet, "ART-10: the motif draws the SAME paths as the priority card mark");
}

console.log("KNOWN-POSITIVE CONTROLS -- the harness can actually fail");
{
  let threw = false;
  try { extract("thisFunctionDoesNotExist"); } catch (_) { threw = true; }
  ok(threw, "CTRL-1: extract() throws on a missing function, so a silent no-op is impossible");
  let threw2 = false;
  try { extractBlock("NOT_A_REAL_BLOCK"); } catch (_) { threw2 = true; }
  ok(threw2, "CTRL-2: extractBlock() throws too");
  ok(words("Iron & Red Cells").includes("iron"), "CTRL-3: the word splitter finds a real word");
  eq(words("and the of a").length, 0, "CTRL-4: and drops the stop words, so MEMBER-1 cannot pass on 'and'");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
