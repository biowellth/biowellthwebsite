#!/usr/bin/env node
// Part two: the marker position band (MARKER_BAND_V1), the reveal centring
// (REVEAL_CENTRING_V1) and the Ask Sana top bar entry (ASK_SANA_NAV_V1).
//
// EXECUTES THE SHIPPED CODE. Every behavioural assertion compiles the real
// function out of dashboard.html and calls it. Asserting that a string appears
// in the file would pass for a band nobody renders and for a handler nobody
// attaches, which is the whole failure this file is written against.
//
// The CSS assertions are the exception and they are honest about it: a
// stylesheet rule has no function to call, so they match the rule text with a
// control proving the same matcher finds a rule that is genuinely there.
//
//   node scripts/test-band-nav-centring.mjs      (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

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

console.log("band, nav and centring");

ok("extraction control: JS found, and less than the whole file",
  HTML.length > 10000 && HTML.length < RAW.length);

// ---------------------------------------------------------------------------
// THE STRIPPER, WITH ITS OWN CONTROLS. Comments come out before any brace
// counting, because an apostrophe inside a comment ("the marker's system")
// opens a quote the counter never closes and it then walks off the end of the
// file reporting "unbalanced". That happened on the first run of the sibling
// suite and is the reason this runs first here.
// ---------------------------------------------------------------------------
function stripComments(src) {
  const out = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) { out.push(""); continue; }
    let cut = -1;
    for (let i = 1; i < line.length - 1; i++) {
      if (line[i] !== "/" || line[i + 1] !== "/") continue;
      if (line[i - 1] === ":") continue;                        // https://
      const before = line.slice(0, i);
      if ((before.match(/"/g) || []).length % 2 === 0 &&
          (before.match(/'/g) || []).length % 2 === 0) { cut = i; break; }
    }
    out.push(cut >= 0 ? line.slice(0, cut) : line);
  }
  return out.join("\n");
}
const CODE = stripComments(HTML);
ok("stripper control A: it removes a real comment line",
  HTML.includes("// ASK_SANA_NAV_V1") && !CODE.includes("// ASK_SANA_NAV_V1"));
ok("stripper control B: it leaves ordinary code intact",
  CODE.includes("function markerBandHTML(ref, value){"));
ok("stripper control C: an apostrophe-bearing comment really is present",
  /\/\/.*\b\w+'s\b/.test(HTML));
ok("stripper control D: no apostrophe-bearing comment survives into CODE",
  !/\/\/.*\b\w+'s\b/.test(CODE));
ok("stripper control E: line count preserved, so nothing is silently merged",
  CODE.split("\n").length === HTML.split("\n").length);

// ---------------------------------------------------------------------------
// THE CUTTER. Anchors END with the opening character, because an anchor ending
// in ">" (as in "q.map(x=>") leaves the scanner sitting on ">" and it never
// opens, which surfaces as a SyntaxError from new Function rather than a pass.
// ---------------------------------------------------------------------------
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
ok("cutter control: stops at the MATCHING close, not the first or the last",
  cutAfter("zz f(a,(b),c) tail)", "f(", "(", ")") === "f(a,(b),c)");
ok("cutter control: throws when the braces never balance", (() => {
  try { cutAfter("f(a,(b)", "f(", "(", ")"); return false; } catch { return true; }
})());
ok("cutter control: throws on a missing anchor", (() => {
  try { cutAfter("abc", "nope", "(", ")"); return false; } catch { return true; }
})());
ok("cutter control: an anchor ending in '>' would NOT open the counter", (() => {
  try { cutAfter("q.map(x=> 1 )", "q.map(x=>", "(", ")"); return false; } catch { return true; }
})());

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ===========================================================================
// 1. THE BAND, executed.
// ===========================================================================
const bandSrc = cutAfter(CODE, "function markerBandHTML(ref, value){", "{", "}");
const markerBandHTML = new Function("esc", "return " + bandSrc + ";")(esc);
const BAND_OPTIMAL_FAMILY = new RegExp(CODE.match(/const BAND_OPTIMAL_FAMILY = \/([^/]+)\//)[1]);
const bandContradictsEngine = new Function("esc", "markerBandHTML", "BAND_OPTIMAL_FAMILY",
  "return " + cutAfter(CODE, "function bandContradictsEngine(ref, value, band){", "{", "}") + ";"
)(esc, markerBandHTML, BAND_OPTIMAL_FAMILY);
ok("band extraction control: it compiled to a function",
  typeof markerBandHTML === "function");

// MARKER_BAND_V2. F = functional [10,20], C = conventional [5,30].
//   span 25, pad 6.25, axis [-1.25, 36.25], width 37.5
//   pos(10)=30.0  pos(20)=56.7  pos(15)=43.3
// Every expected number below is derived from the ruled formula by hand, not read back out of the
// implementation, so a wrong implementation cannot make them agree with itself.
const F = { low: 10, high: 20, conv_low: 5, conv_high: 30 };
const two = markerBandHTML(F, 15);
ok("band renders with two functional bounds, two conventional bounds and a numeric value",
  two.includes('class="mk-band"'));
ok("it draws a track", two.includes('class="mk-band-track"'));
ok("it draws a dot", two.includes('class="mk-band-dot"'));
ok("it draws exactly ONE zone", (two.match(/class="mk-band-zone"/g) || []).length === 1);
ok("the zone starts at pos(f_low) = 30.0%", two.includes('class="mk-band-zone" style="left:30.0%'));
ok("the zone is pos(f_high) - pos(f_low) = 26.7% wide", two.includes('width:26.7%'));
ok("the dot sits at pos(value) = 43.3%", two.includes('class="mk-band-dot" style="left:43.3%"'));
ok("her value is labelled, above the dot and at the same offset",
  two.includes('class="mk-band-val" style="left:43.3%">15<'));
ok("the zone's two numbers are pinned to its edges",
  two.includes('class="mk-band-end" style="left:30.0%">10<') &&
  two.includes('class="mk-band-end" style="left:56.7%">20<'));

// THE AXIS IS NOT DERIVED FROM HER VALUE. This is the defect the rewrite exists to fix, so it is
// asserted directly: move the value far outside the range and the ZONE must not move at all.
const far = markerBandHTML(F, -9999);
ok("AXIS INDEPENDENCE: a wildly different value leaves the zone exactly where it was",
  far.includes('class="mk-band-zone" style="left:30.0%') && far.includes('width:26.7%'));
ok("axis-independence control: the DOT did move", !far.includes('mk-band-dot" style="left:43.3%"'));

// Two different below-range values must NOT collapse onto one position. Under V1 both were 4%.
const a1 = markerBandHTML(F, 8), a2 = markerBandHTML(F, 6);
const dotOf = (h) => (h.match(/mk-band-dot" style="left:([0-9.]+)%/) || [])[1];
ok("two different below-range values take DIFFERENT positions", dotOf(a1) !== dotOf(a2));
ok("separation control: the same value twice takes the SAME position",
  dotOf(markerBandHTML(F, 8)) === dotOf(a1));

// CLAMP: dot only, to [2,98]. The zone edges are never clamped.
ok("a value far below clamps the DOT to 2%", dotOf(markerBandHTML(F, -1e6)) === "2.0");
ok("a value far above clamps the DOT to 98%", dotOf(markerBandHTML(F, 1e6)) === "98.0");
ok("clamp control: an in-axis value is NOT clamped", dotOf(two) === "43.3");
ok("the ZONE is never clamped, even when the dot is",
  markerBandHTML(F, -1e6).includes('class="mk-band-zone" style="left:30.0%'));
// M10 GAP, closed. The fixture above has its zone at 30.0..56.7, which [2,98] would not move, so
// clamping the edges too was invisible. This one puts the zone at 0.2..99.8, outside the clamp on
// BOTH sides: a wide functional range against a narrow conventional one.
//   W: f [0,1000], conv [400,410]. span 10, pad 2.5, axis [-2.5, 1002.5], width 1005.
//   pos(0) = 2.5/1005 = 0.2   pos(1000) = 1002.5/1005 = 99.8
{
  const W = { low: 0, high: 1000, conv_low: 400, conv_high: 410 };
  const wide = markerBandHTML(W, 405);
  ok("zone-clamp control: this fixture really does draw", wide !== "");
  ok("a zone edge BELOW 2% is left where it is, not clamped up",
    wide.includes('class="mk-band-zone" style="left:0.2%'));
  // 99.5, not 99.6. The width is (g1 - g0) rounded ONCE, not the difference of the two rounded
  // ends: 99.751 - 0.249 = 99.502 -> 99.5. Subtracting the displayed ends would have given 99.6
  // and been wrong by a rounding step.
  ok("a zone edge ABOVE 98% is left where it is, not clamped down",
    wide.includes('width:99.5%'));
  ok("the zone's own numbers are pinned outside the clamp range too",
    wide.includes('class="mk-band-end" style="left:0.2%') &&
    wide.includes('class="mk-band-end" style="left:99.8%'));
}

// FALLBACK, the four ruled conditions and nothing else.
eq("no band without conventional bounds", markerBandHTML({ low: 10, high: 20 }, 15), "");
// M3 GAP, closed, and the guards turned out to overlap in a way worth recording.
//   - an ABSENT conv bound is caught by the null guard, not by the isFinite guard
//   - a NON-NUMERIC conv bound ("n/a") makes span NaN, and !(NaN > 0) means the SPAN guard
//     catches it first
//   - so the isFinite guard's UNIQUE responsibility is a bound that is a number but INFINITE,
//     where span is +Infinity and sails through the span guard
// All three are asserted, and the infinite case is the one that actually isolates guard 1.
eq("no band when conv_low is absent (null guard owns this)",
  markerBandHTML({ low: 10, high: 20, conv_high: 30 }, 15), "");
eq("no band when conv_low is present but not a number (span guard owns this)",
  markerBandHTML({ low: 10, high: 20, conv_low: "n/a", conv_high: 30 }, 15), "");
eq("no band when conv_low is -Infinity (the isFinite guard owns this ALONE)",
  markerBandHTML({ low: 10, high: 20, conv_low: -Infinity, conv_high: 30 }, 15), "");
eq("no band when conv_high is +Infinity (likewise)",
  markerBandHTML({ low: 10, high: 20, conv_low: 5, conv_high: Infinity }, 15), "");
ok("guard control: the same fixture with finite numeric conv bounds DOES draw",
  markerBandHTML({ low: 10, high: 20, conv_low: 5, conv_high: 30 }, 15) !== "");
eq("no band with only conv_low", markerBandHTML({ low: 10, high: 20, conv_low: 5 }, 15), "");
eq("no band with only conv_high", markerBandHTML({ low: 10, high: 20, conv_high: 30 }, 15), "");
eq("no band when the functional range is LOW-ONLY",
  markerBandHTML({ low: 10, high: null, conv_low: 5, conv_high: 30 }, 15), "");
eq("no band when the functional range is HIGH-ONLY",
  markerBandHTML({ low: null, high: 20, conv_low: 5, conv_high: 30 }, 15), "");
eq("no band with no functional bounds at all",
  markerBandHTML({ low: null, high: null, conv_low: 5, conv_high: 30 }, 15), "");
eq("no band with a null ref", markerBandHTML(null, 15), "");
eq("no band with a non-numeric value", markerBandHTML(F, "positive"), "");
eq("no band with an absent value", markerBandHTML(F, undefined), "");
eq("no band when conv span is zero",
  markerBandHTML({ low: 10, high: 20, conv_low: 30, conv_high: 30 }, 15), "");
eq("no band when conv span is inverted",
  markerBandHTML({ low: 10, high: 20, conv_low: 30, conv_high: 5 }, 15), "");
eq("no band when the functional bounds are inverted",
  markerBandHTML({ low: 20, high: 10, conv_low: 5, conv_high: 30 }, 15), "");
// containment: conv sits strictly inside f on BOTH sides and the pad is too small to escape it
// The containment guard is a BACKSTOP that cannot fire while conditions 1-3 hold: pad > 0 puts
// axis_lo strictly below f_low and axis_hi strictly above f_high by construction. So it is
// asserted as a PROPERTY over the whole shipped library rather than with a fixture that cannot
// exist, and the guard's presence in the source is pinned separately.
ok("containment holds for EVERY shipped entry that passes conditions 1-3", (() => {
  const rs = JSON.parse(readFileSync("ranges-slim.json", "utf8")).by_marker_id;
  let checked = 0;
  for (const v of Object.values(rs)) {
    if (v.low == null || v.high == null || v.conv_low == null || v.conv_high == null) continue;
    const span = v.conv_high - v.conv_low; if (!(span > 0)) continue;
    const pad = 0.25 * span;
    const lo = Math.min(v.conv_low, v.low) - pad, hi = Math.max(v.conv_high, v.high) + pad;
    if (!(lo < v.low && hi > v.high)) return false;
    checked++;
  }
  return checked > 100;
})());
ok("the containment guard is present in the shipped source",
  /axis_lo < f_low && axis_hi > f_high/.test(CODE));

// NO VERDICT, one word at a time, on the RENDERED markup rather than the source.
const VERDICT = ["high", "low", "normal", "optimal", "good", "bad", "flag", "watch",
  "elevated", "deficient", "critical", "healthy", "abnormal", "concern", "risk", "poor",
  "amber", "coral", "green", "range"];
const bandText = two.toLowerCase();
for (const w of VERDICT) {
  ok("no verdict word in the rendered band: " + w, !bandText.includes(w));
}
ok("verdict-scan control: the scanner DOES fire on a planted word",
  (bandText + " optimal").includes("optimal"));
ok("no status class hook that a future change could colour",
  !/s-good|s-watch|s-flag|s-ref/.test(bandText));
ok("the band is marked decorative for assistive tech",
  two.includes('aria-hidden="true"'));

// THE CONSISTENCY RULE, executed.
ok("an optimal band with the dot INSIDE green does not contradict",
  bandContradictsEngine(F, 15, "optimal") === false);
ok("an optimal band with the dot OUTSIDE green CONTRADICTS",
  bandContradictsEngine(F, 8, "optimal") === true);
ok("a non-optimal band with the dot OUTSIDE green does not contradict",
  bandContradictsEngine(F, 8, "low") === false);
ok("a non-optimal band with the dot INSIDE green CONTRADICTS",
  bandContradictsEngine(F, 15, "low") === true);
ok("the optimal FAMILY is the engine's, not a narrower guess",
  bandContradictsEngine(F, 15, "normal") === false &&
  bandContradictsEngine(F, 15, "reassuring") === false &&
  bandContradictsEngine(F, 15, "negative") === false);
ok("consistency control: nothing drawn means nothing to contradict",
  bandContradictsEngine({ low: 10, high: 20 }, 15, "low") === false);

// ===========================================================================
// 2. THE BAND ON THE PRIORITY PATH, executed, including the sensitive guard.
// ===========================================================================
const prioSrc = cutAfter(CODE, '$("prios").innerHTML = pr.map((x,i)=>{', "{", "}");
const prioArrow = prioSrc.slice(prioSrc.indexOf("(x,i)=>"));
const SENSITIVE_SYSTEMS = new Set(["heavy_metals", "autoimmune", "tumor_markers"]);
const markerName = (m) => (m && (m.display_name || m.marker_id)) || "";
const sysStatus = () => ({ cls: "s-good", label: "Looks good" });
const toneFor = () => "t-coral";
const healthyRangeText = (ref) => (ref && ref.low != null && ref.high != null)
  ? ("Healthy " + ref.low + " to " + ref.high) : "";
const PRIO_TOGGLE_LABEL = { closed: "See more details", open: "Hide details" };

function renderPriority({ sysId, ref, value, band }) {
  const chipSysByMarker = { m1: sysId };
  const chipValByMarker = value === undefined ? {} : { m1: value };
  const lookupRange = () => ref;
  const fn = new Function(
    "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
    "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
    "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL", "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    chipSysByMarker, chipValByMarker, lookupRange, healthyRangeText,
    markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL);
  return fn({
    rank: 1, headline: "SENTINEL_HEADLINE",
    primary_markers: [{ marker_id: "m1", display_name: "Sentinel Marker",
                       band: band === undefined ? "low" : band }],
    why_this_matters: "SENTINEL_WHY",
  }, 0);
}

const okCard = renderPriority({ sysId: "metabolic", ref: F, value: 15, band: "optimal" });
// M5 GAP, closed. Every assertion above calls the predicate directly, so deleting the CALL SITE
// on the priority path left them all green. These execute the render instead.
ok("RENDER PATH: a contradicting marker draws NO band",
  !renderPriority({ sysId: "metabolic", ref: F, value: 15, band: "low" }).includes('class="mk-band"'));
ok("RENDER PATH control: the same marker with an agreeing band DOES draw",
  renderPriority({ sysId: "metabolic", ref: F, value: 15, band: "optimal" }).includes('class="mk-band"'));
ok("RENDER PATH: the other direction suppresses too",
  !renderPriority({ sysId: "metabolic", ref: F, value: 8, band: "optimal" }).includes('class="mk-band"'));
ok("RENDER PATH control: and its agreeing counterpart draws",
  renderPriority({ sysId: "metabolic", ref: F, value: 8, band: "low" }).includes('class="mk-band"'));
ok("a suppressed band still leaves her value in text",
  renderPriority({ sysId: "metabolic", ref: F, value: 15, band: "low" }).includes('prio-mk-range'));
ok("priority render control: it produced a .prio card", /class="prio /.test(okCard));
ok("a non-sensitive marker with two bounds and a value DRAWS the band",
  okCard.includes('class="mk-band"'));
ok("and the range sentence is still there beside it",
  okCard.includes("prio-mk-range"));

for (const sid of ["heavy_metals", "autoimmune", "tumor_markers"]) {
  const c = renderPriority({ sysId: sid, ref: F, value: 15, band: "optimal" });
  ok("SENSITIVE: " + sid + " draws NO band", !c.includes('class="mk-band"'));
  ok("SENSITIVE: " + sid + " draws no range sentence either", !c.includes("prio-mk-range"));
}
ok("sensitive control: an UNMAPPED system also draws no band",
  !renderPriority({ sysId: undefined, ref: F, value: 15, band: "optimal" }).includes('class="mk-band"'));
ok("sensitive control: the SAME fixture on a mapped system DOES draw one",
  okCard.includes('class="mk-band"'));

ok("one bound on the priority path draws no band",
  !renderPriority({ sysId: "metabolic", ref: { low: 10, high: null, conv_low: 5, conv_high: 30 }, value: 15, band: "low" }).includes('class="mk-band"'));
ok("no value on the priority path draws no band",
  !renderPriority({ sysId: "metabolic", ref: F, value: undefined, band: "low" }).includes('class="mk-band"'));

// The value must come from the systems map, never from the primary_marker,
// which measurably does not carry one.
// PINNED BY BEHAVIOUR, NOT BY A SOURCE STRING. The previous form asserted the literal
// "markerBandHTML(ref, chipValByMarker[pm.marker_id])", which went red the moment the call was
// refactored to hoist the value into a local -- a rename, not a regression. What matters is where
// the value COMES FROM, so that is what is executed: the map supplies it and pm does not.
ok("WIRING: the value comes from the systems map, and pm carries none",
  renderPriority({ sysId: "metabolic", ref: F, value: 15, band: "optimal" }).includes('class="mk-band"'));
ok("WIRING: with the map empty, no band draws even if a value is set on pm", (() => {
  const chipSysByMarker = { m1: "metabolic" };
  const chipValByMarker = {};                       // the systems join finds nothing
  const fn = new Function(
    "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
    "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
    "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL", "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    chipSysByMarker, chipValByMarker, () => F, healthyRangeText,
    markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL);
  const html = fn({ rank: 1, headline: "H",
    primary_markers: [{ marker_id: "m1", display_name: "M", band: "optimal", value: 15 }] }, 0);
  return !html.includes('class="mk-band"');
})());
ok("value-source control: chipValByMarker is built from p.systems markers",
  /chipValByMarker\[m\.marker_id\] = m\.value/.test(CODE));

// ===========================================================================
// 2b. THE DEFECT'S ACTUAL SHAPE: DIFFERENT VALUES COLLAPSING ONTO ONE POSITION.
//
//     A first version of this section swept every library marker at a value defined as a fixed
//     fraction of that marker's OWN conventional span, and asserted the positions were mostly
//     distinct. It failed, and the assertion was wrong rather than the code: the axis is
//     deliberately scale-invariant, so a value at the same relative offset SHOULD land at the
//     same percentage for every marker. Measured: valued at conv_low, 123 of 124 markers land on
//     16.7% -- and that is the formula working, not failing.
//
//     What the shipped defect actually was is different values on the SAME marker all landing on
//     one floor. That is what is asserted here, with the old arithmetic as the known-positive.
// ===========================================================================
{
  const G = { low: 10, high: 20, conv_low: 5, conv_high: 30 };
  const belowRange = [9, 7, 5, 3, 1, -4, -12, -30];
  const dotAt = (v) => {
    const h = markerBandHTML(G, v);
    return h ? (h.match(/mk-band-dot" style="left:([0-9.]+)%/) || [])[1] : null;
  };
  const v2 = new Set(belowRange.map(dotAt));
  ok("sweep control: every one of those values drew a band", belowRange.every(v => dotAt(v) !== null));
  ok("EIGHT different below-range values take more than one position", v2.size > 1);
  // SIX, not eight, and the arithmetic is written out so the constant is checkable rather than
  // observed. G: span 25, pad 6.25, axis [-1.25, 36.25], width 37.5.
  //   9 -> 27.3   7 -> 22.0   5 -> 16.7   3 -> 11.3   1 -> 6.0
  //  -4 -> -7.3   -12 -> -28.7   -30 -> -76.7   all three clamp to 2.0
  // So five unclamped positions plus the shared floor = 6. The floor is doing exactly what a
  // clamp should: it catches only what is genuinely off the track, instead of catching everything
  // below range the way V1's did.
  eq("and specifically, they take this many distinct positions", v2.size, 6);
  eq("exactly three of the eight are far enough out to clamp to the floor",
    belowRange.filter(v => dotAt(v) === "2.0").length, 3);

  // THE KNOWN-POSITIVE. The shipped V1 arithmetic on the identical inputs, so the assertion above
  // is proven able to fail rather than merely observed passing.
  const v1 = new Set(belowRange.map(v =>
    Math.min(96, Math.max(4, (v - G.low) / (G.high - G.low) * 100)).toFixed(1)));
  eq("known-positive: the OLD arithmetic puts all eight on ONE position", v1.size, 1);
  ok("and that position is the 4% floor the defect reported", v1.has("4.0"));

  // Markers with different geometry and the SAME absolute value must also differ.
  const H = { low: 10, high: 20, conv_low: 8, conv_high: 24 };
  ok("two markers with different conventional geometry place the same value differently",
    markerBandHTML(G, 12).match(/mk-band-dot" style="left:([0-9.]+)%/)[1] !==
    markerBandHTML(H, 12).match(/mk-band-dot" style="left:([0-9.]+)%/)[1]);
  ok("geometry control: the SAME geometry places the same value identically",
    markerBandHTML(G, 12).match(/mk-band-dot" style="left:([0-9.]+)%/)[1] ===
    markerBandHTML({ ...G }, 12).match(/mk-band-dot" style="left:([0-9.]+)%/)[1]);
}

// ===========================================================================
// 3. THE REVEAL CENTRING. CSS, so matched as text, with controls.
// ===========================================================================
ok("the reveal card still centres with the safe keyword",
  /#view-reveal \.card\{[^}]*justify-content:safe center/.test(RAW));
eq("NO height-keyed media query survives anywhere in the file",
  (RAW.match(/@media\(max-height/g) || []).length, 0);
ok("flex-start is not forced on the reveal card at any height",
  !/#view-reveal \.card\{justify-content:flex-start\}/.test(RAW));
ok("centring-matcher control: the same matcher finds a rule that IS there",
  /#view-reveal \.card\{[^}]*overflow-y:auto/.test(RAW));
ok("media-query control: the file DOES still carry other @media rules",
  (RAW.match(/@media/g) || []).length > 5);
ok("the card still scrolls, which is what makes safe centring sufficient",
  /#view-reveal \.card\{[^}]*overflow-y:auto/.test(RAW));
ok("no wrapper was introduced: .stag still keys on direct children",
  /#view-reveal \.card\.active \.stag:nth-child\(1\)/.test(RAW));

// ===========================================================================
// 4. ASK SANA, executed.
// ===========================================================================
ok("the control ships HIDDEN in markup",
  /<button class="btn-ghost hidden" id="btn-sana" type="button"><\/button>/.test(RAW));
ok("and EMPTY in markup, so the label can only come from the render step",
  !/id="btn-sana"[^>]*>[^<]/.test(RAW));
ok("markup control: a sibling control that is NOT empty exists",
  /id="btn-account"[^>]*>Account</.test(RAW));

const shippedLabel = (() => {
  const m = HTML.match(/navLabel:\s*"([^"]*)"/);
  return m ? m[1] : null;
})();
eq("the shipped nav label is the ratified Title Case string", shippedLabel, "Ask Sana");

const entrySrc = cutAfter(CODE, "function renderSanaEntry(){", "{", "}");
const askSrc = cutAfter(CODE, "function askSana(){", "{", "}");

function fakeBtn() {
  const cls = new Set(["btn-ghost", "hidden"]);
  return { textContent: "", onclick: null,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) } };
}
function runEntry({ enabled, inputPresent }) {
  const nav = fakeBtn();
  let invoked = 0;
  const input = inputPresent ? { focus(){}, } : null;
  const $ = (id) => id === "btn-sana" ? nav : id === "sana-input" ? input : null;
  const askSana = () => { invoked++; return true; };
  new Function("$", "SANA_CHAT_ENABLED", "SANA_COPY", "askSana",
    entrySrc + "; renderSanaEntry();")($, enabled, { navLabel: "Ask Sana" }, askSana);
  return { nav, invoked };
}

const on = runEntry({ enabled: true, inputPresent: true });
ok("with the chat mounted the control is revealed", !on.nav.classList.contains("hidden"));
eq("and labelled from the render step", on.nav.textContent, "Ask Sana");
ok("its handler is attached", typeof on.nav.onclick === "function");
eq("THE HANDLER IS NOT INVOKED AT LOAD", on.invoked, 0);
ok("it is a BARE REFERENCE, not an arrow wrapper",
  /nav\.onclick = askSana;/.test(CODE) && !/nav\.onclick = \(\s*\)\s*=>/.test(CODE));

const offFlag = runEntry({ enabled: false, inputPresent: true });
ok("chat flag off -> stays hidden", offFlag.nav.classList.contains("hidden"));
eq("and unlabelled", offFlag.nav.textContent, "");
const offInput = runEntry({ enabled: true, inputPresent: false });
ok("no chat input -> stays hidden, so it never points at nothing",
  offInput.nav.classList.contains("hidden"));

// askSana targets the dashboard card, not a view switch.
let scrolled = 0, focused = 0;
const mount = { scrollIntoView: () => { scrolled++; } };
const inputNode = { focus: () => { focused++; } };
const askSana = new Function("$", askSrc + "; return askSana;")(
  (id) => id === "sana-input" ? inputNode : id === "sana-mount" ? mount : null);
eq("askSana returns true when the input is there", askSana(), true);
eq("it scrolled the dashboard card into view", scrolled, 1);
eq("it focused the input", focused, 1);
ok("it does NOT switch views", !/showView/.test(askSrc));
ok("view-switch control: showView IS used elsewhere in the file",
  /showView\(/.test(CODE));
eq("askSana returns false and does nothing when there is no input",
  new Function("$", askSrc + "; return askSana;")(() => null)(), false);

// ===========================================================================
// 5. THE TOP BAR WRAP.
// ===========================================================================
ok(".topbar-right wraps at EVERY width, not only below 600px",
  /\.topbar-right\{[^}]*flex-wrap:wrap/.test(RAW));
ok(".topbar-inner wraps too, so a wrapped right side is not clipped",
  /\.topbar-inner\{[^}]*flex-wrap:wrap/.test(RAW));
ok(".topbar-inner is min-height, not a fixed height that would clip row two",
  /\.topbar-inner\{[^}]*min-height:60px/.test(RAW) && !/\.topbar-inner\{[^}]*[^-]height:60px/.test(RAW));
ok("wrap-matcher control: the same matcher finds a rule without flex-wrap",
  /\.brand\{[^}]*display:flex/.test(RAW) && !/\.brand\{[^}]*flex-wrap/.test(RAW));
ok("the 600px query no longer duplicates the wrap declarations",
  !/@media\(max-width:600px\)\{[^}]*\.topbar-right\{[^}]*flex-wrap/.test(RAW));
ok("and it still carries the phone-specific padding",
  /@media\(max-width:600px\)\{\s*\.topbar-inner\{row-gap:6px;padding:9px 0\}/.test(RAW));

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
