#!/usr/bin/env node
// BAND_FAMILY_GENERATED_V1 — the dashboard's optimal band family comes from ranges-slim.json,
// generated from the engine's BAND_TIERS[0].labels, and is tested through the RENDER.
//
// EVERY BEHAVIOURAL ASSERTION EXECUTES THE PRIORITY MAPPER. Calling isOptimalBandWord directly
// would pass for a classifier nothing consults: on each of the last two passes a mutant survived
// for exactly that reason -- the predicate was correct and unwired, and the assertions could not
// tell. So the signal here is whether a track appears on a rendered priority card.
//
// THE TWO FIXTURES, and why there are two. contradicts === (optimal !== inGreen), so one fixture
// can only ever pin one half of the classifier:
//   IN-GREEN  fixture: a track appears  <=>  the word IS optimal-family
//   OUT-GREEN fixture: a track appears  <=>  the word is NOT optimal-family
// A word misread in either direction reddens one of the two. A single fixture would let half the
// vocabulary be misclassified in silence.
//
// EXPECTED VALUES COME FROM THE GENERATED ARRAY AT RUNTIME, never from a list in this file, and
// the words come from the LIBRARY'S OWN position_bands vocabulary. A hand-typed list is a second
// definition of the thing this change exists to make singular.
//
//   node scripts/test-band-family.mjs
//     DASH=path/to/dashboard.html  RANGES=path/to/ranges-slim.json  LIBRARY=path/to/library.json
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const FILE = process.env.DASH || "dashboard.html";
const RAW = readFileSync(FILE, "utf8");
const HTML = (RAW.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) || [])
  .map((b) => b.replace(/^<script\b[^>]*>/, "").replace(/<\/script>$/, ""))
  .join("\n");

let pass = 0, fail = 0;
const ok = (label, cond) => {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label); }
};
const eq = (label, got, want) => {
  if (got === want) { pass++; console.log("  ok   " + label + "  (" + JSON.stringify(got) + ")"); }
  else { fail++; console.log("  FAIL " + label + "  got " + JSON.stringify(got) + " want " + JSON.stringify(want)); }
};

console.log("band family, generated and read");

ok("extraction control: JS found, and less than the whole file",
  HTML.length > 10000 && HTML.length < RAW.length);

function stripComments(src) {
  const out = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) { out.push(""); continue; }
    let cut = -1;
    for (let i = 1; i < line.length - 1; i++) {
      if (line[i] !== "/" || line[i + 1] !== "/") continue;
      if (line[i - 1] === ":") continue;
      const before = line.slice(0, i);
      if ((before.match(/"/g) || []).length % 2 === 0 &&
          (before.match(/'/g) || []).length % 2 === 0) { cut = i; break; }
    }
    out.push(cut >= 0 ? line.slice(0, cut) : line);
  }
  return out.join("\n");
}
const CODE = stripComments(HTML);
ok("stripper control: it removes the comment that quotes the OLD regex",
  HTML.includes("|reassuring|") && !CODE.includes("|reassuring|"));
ok("stripper control: it leaves ordinary code intact",
  CODE.includes("function isOptimalBandWord(band){"));
ok("stripper control: line count preserved",
  CODE.split("\n").length === HTML.split("\n").length);

function cutAfter(src, anchor, openChar, closeChar) {
  const start = src.indexOf(anchor);
  if (start < 0) throw new Error("anchor not found: " + anchor);
  let i = start + anchor.length - 1, depth = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i], prev = src[i - 1];
    if (q) { if (c === q && prev !== "\\") q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === openChar) depth++;
    else if (c === closeChar) { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced from anchor: " + anchor);
}
ok("cutter control: stops at the MATCHING close",
  cutAfter("zz f(a,(b),c) tail)", "f(", "(", ")") === "f(a,(b),c)");
ok("cutter control: throws on a missing anchor", (() => {
  try { cutAfter("abc", "nope", "(", ")"); return false; } catch { return true; }
})());

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ===========================================================================
// 1. THE GENERATED ARRAY, and the engine it was generated from.
// ===========================================================================
const RANGES_PATH = process.env.RANGES || "ranges-slim.json";
const RANGES_SLIM = JSON.parse(readFileSync(RANGES_PATH, "utf8"));
const FAM = RANGES_SLIM.band_family_optimal;
ok("ranges-slim.json carries band_family_optimal, and it is a non-empty array",
  Array.isArray(FAM) && FAM.length > 0);
const FAM_SET = new Set((Array.isArray(FAM) ? FAM : []).map((w) => String(w).trim().toLowerCase()));
eq("the generated family has exactly six words", FAM_SET.size, 6);
ok("generator provenance is recorded in the file",
  RANGES_SLIM.generated_by === "scripts/build-ranges-slim.py");

// The engine is the authority. Read tier 0 out of it independently and require agreement. This is
// the whole point of generating the array, so it is asserted rather than assumed -- and it is
// asserted against the ENGINE, not against six words typed here.
const ENGINE_CANDIDATES = [
  process.env.ENGINE,
  "../biowellth-backend-supa/supabase/functions/process-report-worker/vitality-engine.js",
  join(homedir(), "Desktop/biowellth-backend-supa/supabase/functions/process-report-worker/vitality-engine.js"),
].filter(Boolean);
const ENGINE = ENGINE_CANDIDATES.find((p) => existsSync(p));
ok("engine source located (tried: " + ENGINE_CANDIDATES.length + " paths)", !!ENGINE);
if (ENGINE) {
  const SRC = readFileSync(ENGINE, "utf8");
  const tiersSrc = SRC.match(/const BAND_TIERS = \[[\s\S]*?\n\];/)[0];
  const BAND_TIERS = new Function("return " + tiersSrc.replace("const BAND_TIERS =", "").replace(/;\s*$/, "") + ";")();
  eq("engine control: BAND_TIERS has six tiers", BAND_TIERS.length, 6);
  eq("the generated array IS the engine's tier 0, order included",
    JSON.stringify(FAM), JSON.stringify(BAND_TIERS[0].labels));
  ok("engine control: tier 1 is NOT the generated array, so the comparison discriminates",
    JSON.stringify(FAM) !== JSON.stringify(BAND_TIERS[1].labels));
}

// ===========================================================================
// 2. THE LIBRARY'S BAND VOCABULARY. Not a list in this file.
// ===========================================================================
const LIB_CANDIDATES = [
  process.env.LIBRARY,
  "../biowellth-backend-supa/supabase/functions/process-report-worker/biomarker-library-v2.1.1.json",
  join(homedir(), "Desktop/biowellth-backend-supa/supabase/functions/process-report-worker/biomarker-library-v2.1.1.json"),
].filter(Boolean);
const LIBP = LIB_CANDIDATES.find((p) => existsSync(p));
// A MISSING LIBRARY IS A FAILURE, NOT A SKIP. The per-word assertions are the substance of this
// file; running zero of them and printing green is the "passes by absence" shape these suites are
// written against.
ok("library located, so the per-word assertions are not vacuous (tried: " +
   LIB_CANDIDATES.length + " paths)", !!LIBP);
const VOCAB = LIBP ? (() => {
  const LIB = JSON.parse(readFileSync(LIBP, "utf8"));
  const s = new Set();
  for (const m of LIB.markers || []) if (Array.isArray(m.position_bands))
    for (const b of m.position_bands) if (b && b.band) s.add(b.band);
  return [...s].sort();
})() : [];
eq("vocabulary control: the library yields 39 distinct band words", VOCAB.length, 39);
ok("vocabulary control: it contains a word that IS family and one that is NOT",
  VOCAB.includes("optimal") && VOCAB.includes("suboptimal_high"));

// ===========================================================================
// 3. THE PRIORITY MAPPER, compiled real, with the REAL classifier.
// ===========================================================================
// SYNTHETIC RANGE, invented. F = functional [10,20], C = conventional [5,30].
//   span 25, pad 6.25, axis [-1.25, 36.25], width 37.5, zone 30.0 .. 56.7
const REF = { low: 10, high: 20, conv_low: 5, conv_high: 30 };
const V_IN = 15;    // dot 43.3 -> inside the zone
const V_OUT = 25;   // dot 70.0 -> outside the zone

const markerBandGeometry = new Function(
  "return " + cutAfter(CODE, "function markerBandGeometry(ref, value){", "{", "}") + ";")();
const markerBandHTML = new Function("esc", "markerBandGeometry",
  "return " + cutAfter(CODE, "function markerBandHTML(ref, value){", "{", "}") + ";")(esc, markerBandGeometry);
const isOptimalBandWordSrc = cutAfter(CODE, "function isOptimalBandWord(band){", "{", "}");
const bandContradictsEngineSrc = cutAfter(CODE, "function bandContradictsEngine(ref, value, band){", "{", "}");
const prioSrc = cutAfter(CODE, '$("prios").innerHTML = pr.map((x,i)=>{', "{", "}");
const prioArrow = prioSrc.slice(prioSrc.indexOf("(x,i)=>"));
const PRIO_TOGGLE_LABEL = new Function("return " +
  cutAfter(CODE, "const PRIO_TOGGLE_LABEL = {", "{", "}").replace(/^const PRIO_TOGGLE_LABEL = /, "") + ";")();

const markerName = (m) => (m && (m.display_name || m.marker_id)) || "";
const sysStatus = () => ({ cls: "s-good", label: "Looks good" });
const toneFor = () => "t-coral";
const SENSITIVE_SYSTEMS = new Set(["heavy_metals", "autoimmune", "tumor_markers"]);
const healthyRangeText = () => "";
const lookupRange = () => REF;

// renderWith(lookupObj, band, value) -> does a track appear on the rendered card?
// lookupObj is whatever RANGES_LOOKUP is for this render, so the degraded shapes below are
// exercised through the SAME path a browser takes.
function renderWith(lookupObj, band, value) {
  const isOptimalBandWord = new Function("RANGES_LOOKUP", "return " + isOptimalBandWordSrc + ";")(lookupObj);
  const bandContradictsEngine = new Function("markerBandGeometry", "isOptimalBandWord",
    "return " + bandContradictsEngineSrc + ";")(markerBandGeometry, isOptimalBandWord);
  const chipSysByMarker = { fixture_marker: "metabolic" };
  const chipValByMarker = { fixture_marker: value };
  const prioFn = new Function(
    "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
    "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
    "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL",
    "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    chipSysByMarker, chipValByMarker, lookupRange, healthyRangeText,
    markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL);
  const card = prioFn({
    rank: 1, headline: "H", system_id: "metabolic",
    primary_markers: [{ marker_id: "fixture_marker", display_name: "Fixture Marker", band: band }],
    why_this_matters: "W",
  }, 0);
  return { card, track: /class="mk-band"/.test(card) };
}
const trackIn = (band) => renderWith(RANGES_SLIM, band, V_IN).track;
const trackOut = (band) => renderWith(RANGES_SLIM, band, V_OUT).track;

ok("render control: the mapper produced a priority card at all",
  /class="prio /.test(renderWith(RANGES_SLIM, "optimal", V_IN).card));
ok("FIXTURE control: the IN-GREEN value really is in the zone -- a family word draws a track",
  trackIn("optimal") === true);
ok("FIXTURE control: the IN-GREEN value really is in the zone -- a non-family word suppresses",
  trackIn("zzz_not_a_band") === false);
ok("FIXTURE control: the OUT-GREEN value really is outside -- a family word suppresses",
  trackOut("optimal") === false);
ok("FIXTURE control: the OUT-GREEN value really is outside -- a non-family word draws",
  trackOut("zzz_not_a_band") === true);

// ===========================================================================
// 4. ONE ASSERTION PER LIBRARY WORD, IN BOTH DIRECTIONS, THROUGH THE RENDER.
// ===========================================================================
for (const w of VOCAB) {
  const expected = FAM_SET.has(String(w).trim().toLowerCase());
  eq("IN-GREEN, band " + w + ": track drawn === word is optimal-family", trackIn(w), expected);
  eq("OUT-GREEN, band " + w + ": track drawn === word is NOT optimal-family", trackOut(w), !expected);
}

// Absent-ish bands. None is in the family, so IN-GREEN suppresses and OUT-GREEN draws.
for (const [label, w] of [["null", null], ["undefined", undefined], ["empty string", ""],
                          ["whitespace only", "   "]]) {
  eq("IN-GREEN, band " + label + ": suppressed", trackIn(w), false);
  eq("OUT-GREEN, band " + label + ": drawn", trackOut(w), true);
}

// ===========================================================================
// 5. WHOLE-WORD, TRIMMED, LOWERCASED. No substring, no prefix, no anchors.
// ===========================================================================
eq("trimmed: '  optimal  ' is family", trackIn("  optimal  "), true);
eq("lowercased: 'OPTIMAL' is family", trackIn("OPTIMAL"), true);
eq("both: '  Absent_Or_Few ' is family", trackIn("  Absent_Or_Few "), true);
eq("SUBSTRING: 'suboptimal_high' is NOT family", trackIn("suboptimal_high"), false);
eq("SUBSTRING: 'suboptimal_low' is NOT family", trackIn("suboptimal_low"), false);
eq("SUBSTRING: 'abnormal' is NOT family", trackIn("abnormal"), false);
eq("SUBSTRING: 'negative_or_trace' is NOT family", trackIn("negative_or_trace"), false);
eq("PREFIX: 'absent_or_many' (a word starting with a family word) is NOT family",
  trackIn("absent_or_many"), false);
eq("SUFFIX: 'very_normal' is NOT family", trackIn("very_normal"), false);
// absent_or_few is the word the hand-written five-word set omitted. It is family.
eq("the word the hand-written set omitted, absent_or_few, IS family",
  trackIn("absent_or_few"), true);
ok("and it is in the generated array", FAM_SET.has("absent_or_few"));

// ===========================================================================
// 6. IT FAILS CLOSED. Three degraded shapes, each asserted explicitly.
// ===========================================================================
// The signal: with the IN-GREEN fixture and a genuine family word, a healthy array draws a track.
// Under every degraded shape the word must classify false, so the track must be SUPPRESSED.
const healthy = { ...RANGES_SLIM };
ok("fail-closed control: with a healthy array the family word DRAWS, so a suppression below is the guard",
  renderWith(healthy, "optimal", V_IN).track === true);

const missing = { ...RANGES_SLIM }; delete missing.band_family_optimal;
eq("MISSING array: family word suppressed", renderWith(missing, "optimal", V_IN).track, false);
eq("MISSING array: absent_or_few suppressed", renderWith(missing, "absent_or_few", V_IN).track, false);
eq("MISSING array: every one of the six words suppressed",
  [...FAM_SET].filter((w) => renderWith(missing, w, V_IN).track).length, 0);

const empty = { ...RANGES_SLIM, band_family_optimal: [] };
eq("EMPTY array: family word suppressed", renderWith(empty, "optimal", V_IN).track, false);
eq("EMPTY array: every one of the six words suppressed",
  [...FAM_SET].filter((w) => renderWith(empty, w, V_IN).track).length, 0);

for (const [label, bad] of [["a string", "optimal"], ["an object", { optimal: true }],
                            ["a number", 6], ["null", null], ["true", true]]) {
  eq("NOT AN ARRAY (" + label + "): family word suppressed",
    renderWith({ ...RANGES_SLIM, band_family_optimal: bad }, "optimal", V_IN).track, false);
}
eq("RANGES_LOOKUP itself null: family word suppressed", renderWith(null, "optimal", V_IN).track, false);

// ===========================================================================
// 7. THE OLD PATTERN IS GONE FROM THE CODE.
// ===========================================================================
eq("no BAND_OPTIMAL_FAMILY identifier survives in the code",
  (CODE.match(/BAND_OPTIMAL_FAMILY/g) || []).length, 0);
eq("no five-alternative regex survives in the code",
  (CODE.match(/optimal\|reassuring/g) || []).length, 0);
ok("presence control: the same matcher finds it in the RAW file, where the comment records it",
  /optimal\|reassuring/.test(RAW));
eq("the classifier has exactly one caller, the consistency rule",
  (CODE.match(/isOptimalBandWord\(/g) || []).length, 2);   // the definition + the one call

// ===========================================================================
// 8. THE CACHE BUST MOVED WITH THE FILE.
// ===========================================================================
// A regenerated ranges-slim.json behind an unchanged RANGES_BUILD is fetched with force-cache and
// never refetched, so the page would read the array it already has -- which is the degraded case
// above. The two move together or the guard is doing the work forever.
const rb = CODE.match(/const RANGES_BUILD = "([^"]+)"/);
ok("RANGES_BUILD is present", !!rb);
ok("RANGES_BUILD is no longer the pre-conventional-bounds value 20260824a",
  !!rb && rb[1] !== "20260824a");

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
