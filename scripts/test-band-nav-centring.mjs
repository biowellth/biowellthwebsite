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
// MARKER_BAND_V3 — the renderer and the consistency rule both read ONE geometry, so it is
// compiled and injected rather than stubbed. A stub would let the geometry regress while every
// assertion below stayed green on this file's idea of an axis.
// MARKER_BAND_V3 — the Tier 2 pad constant is READ OUT OF THE PAGE, never restated here. A
// number typed into this file is a second definition and would agree with itself forever.
const BAND_FALLBACK_PAD_K = Number(CODE.match(/const BAND_FALLBACK_PAD_K = ([0-9.]+)/)[1]);
const markerBandGeometry = new Function("BAND_FALLBACK_PAD_K",
  "return " + cutAfter(CODE, "function markerBandGeometry(ref, value){", "{", "}") + ";")(BAND_FALLBACK_PAD_K);
const bandSrc = cutAfter(CODE, "function markerBandHTML(ref, value){", "{", "}");
// The note table and its renderer are compiled TOGETHER, in one scope, so the table the page
// ships is the one the assertions read. Copying the strings into this file would be the second
// definition the ruled copy exists to avoid.
const bandZoneNoteHTML = new Function(
  "return (function(){\n" +
  cutAfter(CODE, "const BAND_ZONE_NOTE = {", "{", "}") + ";\n" +
  cutAfter(CODE, "function bandZoneNoteHTML(g){", "{", "}") + ";\n" +
  "return bandZoneNoteHTML; })();")();
const markerBandHTML = new Function("esc", "markerBandGeometry", "bandZoneNoteHTML",
  "return " + bandSrc + ";")(esc, markerBandGeometry, bandZoneNoteHTML);
// BAND_FAMILY_GENERATED_V1 — the family is no longer a regex in the page, it is the
// band_family_optimal array in ranges-slim.json. The REAL generated file is loaded and the REAL
// classifier is compiled against it; a hand-written six-word list here would be the second
// definition this change exists to delete.
const RANGES_SLIM = JSON.parse(readFileSync(process.env.RANGES || "ranges-slim.json", "utf8"));
const isOptimalBandWord = new Function("RANGES_LOOKUP",
  "return " + cutAfter(CODE, "function isOptimalBandWord(band){", "{", "}") + ";")(RANGES_SLIM);
const bandContradictsEngine = new Function("markerBandGeometry", "isOptimalBandWord",
  "return " + cutAfter(CODE, "function bandContradictsEngine(ref, value, band){", "{", "}") + ";"
)(markerBandGeometry, isOptimalBandWord);
ok("band extraction control: it compiled to a function",
  typeof markerBandHTML === "function");

// MARKER_BAND_V3. F = functional [10,20], conventional [5,30].
//   span 25, pad 6.25, outer [5,30], axis would be [-1.25, 36.25]
//   EVERY BOUND ON FILE IS >= 0 AND THE AXIS WOULD START BELOW ZERO, SO IT FLOORS:
//   axis [0, 36.25], width 36.25
//   pos(5)=13.8  pos(10)=27.6  pos(15)=41.4  pos(20)=55.2  pos(30)=82.8
//   five segments: coral 0..13.8, amber 13.8..27.6, green 27.6..55.2,
//                  amber 55.2..82.8, coral 82.8..100
// Every expected number below is derived from the ruled formula by hand, not read back out of the
// implementation, so a wrong implementation cannot make them agree with itself.
const F = { low: 10, high: 20, conv_low: 5, conv_high: 30 };
const two = markerBandHTML(F, 15);

// MARKER_BAND_V3 / W2 — THE DOT'S LEFT IS NOW A clamp(), so this is the one parser for it and
// roughly a dozen assertions read through it. g.dot is emitted UNCHANGED as the MIDDLE
// argument; the outer two are the dot's own radius in px. The percentage read back here is
// therefore still exactly the number the geometry computed, and nothing below was loosened to
// accommodate the new shape.
//
// THE MATCHER PINS THE WHOLE EXPRESSION ON PURPOSE. A loosened one that merely scraped the
// first percentage out of the attribute would keep passing with either bound deleted or
// hardcoded -- three of the four W2 mutants -- so the strictness is the point, not pedantry.
const DOT_LEFT_RE =
  /class="mk-band-dot" style="left:clamp\(calc\(var\(--band-dot-d\)\/2\),([0-9.]+)%,calc\(100% - var\(--band-dot-d\)\/2\)\)"/;
const dotOf = (h) => (h.match(DOT_LEFT_RE) || [])[1];
ok("band renders with two functional bounds, two conventional bounds and a numeric value",
  two.includes('class="mk-band"'));
ok("it draws a track", two.includes('class="mk-band-track"'));
ok("it draws a dot", two.includes('class="mk-band-dot"'));
const zonesOf = (h) => (h.match(/class="mk-band-zone [^"]*" style="left:[0-9.]+%;width:[0-9.]+%"/g) || []);
eq("it draws FIVE zones, not one", zonesOf(two).length, 5);
ok("coral runs from the axis start to the conventional low edge",
  two.includes('class="mk-band-zone mk-zone-coral" style="left:0.0%;width:13.8%"'));
ok("amber runs from the conventional low edge to the functional low edge",
  two.includes('class="mk-band-zone mk-zone-amber" style="left:13.8%;width:13.8%"'));
ok("green is the functional range, pos(10) to pos(20)",
  two.includes('class="mk-band-zone mk-zone-green" style="left:27.6%;width:27.6%"'));
ok("amber runs from the functional high edge to the conventional high edge",
  two.includes('class="mk-band-zone mk-zone-amber" style="left:55.2%;width:27.6%"'));
ok("coral runs from the conventional high edge to the axis end",
  two.includes('class="mk-band-zone mk-zone-coral" style="left:82.8%;width:17.2%"'));
eq("the dot sits at pos(value) = 41.4%", dotOf(two), "41.4");
ok("only the GREEN zone's edges carry numbers",
  two.includes('class="mk-band-end" style="left:27.6%">10<') &&
  two.includes('class="mk-band-end" style="left:55.2%">20<'));
eq("and there are exactly two of them, so no amber boundary is numbered",
  (two.match(/class="mk-band-end"/g) || []).length, 2);

// THE FIVE SEGMENTS PARTITION THE AXIS. Widths are differences of rounded boundaries, so they
// chain exactly; summing separately-rounded widths would leave sub-0.1% seams instead.
const segsOf = (h) => zonesOf(h).map((z) => ({
  left: Number(z.match(/left:([0-9.]+)%/)[1]), width: Number(z.match(/width:([0-9.]+)%/)[1]) }));
const partitionOK = (h) => {
  const s = segsOf(h); if (!s.length) return false;
  if (s[0].left !== 0) return false;
  for (let i = 1; i < s.length; i++)
    if (Math.abs((s[i - 1].left + s[i - 1].width) - s[i].left) > 1e-9) return false;
  const last = s[s.length - 1];
  return Math.abs((last.left + last.width) - 100) < 1e-9;
};
ok("the segments start at 0, chain with no gap and no overlap, and end at 100", partitionOK(two));
eq("and their widths sum to exactly 100 percent of the axis",
  Number(segsOf(two).reduce((a, s) => a + s.width, 0).toFixed(6)), 100);
ok("partition control: the summation DOES fail on a deliberately broken chain", !partitionOK(
  '<span class="mk-band-zone mk-zone-coral" style="left:0.0%;width:10.0%"></span>' +
  '<span class="mk-band-zone mk-zone-green" style="left:20.0%;width:80.0%"></span>'));

// THE AXIS IS NOT DERIVED FROM HER VALUE. Move the value far outside and the ZONES must not move.
const far = markerBandHTML(F, -9999);
ok("AXIS INDEPENDENCE: a wildly different value leaves every zone exactly where it was",
  JSON.stringify(segsOf(far)) === JSON.stringify(segsOf(two)));
ok("axis-independence control: the DOT did move", dotOf(far) !== "41.4");

// Two different below-range values must NOT collapse onto one position. Under V1 both were 4%.
const a1 = markerBandHTML(F, 8), a2 = markerBandHTML(F, 6);
// dotOf's OWN CONTROLS. A parser that cannot fail is not a parser, and this one now has to
// read through a compound expression rather than a bare percentage.
ok("dotOf control: it reads the position back out of the clamp", dotOf(two) === "41.4");
ok("dotOf control: a WRONG percentage inside the clamp does not read back as the right one",
  dotOf(two.replace("41.4%", "77.7%")) !== "41.4");
eq("dotOf control: and it reads that wrong one as what it is, rather than returning nothing",
  dotOf(two.replace("41.4%", "77.7%")), "77.7");
ok("dotOf control: it returns NOTHING for the pre-clamp bare-percentage shape, which is what "
  + "catches a matcher loosened to accept any left: value",
  dotOf('<span class="mk-band-dot" style="left:41.4%"></span>') === undefined);
ok("dotOf control: NOTHING when the upper bound is missing, the W2d shape",
  dotOf('<span class="mk-band-dot" style="left:clamp(calc(var(--band-dot-d)/2),41.4%)"></span>')
    === undefined);
ok("dotOf control: NOTHING when the lower bound is a hardcoded percentage, the W2c shape",
  dotOf('<span class="mk-band-dot" style="left:clamp(1.8%,41.4%,calc(100% - var(--band-dot-d)/2))">'
  + '</span>') === undefined);
ok("two different below-range values take DIFFERENT positions", dotOf(a1) !== dotOf(a2));
eq("and at the ruled positions, pos(8) = 22.1%", dotOf(a1), "22.1");
eq("pos(6) = 16.6%", dotOf(a2), "16.6");
ok("separation control: the same value twice takes the SAME position",
  dotOf(markerBandHTML(F, 8)) === dotOf(a1));
// TWO DIFFERENT AXES MAY PUT DIFFERENT VALUES ON THE SAME PERCENTAGE, and that is a coincidence,
// not the collapse the separation work was about. Measured on report ae52d923: ferritin and tsh
// both land on 35.7%. They are different markers in different rows on different axes, so the
// number they share means nothing. What must never happen is two values collapsing on ONE axis,
// which is what the assertions above pin.
{
  // NOT a scaled copy of F. {100,200,50,300} is exactly ten times {10,20,5,30} and the geometry
  // is scale invariant, so its segments are identical to the decimal -- which is itself worth
  // knowing, and is why this fixture changes SHAPE rather than magnitude.
  const G = { low: 100, high: 200, conv_low: 90, conv_high: 400 };
  ok("cross-axis control: these two fixtures really do have different axes",
    JSON.stringify(segsOf(markerBandHTML(F, 15))) !== JSON.stringify(segsOf(markerBandHTML(G, 150))));
  ok("and the SAME value placed on both lands in different places",
    dotOf(markerBandHTML(F, 15)) !== dotOf(markerBandHTML(G, 15)));
  ok("while on ONE axis two different values never collapse",
    dotOf(markerBandHTML(F, 12)) !== dotOf(markerBandHTML(F, 18)));
}

// CLAMP: dot only, to [2,98]. Zone edges are never clamped.
ok("a value far below clamps the DOT to 2%", dotOf(markerBandHTML(F, -1e6)) === "2.0");
ok("a value far above clamps the DOT to 98%", dotOf(markerBandHTML(F, 1e6)) === "98.0");
ok("clamp control: an in-axis value is NOT clamped", dotOf(two) === "41.4");
ok("the ZONES are never clamped, even when the dot is",
  JSON.stringify(segsOf(markerBandHTML(F, -1e6))) === JSON.stringify(segsOf(two)));

// A FIXTURE WHOSE ZONE EDGES LIE OUTSIDE THE CLAMP RANGE ON BOTH SIDES, so clamping an edge would
// be visible. It also exercises the zero-width amber: the conventional range sits strictly INSIDE
// the functional one on both sides, so outer_lo is f_low and outer_hi is f_high.
//   W: f [1,1000], conv [400,410]. span 10, pad 2.5, outer [1,1000], axis would be [-1.5, 1002.5]
//   all bounds >= 0 -> FLOORS to [0, 1002.5], width 1002.5
//   pos(1) = 0.1   pos(1000) = 99.8   pos(405) = 40.4
{
  const W = { low: 1, high: 1000, conv_low: 400, conv_high: 410 };
  const wide = markerBandHTML(W, 405);
  ok("zone-clamp control: this fixture really does draw", wide !== "");
  ok("a zone edge BELOW 2% is left where it is, not clamped up",
    wide.includes('class="mk-band-zone mk-zone-green" style="left:0.1%;width:99.7%"'));
  ok("a zone edge ABOVE 98% is left where it is, not clamped down",
    wide.includes('class="mk-band-zone mk-zone-coral" style="left:99.8%;width:0.2%"'));
  ok("the green zone's own numbers are pinned outside the clamp range too",
    wide.includes('class="mk-band-end" style="left:0.1%">1<') &&
    wide.includes('class="mk-band-end" style="left:99.8%">1000<'));
  // ZERO-WIDTH AMBER RENDERS NOTHING, not a sliver.
  eq("a conventional range inside the functional one draws NO amber at all",
    (wide.match(/mk-zone-amber/g) || []).length, 0);
  eq("so three segments are drawn, not five", zonesOf(wide).length, 3);
  ok("and they still partition the axis with no gap", partitionOK(wide));
  ok("zero-width control: the five-segment fixture DOES draw amber",
    (two.match(/mk-zone-amber/g) || []).length === 2);
}

// THE ZERO FLOOR, and the case where it must NOT apply.
//   FE: f [60,100], conv [13,150]. span 137, pad 34.25, axis would be [-21.25, 184.25]
//   all bounds >= 0 -> FLOORS to [0, 184.25]
//   pos(13)=7.1  pos(60)=32.6  pos(100)=54.3  pos(150)=81.4  pos(70)=38.0
{
  const FE = { low: 60, high: 100, conv_low: 13, conv_high: 150 };
  const fe = markerBandHTML(FE, 70);
  ok("a marker whose padded axis would start below zero starts at zero instead",
    fe.includes('class="mk-band-zone mk-zone-coral" style="left:0.0%;width:7.1%"'));
  ok("and its green sits where the floored axis puts it",
    fe.includes('class="mk-band-zone mk-zone-green" style="left:32.6%;width:21.7%"'));
  eq("floor control: on the UNfloored axis pos(60) would be 39.5, not 32.6",
    Number((((60) - (-21.25)) / (184.25 - (-21.25)) * 100).toFixed(1)), 39.5);
  //   N: f [-10,10], conv [-20,20]. span 40, pad 10, axis [-30, 30], width 60.
  //   A BOUND ON FILE IS NEGATIVE, so the floor does NOT apply even though axis_lo < 0.
  //   pos(-20)=16.7  pos(-10)=33.3  pos(10)=66.7  pos(20)=83.3  pos(0)=50.0
  const N = { low: -10, high: 10, conv_low: -20, conv_high: 20 };
  const neg = markerBandHTML(N, 0);
  ok("a marker with a negative bound on file keeps its negative axis",
    neg.includes('class="mk-band-zone mk-zone-amber" style="left:16.7%;width:16.6%"') &&
    neg.includes('class="mk-band-zone mk-zone-green" style="left:33.3%;width:33.4%"'));
  ok("its dot sits at pos(0) = 50.0%, which is only true on an UNfloored axis",
    dotOf(neg) === "50.0");
  ok("and it still partitions", partitionOK(neg));
  ok("negative-fixture control: the floored fixture does NOT put its green at 33.3%",
    !fe.includes('mk-zone-green" style="left:33.3%'));
}

// TIER 2 — THE FALLBACK AXIS. A marker with no usable conventional interval draws GREEN ONLY, on
// an axis padded by K times the functional width. There is no wider range on file, so there is no
// amber and no coral: painting the pad coral would invent a reference interval out of a constant.
// The three former no-track conditions -- conventional absent, non-numeric or infinite, and
// zero-width or inverted -- are now three routes to the same fallback.
eq("the fallback pad constant is exactly 1.0", BAND_FALLBACK_PAD_K, 1.0);
{
  //   T: f [30,40], no conventional. pad = 1.0 * 10 = 10, axis [20,50], width 30, no floor.
  //   pos(30)=33.3  pos(35)=50.0  pos(40)=66.7
  const T = { low: 30, high: 40 };
  const t2 = markerBandHTML(T, 35);
  ok("a marker with no conventional bounds now DRAWS", t2 !== "");
  eq("and it is Tier 2", markerBandGeometry(T, 35).tier, 2);
  eq("it draws exactly ONE zone", zonesOf(t2).length, 1);
  ok("and that zone is green", t2.includes('class="mk-band-zone mk-zone-green" style="left:33.3%;width:33.4%"'));
  eq("no amber anywhere", (t2.match(/mk-zone-amber/g) || []).length, 0);
  eq("no coral anywhere", (t2.match(/mk-zone-coral/g) || []).length, 0);
  ok("its dot is placed on the padded axis, pos(35) = 50.0%",
    dotOf(t2) === "50.0");
  const noteOfT2 = (h) => { const m = h.match(/<div class="mk-band-note ([^"]*)">([^<]*)<\/div>/); return m ? [m[1], m[2]] : null; };
  eq("and it carries the Tier 2 note", JSON.stringify(noteOfT2(t2)),
    JSON.stringify(["mk-note-plain", "No wider range on file, so only the functional range is shown"]));
  // GREEN IS ONE THIRD OF THE AXIS AT K = 1, computed from the constant rather than hardcoded.
  const g = markerBandGeometry(T, 35);
  const expected = 100 / (1 + 2 * BAND_FALLBACK_PAD_K);
  ok("green occupies 1/(1+2K) of the axis, which at K = 1 is one third",
    Math.abs((g.g1 - g.g0) - expected) < 1e-9);
  ok("K control: the same assertion FAILS if K were 0.5, which would make green one half",
    Math.abs((g.g1 - g.g0) - 100 / (1 + 2 * 0.5)) > 1e-9);
  eq("and one third is 33.33..., not 50", Number(expected.toFixed(4)), 33.3333);
}
// Every route to Tier 2, each asserted separately so a red names which one broke.
for (const [label, ref] of [
  ["no conventional keys at all", { low: 10, high: 20 }],
  ["conv_low absent", { low: 10, high: 20, conv_high: 30 }],
  ["conv_high absent", { low: 10, high: 20, conv_low: 5 }],
  ["conv_low non-numeric", { low: 10, high: 20, conv_low: "n/a", conv_high: 30 }],
  ["conv_low -Infinity", { low: 10, high: 20, conv_low: -Infinity, conv_high: 30 }],
  ["conv_high +Infinity", { low: 10, high: 20, conv_low: 5, conv_high: Infinity }],
  ["conv span zero", { low: 10, high: 20, conv_low: 30, conv_high: 30 }],
  ["conv span inverted", { low: 10, high: 20, conv_low: 30, conv_high: 5 }],
]) {
  eq("TIER 2 route, " + label, markerBandGeometry(ref, 15).tier, 2);
  eq("  and it draws green only, " + label,
    (markerBandHTML(ref, 15).match(/mk-zone-(amber|coral)/g) || []).length, 0);
}
ok("tier control: a usable conventional interval still gives TIER 1",
  markerBandGeometry({ low: 10, high: 20, conv_low: 5, conv_high: 30 }, 15).tier === 1);

// THE FOUR NO-TRACK CONDITIONS, and now they really are the only ones.
eq("no band when the functional range is LOW-ONLY", markerBandHTML({ low: 10, high: null }, 15), "");
eq("no band when the functional range is HIGH-ONLY", markerBandHTML({ low: null, high: 20 }, 15), "");
eq("no band with no functional bounds at all", markerBandHTML({ low: null, high: null }, 15), "");
eq("no band when the functional bounds are inverted", markerBandHTML({ low: 20, high: 10 }, 15), "");
eq("no band with a null ref", markerBandHTML(null, 15), "");
eq("no band with a non-numeric value", markerBandHTML({ low: 10, high: 20 }, "positive"), "");
eq("no band with an absent value", markerBandHTML({ low: 10, high: 20 }, undefined), "");
ok("no-track control: the same fixture WITH a numeric value draws",
  markerBandHTML({ low: 10, high: 20 }, 15) !== "");

// THE ZERO FLOOR APPLIES TO TIER 2 TOO, and still not when a bound on file is negative.
{
  //   f [3,10], pad 7, axis would be [-4, 17] -> FLOORS to [0, 17]
  //   pos(3) = 17.6   pos(10) = 58.8, so green is wider than a third because the floor took the
  //   whole low pad away. That is the point: the axis stops claiming impossible concentrations.
  const fl = markerBandGeometry({ low: 3, high: 10 }, 5);
  ok("a Tier 2 axis that would start below zero starts at zero", fl.floored === true && fl.axis_lo === 0);
  ok("and its green is correspondingly wider than one third",
    (fl.g1 - fl.g0) > 100 / (1 + 2 * BAND_FALLBACK_PAD_K));
  const ng = markerBandGeometry({ low: -5, high: 5 }, 0);
  ok("a Tier 2 marker with a negative bound on file keeps its negative axis",
    ng.floored === false && ng.axis_lo === -15);
  ok("floor control: the unfloored Tier 2 fixture is exactly one third",
    Math.abs((ng.g1 - ng.g0) - 100 / (1 + 2 * BAND_FALLBACK_PAD_K)) < 1e-9);
}

// THE SHIPPED LIBRARY, by name and by count. Every number here is measured from the real
// ranges-slim.json at run time, not written down, and the populations are counted separately from
// what actually draws because the two differ and the difference is the finding.
{
  const RS = JSON.parse(readFileSync(process.env.RANGES || "ranges-slim.json", "utf8")).by_marker_id;
  const entries = Object.entries(RS);
  eq("library control: ranges-slim carries the expected number of entries", entries.length, 228);
  const twoEnded = (r) => r.low != null && r.high != null && Number(r.high) > Number(r.low);
  const usableConv = (r) => r.conv_low != null && r.conv_high != null &&
    isFinite(Number(r.conv_low)) && isFinite(Number(r.conv_high)) &&
    Number(r.conv_high) > Number(r.conv_low);
  const mid = (r) => (Number(r.low) + Number(r.high)) / 2;
  const geoOf = (r) => twoEnded(r) ? markerBandGeometry(r, mid(r)) : null;

  let t1 = 0, t2 = 0, none = 0, floored = 0, notTwoEnded = 0; const gw = [], t1Dropped = [];
  for (const [id, r] of entries) {
    if (!twoEnded(r)) { notTwoEnded++; none++;
      ok("an entry that is not two-ended draws nothing: " + id, markerBandHTML(r, 1) === "");
      continue; }
    const g = geoOf(r);
    if (!g) { none++; t1Dropped.push(id); continue; }
    if (g.tier === 1) t1++;
    else { t2++; if (g.floored) floored++; gw.push(g.g1 - g.g0); }
  }
  gw.sort((a, b) => a - b);
  eq("library: entries with a TWO-ENDED functional range", entries.length - notTwoEnded, 140);
  eq("library: entries with only ONE functional bound, which can never draw", notTwoEnded, 88);
  eq("library: entries that build a TIER 1 axis", t1, 123);
  eq("library: entries that build a TIER 2 axis", t2, 16);
  eq("library: entries that draw NOTHING under either tier", none, 89);
  eq("and those three partition the library", t1 + t2 + none, entries.length);
  eq("library: Tier 2 axes that floor at zero", floored, 8);
  eq("library: narrowest Tier 2 green, to one decimal", Number(gw[0].toFixed(1)), 33.3);
  eq("library: median Tier 2 green", Number(gw[Math.floor(gw.length / 2)].toFixed(1)), 40.0);
  eq("library: widest Tier 2 green", Number(gw[gw.length - 1].toFixed(1)), 44.4);

  // THE ZERO FLOOR COSTS EXACTLY ONE TIER 1 TRACK, and it is named rather than counted away.
  // basophils_pct has a functional range starting at 0. Its unfloored axis padded below zero and
  // it drew; the floored axis starts AT f_low, so nothing strictly contains the range and the
  // renderer refuses. That is the ruled containment condition doing its job, not a regression to
  // be worked around: an axis whose first pixel is the functional minimum cannot show a value
  // below it, and this marker's values are all at or above zero by definition.
  eq("the zero floor costs exactly one Tier 1 track", t1Dropped.length, 1);
  eq("and it is basophils_pct, by name", t1Dropped[0], "basophils_pct");
  ok("its functional range starts at exactly zero, which is why", Number(RS["basophils_pct"].low) === 0);
  ok("floor-cost control: a Tier 1 marker whose range does NOT start at zero still draws",
    markerBandHTML(RS["ferritin"], mid(RS["ferritin"])) !== "");

  // nucleated_rbc_pct — CORRECTING WHAT THE PREVIOUS PASS REPORTED. It was read as reaching Tier 2
  // through its zero-width conventional interval. It carries one, and that part was right, but it
  // never reaches the tier branch at all: its FUNCTIONAL high equals its functional low, so it
  // fails the two-ended guard first and draws nothing under either tier. The earlier reading came
  // from a conventional-key cross-tab that never checked the functional range.
  const NR = RS["nucleated_rbc_pct"];
  ok("nucleated_rbc_pct carries both conventional keys", NR.conv_low != null && NR.conv_high != null);
  ok("and that conventional interval really is zero width",
    Number(NR.conv_high) === Number(NR.conv_low));
  ok("BUT its functional high equals its functional low", Number(NR.high) === Number(NR.low));
  ok("so it is not two-ended", !twoEnded(NR));
  eq("and it draws NOTHING, under either tier", markerBandHTML(NR, Number(NR.high)), "");
  eq("its geometry is null, so it never reaches the tier branch", markerBandGeometry(NR, Number(NR.high)), null);
  ok("nucleated control: a marker that DOES reach Tier 2 exists and draws",
    (() => { const k = entries.find(([, r]) => twoEnded(r) && !usableConv(r));
      return !!k && markerBandHTML(k[1], mid(k[1])) !== ""; })());
  ok("tier-by-name control: a marker with a real conventional interval is Tier 1",
    (() => { const k = entries.find(([, r]) => twoEnded(r) && usableConv(r) && Number(r.low) !== 0);
      return markerBandGeometry(k[1], mid(k[1])).tier === 1; })());
}
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

// ---------------------------------------------------------------------------
// NO VERDICT, one word at a time, on the RENDERED markup rather than the source.
//
// THE LIST IS UNCHANGED AT TWENTY WORDS. THE SCOPE NARROWED, 2026-09-18, and the
// difference matters: this assertion was written against a band that carried no
// words and no colour names, so the band could not restate the engine's verdict
// in prose or in a class a future change could colour. MARKER_BAND_V3, the
// ratified three-zone design, gives the band both. It draws green, amber and
// coral zones, labels them in a legend, and writes one line beneath each track
// saying which zone her value landed in. Four of the twenty -- amber, coral,
// green, range -- are on the list precisely BECAUSE the old design refused to
// use them, and six of the nine ratified strings trip on "range" alone.
//
// So the list keeps all twenty and the SCOPE narrows to exactly three exemptions,
// BY ELEMENT AND BY ATTRIBUTE:
//     .mk-band-legend   the whole element, subtree included
//     .mk-band-note     the whole element, subtree included
//     .mk-band-zone     its CLASS ATTRIBUTE VALUE only
// Everything else in the band stays under the full twenty: the dot, the track,
// the edge labels, every other class name, every inline style, every aria
// attribute. A zone therefore carries its colour in its class and its geometry in
// its style, and the style is still scanned -- so background:green in an inline
// style goes red while class="mk-zone-green" does not.
//
// IT IS PARSED, NOT SUBSTRING-DELETED. Deleting the exempt elements from the
// string before scanning would also blind the scan to a banned word sitting
// immediately beside one, because the deletion's own pattern decides where the
// element ends. The parser walks tags and attributes and rebuilds the remainder,
// and the adjacency assertion below is what tells the two implementations apart.
//
// THIS IS A NARROWING, NOT DRIFT. If a future change wants a fourth exemption it
// is a ruling, not a convenience: the scan is the only thing standing between the
// band and a picture that argues with the sentence above it.
// ---------------------------------------------------------------------------
const VERDICT = ["high", "low", "normal", "optimal", "good", "bad", "flag", "watch",
  "elevated", "deficient", "critical", "healthy", "abnormal", "concern", "risk", "poor",
  "amber", "coral", "green", "range"];
eq("the verdict list still holds all twenty words", VERDICT.length, 20);
eq("and it is still the ratified twenty, none removed", VERDICT.slice().sort().join(","),
  "abnormal,amber,bad,concern,coral,critical,deficient,elevated,flag,good,green,healthy," +
  "high,low,normal,optimal,poor,range,risk,watch");

// Whole-subtree exemptions, by class token.
const EXEMPT_ELEMENT = ["mk-band-legend", "mk-band-note"];
// Class-attribute-value-only exemptions, by class token.
const EXEMPT_CLASS_ATTR = ["mk-band-zone"];

// Rebuild the scannable remainder by walking the markup. Emits tag names, attribute
// names, attribute values and text; drops an exempt element entirely, and drops only
// the VALUE of a class attribute on an exempt-class-attr element.
function scannableRemainder(markup) {
  const out = [];
  const tagRe = /<\/?[a-zA-Z][^>]*>/g;
  let last = 0, depth = 0, skipFrom = null, m;
  const classTokens = (tag) => {
    const c = tag.match(/\bclass\s*=\s*"([^"]*)"/);
    return c ? c[1].trim().split(/\s+/) : [];
  };
  while ((m = tagRe.exec(markup)) !== null) {
    const text = markup.slice(last, m.index);
    if (skipFrom === null && text) out.push(text);
    last = m.index + m[0].length;
    const tag = m[0];
    const closing = tag.startsWith("</");
    const selfClosing = /\/>$/.test(tag);
    if (closing) {
      depth--;
      // depth has already been decremented, so the exempt element's OWN close tag brings
      // depth back TO skipFrom, not below it. "<" left the skip latched forever and swallowed
      // everything after the note -- caught by the adjacency assertion below, which is the one
      // assertion in this file whose whole job is to fail when the exemption over-reaches.
      if (skipFrom !== null && depth <= skipFrom) skipFrom = null;
      else if (skipFrom === null) out.push(tag.replace(/[<>/]/g, " "));
      continue;
    }
    const toks = classTokens(tag);
    if (skipFrom === null && EXEMPT_ELEMENT.some((e) => toks.includes(e))) {
      if (!selfClosing) { skipFrom = depth; depth++; }
      continue;
    }
    if (skipFrom === null) {
      const name = tag.match(/^<\s*([a-zA-Z][a-zA-Z0-9-]*)/)[1];
      out.push(name);
      const exemptClass = EXEMPT_CLASS_ATTR.some((e) => toks.includes(e));
      const attrRe = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
      let a;
      while ((a = attrRe.exec(tag)) !== null) {
        out.push(a[1]);
        if (!(a[1].toLowerCase() === "class" && exemptClass)) out.push(a[2]);
      }
    }
    if (!selfClosing) depth++;
  }
  const tail = markup.slice(last);
  if (skipFrom === null && tail) out.push(tail);
  return out.join(" ").toLowerCase();
}
const verdictHits = (markup) => VERDICT.filter((w) => scannableRemainder(markup).includes(w));

// --- the parser's own controls, before it is trusted with anything -----------
ok("parser control: it keeps ordinary text",
  scannableRemainder("<span>hello</span>").includes("hello"));
ok("parser control: it keeps a class value on a NON-exempt element",
  scannableRemainder('<span class="mk-band-dot"></span>').includes("mk-band-dot"));
ok("parser control: it keeps an inline style on an exempt-class-attr element",
  scannableRemainder('<span class="mk-band-zone" style="left:1%"></span>').includes("left:1%"));
ok("parser control: it drops the class VALUE on an exempt-class-attr element",
  !scannableRemainder('<span class="mk-band-zone zzq"></span>').includes("zzq"));
ok("parser control: it drops an exempt element's TEXT",
  !scannableRemainder('<div class="mk-band-note">zzq</div>').includes("zzq"));
ok("parser control: it drops an exempt element's nested children",
  !scannableRemainder('<div class="mk-band-legend"><span class="sw">zzq</span></div>').includes("zzq"));

// --- the twenty, one at a time, on the REAL rendered band -------------------
for (const w of VERDICT) {
  ok("no verdict word in the rendered band: " + w, !verdictHits(two).includes(w));
}
ok("verdict-scan control: the scanner DOES fire on a planted word",
  verdictHits(two + '<span class="optimal"></span>').includes("optimal"));

// --- the three exemptions, each asserted with the control that discriminates --
const NOTE = '<div class="mk-band-note mk-note-amber">In the wider reference range, ' +
  'below the functional range</div>';
eq("EXEMPT: the zone-note element carries ruled copy and reports nothing",
  verdictHits(NOTE).length, 0);
ok("control: the SAME copy in a non-exempt element still trips",
  verdictHits('<div class="mk-band-ends">In the wider reference range</div>').length > 0);

const LEGEND = '<div class="mk-band-legend"><span class="mk-lg mk-lg-green">' +
  '<span class="mk-sw"></span>Functional range</span><span class="mk-lg mk-lg-amber">' +
  '<span class="mk-sw"></span>Wider reference range</span><span class="mk-lg mk-lg-coral">' +
  '<span class="mk-sw"></span>Outside both</span></div>';
eq("EXEMPT: the legend element carries ruled copy and colour names, reports nothing",
  verdictHits(LEGEND).length, 0);
ok("control: the same legend markup under a non-exempt class trips",
  verdictHits(LEGEND.replace("mk-band-legend", "mk-band-legendx")).length > 0);

eq("EXEMPT: a zone element's CLASS attribute may name its colour",
  verdictHits('<span class="mk-band-zone mk-zone-green" style="left:0.0%;width:9.9%"></span>').length, 0);
ok("control: the zone's INLINE STYLE is not exempt, so a colour there still trips",
  verdictHits('<span class="mk-band-zone" style="background:green"></span>').includes("green"));
ok("control: the same colour class on a NON-exempt element still trips",
  verdictHits('<span class="mk-band-dot mk-zone-green"></span>').includes("green"));

// --- everything else stays under the full twenty ----------------------------
ok("NOT EXEMPT: a verdict word in the dot's class trips",
  verdictHits('<span class="mk-band-dot optimal"></span>').includes("optimal"));
ok("NOT EXEMPT: a verdict word in an edge label's text trips",
  verdictHits('<span class="mk-band-end">elevated</span>').includes("elevated"));
ok("NOT EXEMPT: a verdict word in the track's class trips",
  verdictHits('<div class="mk-band-track flag"></div>').includes("flag"));
ok("NOT EXEMPT: a verdict word in an aria attribute trips",
  verdictHits('<div class="mk-band" aria-label="critical"></div>').includes("critical"));
// PLANTED INSIDE THE REAL BAND, not beside it. Every assertion above plants its word in a
// standalone fragment, so widening the exemption to the whole .mk-band element would leave them
// all green while the scan stopped looking at anything that matters.
ok("NOT EXEMPT: a verdict word planted INSIDE the band's own track is still found",
  verdictHits(two.replace('class="mk-band-track"', 'class="mk-band-track optimal"')).includes("optimal"));
ok("plant control: the unmutated band does NOT contain that word",
  !verdictHits(two).includes("optimal"));

// --- ADJACENCY. This is the assertion that tells parsing from deletion apart. -
// A substring deletion keyed on the note element swallows whatever its pattern
// happens to reach; the parser stops at the close tag. Both words below sit
// OUTSIDE the exempt element and must be found.
const ADJACENT = '<div class="mk-band">' + NOTE + '<span class="mk-band-end">optimal</span></div>';
ok("ADJACENCY: a banned word immediately AFTER an exempt element is still found",
  verdictHits(ADJACENT).includes("optimal"));
ok("ADJACENCY: a banned word immediately BEFORE an exempt element is still found",
  verdictHits('<div class="mk-band"><span class="mk-band-end">watch</span>' + NOTE + '</div>')
    .includes("watch"));
ok("ADJACENCY control: the exempt element's own copy is still not reported",
  !verdictHits(ADJACENT).includes("range"));
ok("no status class hook that a future change could colour",
  !/s-good|s-watch|s-flag|s-ref/.test(two.toLowerCase()));
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
  bandContradictsEngine({ low: 10, high: null }, 15, "low") === false);

// ===========================================================================
// 2. THE BAND ON THE PRIORITY PATH, executed, including the sensitive guard.
// ===========================================================================
const prioSrc = cutAfter(CODE, '$("prios").innerHTML = pr.map((x,i)=>{', "{", "}");
const prioArrow = prioSrc.slice(prioSrc.indexOf("(x,i)=>"));
const SENSITIVE_SYSTEMS = new Set(["heavy_metals", "autoimmune", "tumor_markers"]);
const markerName = (m) => (m && (m.display_name || m.marker_id)) || "";
const sysStatus = () => ({ cls: "s-good", label: "Looks good" });
const toneFor = () => "t-coral";
// PRIO_ART_V1 — the card callback calls prioArtSVG for its drawing. Stubbed here the same way
// toneFor is, because the drawing is not what this file asserts: scripts/test-prio-art.mjs
// executes the real one and scripts/test-dashboard-e2e.mjs renders it in a browser.
const prioArtSVG = () => "";
const healthyRangeText = (ref) => (ref && ref.low != null && ref.high != null)
  ? ("Healthy " + ref.low + " to " + ref.high) : "";
const PRIO_TOGGLE_LABEL = { closed: "See more details", open: "Hide details" };
// MARKER_BAND_V3 — the legend markup is read out of the page, not restated here.
const BAND_LEGEND_HTML = new Function(
  "return " + (CODE.match(/const BAND_LEGEND_HTML = ([\s\S]*?);\n/) || [])[1] + ";")();

function renderPriority({ sysId, ref, value, band }) {
  const chipSysByMarker = { m1: sysId };
  const chipValByMarker = value === undefined ? {} : { m1: value };
  const lookupRange = () => ref;
  const fn = new Function(
    "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
    "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
    "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL", "prioArtSVG",
    "markerBandGeometry", "BAND_LEGEND_HTML", "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    chipSysByMarker, chipValByMarker, lookupRange, healthyRangeText,
    markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL, prioArtSVG,
    markerBandGeometry, BAND_LEGEND_HTML);
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
    "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL", "prioArtSVG",
    "markerBandGeometry", "BAND_LEGEND_HTML", "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    chipSysByMarker, chipValByMarker, () => F, healthyRangeText,
    markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL, prioArtSVG,
    markerBandGeometry, BAND_LEGEND_HTML);
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
    return h ? (dotOf(h) ?? null) : null;
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
    dotOf(markerBandHTML(G, 12)) !== dotOf(markerBandHTML(H, 12)));
  ok("geometry control: the SAME geometry places the same value identically",
    dotOf(markerBandHTML(G, 12)) === dotOf(markerBandHTML({ ...G }, 12)));
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


// ===========================================================================
// 9. MARKER_BAND_V3 — THE RENDERING AND THE RULED COPY.
// ===========================================================================
// THE FLOATING VALUE IS GONE. Her value appears once, at the right of the row, where it already
// is. The duplicate above the dot is what clipped MCHC's label against the left edge.
eq("no floating value label survives in the band", (two.match(/mk-band-val/g) || []).length, 0);
ok("value-deletion control: the dot it used to sit above is still drawn",
  two.includes('class="mk-band-dot"'));
eq("and .mk-band-val is gone from the stylesheet too", (RAW.match(/\.mk-band-val\{/g) || []).length, 0);
ok("stylesheet control: the same matcher finds a rule that IS there", /\.mk-band-dot\{/.test(RAW));

// THE DOT SITS OUTSIDE THE TRACK, which now clips. A dot inside a 9px overflow-hidden track
// would lose its top and bottom, and at 15px it would lose most of itself.
ok("the dot is in its own wrapper", two.includes('class="mk-band-dotwrap"'));
{
  const track = two.slice(two.indexOf('<div class="mk-band-track">'),
                          two.indexOf('<div class="mk-band-dotwrap">'));
  ok("and the wrapper is OUTSIDE the track, not nested in it", !track.includes("mk-band-dot\""));
  ok("track-slice control: the slice really is the track and holds the zones",
    track.includes("mk-band-zone"));
}
ok("the track clips its zones to its rounded ends",
  /\.mk-band-track\{[^}]*overflow:hidden/.test(RAW));
ok("the track is 9px tall with a 5px radius",
  /\.mk-band-track\{[^}]*height:9px/.test(RAW) && /\.mk-band-track\{[^}]*border-radius:5px/.test(RAW));
// ---------------------------------------------------------------------------------------
// Z10, REWRITTEN 2026-09-19. THE OLD FORM WAS /\.mk-band\{[^}]*max-width:420px/ AGAINST RAW,
// AND IT GOVERNED NOTHING. It pinned the PRESENCE of the declaration and its position inside
// the .mk-band block, and nothing else. It would have stayed green with the track moved out
// of .mk-band entirely, with a later rule re-declaring a width on it, or with the cap sitting
// on an element the track does not inherit its width from. TEXT PRESENCE IS NOT WIRING.
//
// WHAT THIS PINS INSTEAD is the property chain that DETERMINES the track's used width:
//   Z10-A  the 420px cap exists in the band's CSS, at top level, not behind a breakpoint,
//          and on exactly the selectors it is supposed to be on
//   Z10-B  one of those selectors is an ANCESTOR OF THE TRACK IN THE EMITTED MARKUP, so the
//          track's used width is that element's content width
//   Z10-C  .mk-band-track declares no width, max-width or min-width of its own, so nothing
//          downstream re-widens it away from that content box
//   Z10-D  no second rule anywhere in the sheet re-declares a width on either element
//
// THIS IS A WEAKER GUARANTEE THAN A RESOLVED WIDTH, AND IT HAS TO BE: the suite has no DOM,
// so there is no layout engine here to ask. Named plainly, what it does NOT cover:
//   - it never runs layout, so it cannot report the px the track actually occupies;
//   - it does not resolve the cascade. Specificity, !important and source order are handled
//     here by COUNTING the rules that touch these two selectors (Z10-D), not by resolution;
//   - it says nothing about ANCESTORS above .mk-band. A width on .prio-markers, .prio or
//     .app changes what the track fills without touching either selector checked here;
//   - it cannot see a width applied at runtime by script, or by a stylesheet injected after
//     load. Measured against the shipped file on 2026-09-19: zero insertRule,
//     createElement("style") and adoptedStyleSheets sites, and zero style.width /
//     style.maxWidth writes, against controls of 20 createElement and 29 .style. calls in
//     the same pass. That is a measurement of today's file, not a property this enforces.
// The RESOLVED width was measured out of band with a real layout engine on 2026-09-19 and
// was 420.00px at the cap. This assertion is what stands guard between such measurements.
// ---------------------------------------------------------------------------------------
{
  // Flat rule extraction over the <style> block. Comments come out first, and a rule nested
  // inside an @media is TAGGED, because a cap that only applies at a breakpoint is a cap that
  // governs nothing at the width the band is actually read at.
  const STYLE = RAW.slice(RAW.indexOf("<style>") + 7, RAW.indexOf("</style>"));
  const cssRules = [];
  {
    const src = STYLE.replace(/\/\*[\s\S]*?\*\//g, "");
    let buf = "", depth = 0, media = 0, head = "";
    for (const ch of src) {
      if (ch === "{") {
        if (depth === 0) {
          head = buf.trim(); buf = "";
          if (head.startsWith("@")) { media++; head = ""; continue; }
          depth = 1; continue;
        }
        depth++; buf += ch; continue;
      }
      if (ch === "}") {
        if (depth === 1) { cssRules.push({ sel: head, body: buf, media: media > 0 }); buf = ""; depth = 0; continue; }
        if (depth === 0) { media = Math.max(0, media - 1); buf = ""; continue; }
        depth--; buf += ch; continue;
      }
      buf += ch;
    }
  }
  const selsOf = (r) => r.sel.split(",").map((x) => x.trim());
  const setsWidth = (body) => /(^|[;\s])(min-|max-)?width\s*:/.test(body);

  ok("rule-extraction control: the stylesheet parsed into a plausible number of rules",
    cssRules.length > 500);
  ok("rule-extraction control: it finds a rule it must find, at top level, with its body",
    cssRules.some((r) => selsOf(r).includes(".mk-band-track") && !r.media &&
      /overflow:hidden/.test(r.body)));
  ok("rule-extraction control: it finds a rule that IS behind a breakpoint, and tags it",
    cssRules.some((r) => r.media));
  ok("rule-extraction impossible control: a selector that does not exist is not found",
    !cssRules.some((r) => /mk-band-nonesuch-zzz/.test(r.sel)));
  ok("width-matcher control: it fires on a body that sets a width",
    setsWidth("position:relative;max-width:420px"));
  ok("width-matcher control: and NOT on a body that only sets a height",
    !setsWidth("position:relative;height:9px;border-radius:5px"));

  // Z10-A. The SET of band selectors carrying the cap, not merely that one exists. Removing
  // the cap and moving it to a sibling both turn this red, and the reported "got" value names which
  // selectors carry it, so the two mutants are told apart by reading the failure.
  const capped = cssRules
    .filter((r) => !r.media && /(^|[;\s])max-width:\s*420px/.test(r.body))
    .flatMap(selsOf).filter((s) => s.startsWith(".mk-band")).sort();
  eq("Z10-A the 420px cap is carried by exactly these band selectors, at top level",
    JSON.stringify(capped), JSON.stringify([".mk-band", ".mk-band-dotwrap"]));

  // The track's ancestors AS THE PAGE EMITS THEM, not as the stylesheet hopes. "two" is the
  // real renderer's output, so this reads the nesting that actually ships.
  const ancestorsOfTrack = (h) => {
    const stack = []; const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g; let m;
    while ((m = re.exec(h))) {
      const close = m[1], attrs = m[3];
      if (close) { stack.pop(); continue; }
      if (/\/\s*$/.test(attrs)) continue;
      const cls = ((attrs.match(/class="([^"]*)"/) || ["", ""])[1]).split(/\s+/).filter(Boolean);
      if (cls.includes("mk-band-track")) return stack.flat();
      stack.push(cls);
    }
    return null;
  };
  const anc = ancestorsOfTrack(two);
  ok("ancestor-walk control: the walker finds the track, and it really does have an ancestor",
    Array.isArray(anc) && anc.length > 0);
  ok("ancestor-walk control: and that ancestor is the band wrapper", (anc || []).includes("mk-band"));
  ok("ancestor-walk impossible control: it reports nothing for markup holding no track",
    ancestorsOfTrack('<div class="mk-band"><span class="mk-band-dot"></span></div>') === null);
  ok("ancestor-walk control: a SIBLING of the track is not reported as an ancestor",
    !(anc || []).includes("mk-band-dotwrap"));

  // Z10-B. THE ONE THAT SEPARATES "capped" FROM "a declaration naming 420px exists somewhere".
  ok("Z10-B the capped selector is an ANCESTOR of the track in the emitted markup",
    capped.some((s) => (anc || []).includes(s.replace(/^\./, ""))));

  // Z10-C. The track declares no width of its own, so it fills that content box and cannot
  // be re-widened by its own rule.
  const trackRules = cssRules.filter((r) => selsOf(r).includes(".mk-band-track"));
  eq("Z10-C .mk-band-track is declared exactly once in the sheet", trackRules.length, 1);
  ok("Z10-C and that rule sets no width, max-width or min-width of its own",
    !setsWidth(trackRules[0].body));

  // Z10-D. Nothing anywhere else re-declares a width on either element.
  const widthDecls = cssRules.filter((r) => {
    const s = selsOf(r);
    return (s.includes(".mk-band") || s.includes(".mk-band-track")) && setsWidth(r.body);
  });
  eq("Z10-D exactly one rule in the whole sheet sets a width on .mk-band or .mk-band-track",
    widthDecls.length, 1);
  eq("Z10-D and it is .mk-band's cap, the one Z10-B proved the track inherits from",
    (widthDecls[0] || { sel: "(no rule sets a width on either)" }).sel.trim(), ".mk-band");
}
ok("the dot is 15px, offset by half that, ringed in the card colour and shadowed",
  /\.mk-band-dot\{[^}]*width:15px/.test(RAW) && /\.mk-band-dot\{[^}]*margin-left:-7\.5px/.test(RAW) &&
  /\.mk-band-dot\{[^}]*border:3px solid var\(--white\)/.test(RAW) &&
  /\.mk-band-dot\{[^}]*box-shadow:0 0 0 1px rgba\(71,55,43,\.28\)/.test(RAW));
ok("css-matcher control: the same matcher does NOT find a size the dot is not",
  !/\.mk-band-dot\{[^}]*width:9px/.test(RAW));

// ---------------------------------------------------------------------------------------
// W2 — THE CLAMPED DOT NO LONGER OVERHANGS THE TRACK.
//
// THERE ARE TWO CLAMPS AND THEY DO DIFFERENT JOBS. The JS clamp in markerBandGeometry holds
// g.dot in [2,98] and is UNCHANGED by this work; it is what g.zone, the note and the
// consistency rule are all keyed on, and moving it would move a verdict. The new one is
// physical and lives in the emitted style.
//
// WHY IT CANNOT BE A PERCENTAGE. The dot is 15px on a track whose width is capped at 420px
// but not fixed at it: a phone card renders it at about 260px. At the 2% floor the dot's
// centre sits 2% along, so its 7.5px radius hangs past the rounded end whenever the track is
// narrower than 375px. A percentage inset is computed before the track has a width, so it is
// right at one width and wrong at every other. calc() is evaluated at layout, so 100% inside
// it is the width the track actually got.
//
// IT BINDS ONLY WHERE IT IS NEEDED. Above a 375px track the 2% floor already clears the
// radius, so the dot does not move and the clamp costs nothing.
//
// MEASURED with a layout engine on 2026-09-19, clearance at the floor and at the ceiling,
// before -> after, symmetric at both ends:
//     675px  +6.00 -> +6.00       420px  +0.90 -> +0.90       375px   0.00 ->  0.00
//     320px  -1.10 ->  0.00       260px  -2.30 ->  0.00
// No negative clearance at any width. The two left columns are unchanged BY DESIGN: a
// clamp that moved the dot where it was already on the track would be moving a position
// the geometry chose.
//
// THESE ASSERTIONS ARE TEXT ON AN EMITTED ATTRIBUTE, NOT A RESOLVED POSITION. The suite has
// no DOM. They pin the expression that produces that clearance; they do not observe it.
ok("W2 the dot's low bound is its own radius, derived from the named constant",
  /style="left:clamp\(calc\(var\(--band-dot-d\)\/2\),/.test(two));
ok("W2 the dot's high bound is that same radius in from the far end",
  /,calc\(100% - var\(--band-dot-d\)\/2\)\)"/.test(two));
ok("W2 control: the pre-clamp bare-percentage form is gone from the emitted dot",
  !/class="mk-band-dot" style="left:[0-9.]+%"/.test(two));
eq("W2 the position inside the clamp is still g.dot, unmoved", dotOf(two), "41.4");
eq("W2 the JS clamp is UNCHANGED at the floor", dotOf(markerBandHTML(F, -1e6)), "2.0");
eq("W2 and UNCHANGED at the ceiling", dotOf(markerBandHTML(F, 1e6)), "98.0");

// THE TOKEN AND THE DOT'S OWN WIDTH ARE ONE NUMBER, or the clamp insets by a radius the dot
// does not have. They are declared separately -- the rule restates 15px because the suite
// matches those literals -- so this is the assertion that stops them drifting.
{
  const tok = RAW.match(/--band-dot-d:\s*([0-9.]+)px/);
  const wid = RAW.match(/\.mk-band-dot\{[^}]*width:\s*([0-9.]+)px/);
  const half = RAW.match(/\.mk-band-dot\{[^}]*margin-left:-([0-9.]+)px/);
  ok("W2 --band-dot-d is declared", !!tok);
  ok("W2 and it equals the dot's own width, so the clamp insets by a real radius",
    !!tok && !!wid && tok[1] === wid[1]);
  ok("W2 drift control: those are two different declarations, not one matched twice",
    !!tok && !!wid && RAW.indexOf(tok[0]) !== RAW.indexOf(wid[0]));
  ok("W2 and the dot's centring offset is half that diameter, so left: is its CENTRE",
    !!half && !!tok && Number(half[1]) === Number(tok[1]) / 2);
}

// THE ZONE EDGES GET NO CLAMP AND NO INSET. Moving a boundary is a claim about where a range
// is; this is only ever about keeping a 15px circle on a 9px rail.
eq("W2 no zone carries a clamp", (two.match(/mk-band-zone[^>]*clamp\(/g) || []).length, 0);
eq("W2 no numbered end carries a clamp", (two.match(/mk-band-end"[^>]*clamp\(/g) || []).length, 0);
eq("W2 exactly one element in the whole band carries a clamp",
  (two.match(/clamp\(/g) || []).length, 1);
ok("W2 clamp control: and that one element is the dot",
  /mk-band-dot[^>]*clamp\(/.test(two));
eq("W2 the zone edges are still at the unmoved boundaries",
  JSON.stringify(segsOf(two).map((z) => z.left)), JSON.stringify([0, 13.8, 27.6, 55.2, 82.8]));
ok("W2 zone control: a clamped dot still leaves every zone exactly where it was",
  JSON.stringify(segsOf(markerBandHTML(F, -1e6))) === JSON.stringify(segsOf(two)));

// THE PALETTE, EXACT. Two of the eight already existed as tokens and are reused rather than
// duplicated: --brown is the dot's ink and --white is the ring.
for (const [name, hex] of [["--band-track", "#EFE9E1"], ["--band-green", "#9CCFB8"],
  ["--band-green-ink", "#0A6B51"], ["--band-amber", "#EFD49A"], ["--band-amber-ink", "#8A6520"],
  ["--band-coral", "#E8B4A2"], ["--band-coral-ink", "#9C4A32"]]) {
  ok("palette: " + name + " is " + hex, RAW.includes(name + ":" + hex));
}
ok("the dot reuses the EXISTING --brown token, which already holds #47372B",
  /--brown:#47372B/.test(RAW) && /\.mk-band-dot\{[^}]*background:var\(--brown\)/.test(RAW));
ok("palette control: a hex that is NOT in the ratified palette is absent",
  !RAW.includes("--band-green:#B8E4D4"));
eq("no second palette: each band token is declared exactly once",
  (RAW.match(/--band-green:#/g) || []).length, 1);

// THE ZONE NOTE, one line beneath each track, in that zone's ink. Ruled copy, verbatim.
const noteOf = (h) => { const m = h.match(/<div class="mk-band-note ([^"]*)">([^<]*)<\/div>/); return m ? [m[1], m[2]] : null; };
ok("note control: the fixture band carries exactly one note",
  (two.match(/mk-band-note/g) || []).length === 1);
eq("green: the dot inside the functional range",
  JSON.stringify(noteOf(markerBandHTML(F, 15))),
  JSON.stringify(["mk-note-green", "In the functional range"]));
eq("amber low: inside the wider range, below the functional one",
  JSON.stringify(noteOf(markerBandHTML(F, 7))),
  JSON.stringify(["mk-note-amber", "In the wider reference range, below the functional range"]));
eq("amber high: inside the wider range, above the functional one",
  JSON.stringify(noteOf(markerBandHTML(F, 25))),
  JSON.stringify(["mk-note-amber", "In the wider reference range, above the functional range"]));
eq("coral low, not clamped",
  JSON.stringify(noteOf(markerBandHTML(F, 2))),
  JSON.stringify(["mk-note-coral", "Outside both"]));
eq("coral high, not clamped",
  JSON.stringify(noteOf(markerBandHTML(F, 34))),
  JSON.stringify(["mk-note-coral", "Outside both"]));
eq("coral and clamped: at the edge of the axis",
  JSON.stringify(noteOf(markerBandHTML(F, -1e6))),
  JSON.stringify(["mk-note-coral", "Outside both, at the edge of the axis"]));
eq("clamp-note control: the same zone unclamped does NOT say edge of the axis",
  noteOf(markerBandHTML(F, 2))[1].includes("edge of the axis"), false);
// The note and the consistency rule read the same comparison, so they cannot disagree.
for (const v of [2, 7, 15, 25, 34, -1e6, 1e6]) {
  const inGreenNote = noteOf(markerBandHTML(F, v))[1] === "In the functional range";
  eq("note and consistency rule agree at value " + v,
    inGreenNote, bandContradictsEngine(F, v, "optimal") === false);
}

// NO COLONS, AMERICAN SPELLING, AND "YOUR LAB" NOWHERE. These are our library's conventional
// reference range, not the interval printed on her report, and the two differ.
{
  const allCopy = [two, markerBandHTML(F, 7), markerBandHTML(F, 25), markerBandHTML(F, 2),
                   markerBandHTML(F, -1e6), BAND_LEGEND_HTML].join(" ");
  ok("no colon in any zone note or legend item",
    !/<div class="mk-band-note [^"]*">[^<]*:/.test(allCopy) &&
    !/<span class="mk-lg [^"]*">(?:<span[^>]*><\/span>)?[^<]*:/.test(allCopy));
  ok("the string 'your lab' appears nowhere in the band, the legend or any note",
    !allCopy.toLowerCase().includes("your lab"));
  ok("your-lab control: the scanner DOES fire on a planted instance",
    (allCopy + " your lab").toLowerCase().includes("your lab"));
  ok("colon control: the note matcher DOES fire on a planted colon",
    /<div class="mk-band-note [^"]*">[^<]*:/.test(
      '<div class="mk-band-note mk-note-green">Status: in the functional range</div>'));
  ok("colon control: the legend matcher DOES fire on a planted colon",
    /<span class="mk-lg [^"]*">(?:<span[^>]*><\/span>)?[^<]*:/.test(
      '<span class="mk-lg mk-lg-green"><span class="mk-sw"></span>Range: functional</span>'));
  ok("British -ise spellings absent from the ruled copy",
    !/\b\w+ised\b|\bcolour\b|\bcentre\b/.test(
      allCopy.replace(/<[^>]*>/g, " ")));
  ok("spelling control: the same matcher DOES fire on a planted British spelling",
    /\b\w+ised\b|\bcolour\b|\bcentre\b/.test("the colour of the centre"));
}

// THE LEGEND, ONCE PER CARD, NEVER PER ROW.
ok("the legend carries the three ruled items, in order",
  BAND_LEGEND_HTML.indexOf("Functional range") < BAND_LEGEND_HTML.indexOf("Wider reference range") &&
  BAND_LEGEND_HTML.indexOf("Wider reference range") < BAND_LEGEND_HTML.indexOf("Outside both"));
eq("and exactly three of them", (BAND_LEGEND_HTML.match(/class="mk-lg /g) || []).length, 3);
{
  // A card with THREE marker rows, all drawing a Tier 1 band.
  const many = new Function(
    "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
    "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
    "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL", "prioArtSVG",
    "markerBandGeometry", "BAND_LEGEND_HTML", "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    { m1: "metabolic", m2: "metabolic", m3: "metabolic" }, { m1: 7, m2: 25, m3: 2 },
    () => F, healthyRangeText, markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL, prioArtSVG,
    markerBandGeometry, BAND_LEGEND_HTML);
  const card = many({ rank: 1, headline: "H", why_this_matters: "W", primary_markers: [
    { marker_id: "m1", display_name: "One", band: "low" },
    { marker_id: "m2", display_name: "Two", band: "high" },
    { marker_id: "m3", display_name: "Three", band: "low" }] }, 0);
  eq("row control: the card really drew three bands", (card.match(/class="mk-band"/g) || []).length, 3);
  eq("the legend appears ONCE on a three-row card", (card.match(/class="mk-band-legend"/g) || []).length, 1);
  ok("and it sits ABOVE the first row, not between rows",
    card.indexOf("mk-band-legend") < card.indexOf("mk-band\" aria-hidden"));
  eq("each row still carries its own note", (card.match(/class="mk-band-note/g) || []).length, 3);
  // A card whose markers draw NO Tier 1 band gets no legend: there is no amber and no coral to
  // explain, and naming two regions that are not on screen is a claim about data it does not have.
  const none = new Function(
    "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
    "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
    "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL", "prioArtSVG",
    "markerBandGeometry", "BAND_LEGEND_HTML", "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    { m1: "metabolic" }, { m1: 7 }, () => ({ low: 10, high: null }), healthyRangeText,
    markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL, prioArtSVG, markerBandGeometry, BAND_LEGEND_HTML)(
    { rank: 1, headline: "H", why_this_matters: "W",
      primary_markers: [{ marker_id: "m1", display_name: "One", band: "low" }] }, 0);
  eq("no-band control: that card drew no band at all", (none.match(/class="mk-band"/g) || []).length, 0);
  eq("and therefore no legend", (none.match(/class="mk-band-legend"/g) || []).length, 0);
}

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
