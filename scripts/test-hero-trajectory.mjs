#!/usr/bin/env node
// HERO_TRAJ_V1 -- heroTrajectoryModel, extracted from dashboard.html so the suite exercises
// shipped source rather than a copy that can drift. Same technique as test-dob-gate.mjs.
//
// THE LOAD-BEARING PROPERTY is the safety gate. A heavy-metals, autoimmune or tumour-marker
// line must never reach the plot, by marker id OR by system id, and a faint grey line is still
// a rendered line. The second is the cycle gate: an estradiol read on day 3 and one on day 21
// are not the same measurement, so a line between them would invent a trend out of the calendar.
//
// The SENSITIVE_* sets are extracted from dashboard.html too, never retyped here. A copy in this
// file would pass while the shipped set was wrong, which is the one failure this test exists to
// catch. They are also why the model fails closed: it throws if they are missing.
//
//   node scripts/test-hero-trajectory.mjs        (or DASH=path/to/dashboard.html)
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

// Single-line `const NAME = ...;` declarations. Both sets are written on one line today and the
// regex asserts that rather than assuming it: a multi-line rewrite fails here instead of silently
// loading half a set.
function extractConst(name) {
  const re = new RegExp("^const\\s+" + name + "\\s*=.*;\\s*$", "m");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a one-line const in " + FILE + ": " + name);
  return m[0];
}

const src = extractConst("SENSITIVE_MARKER_IDS") + "\n" +
            extractConst("SENSITIVE_SYSTEMS") + "\n" +
            extract("esc") + "\n" +
            extract("heroTrajectoryModel") + "\n" +
            extract("heroTrajectorySVG") +
            "\n;globalThis.__model = heroTrajectoryModel;" +
            "\n;globalThis.__svg = heroTrajectorySVG;" +
            "\n;globalThis.__SENS_MK = SENSITIVE_MARKER_IDS;" +
            "\n;globalThis.__SENS_SYS = SENSITIVE_SYSTEMS;";
new Function(src)();
const model = globalThis.__model, draw = globalThis.__svg;
const SENS_MK = globalThis.__SENS_MK, SENS_SYS = globalThis.__SENS_SYS;

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

const D1 = "2026-03-05", D2 = "2026-06-05", D3 = "2026-08-05";
// One marker, values in panel order. unit and cycleGated default to comparable and ungated.
const mk = (sys, vals, dates, opt) => {
  const o = opt || {};
  return {
    system_id: sys,
    display_name: o.name || null,
    points: vals.map((v, i) => ({
      value: v,
      date: (dates || [D1, D3])[i],
      unit: Array.isArray(o.unit) ? o.unit[i] : (o.unit === undefined ? "ng/mL" : o.unit),
      cycleGated: Array.isArray(o.gated) ? o.gated[i] : !!o.gated
    }))
  };
};
const ids = (r) => r.highlights.map(h => h.id).concat(r.faint.map(f => f.id));

console.log("SAFETY GATE -- marker id, system id, and both at once");
{
  const r = model({
    ferritin:  mk("iron", [10, 12]),
    lead:      mk("heavy_metals", [1, 4]),          // both gates
    ana:       mk("immune", [1, 3]),                // marker-id gate only
    cea:       mk(null, [2, 6]),                    // marker-id gate, no system given
    innocuous: mk("tumor_markers", [5, 9]),         // system gate only, id is not listed
  }, []);
  ok(ids(r).includes("ferritin"), "SENS-1: an ordinary marker IS drawn, so the gate is not eating everything");
  ok(!ids(r).includes("lead"), "SENS-2: lead is excluded (marker id and heavy_metals system)");
  ok(!ids(r).includes("ana"), "SENS-3: ana is excluded by marker id even under a benign system_id");
  ok(!ids(r).includes("cea"), "SENS-4: cea is excluded by marker id with no system_id at all");
  ok(!ids(r).includes("innocuous"), "SENS-5: an unlisted id under tumor_markers is excluded by system");
  eq(ids(r).length, 1, "SENS-6: exactly one of the five survives");
}
{
  // Faint is still rendered, so a sensitive marker must not reach it either.
  const r = model({ lead: mk("heavy_metals", [1, 9]), ferritin: mk("iron", [10, 11]) }, ["ferritin"]);
  ok(r.faint.every(f => !SENS_MK.has(f.id)), "SENS-7: no safety-class marker in the faint set");
  ok(r.highlights.every(h => !SENS_MK.has(h.id)), "SENS-8: nor in the highlights");
}
ok(SENS_MK.has("lead") && SENS_MK.has("ana") && SENS_MK.has("cea"),
   "SENS-9: the extracted marker set is the real one, not an empty stand-in");
ok(SENS_SYS.has("heavy_metals") && SENS_SYS.has("autoimmune") && SENS_SYS.has("tumor_markers"),
   "SENS-10: and the extracted system set carries all three classes");

console.log("CYCLE GATE -- a gated point is dropped, not plotted");
{
  // Three panels, the middle one gated: two plottable points remain, so the line is still
  // drawn and the gated panel is simply not on it.
  const r = model({
    estradiol: mk("sex_hormones", [40, 90, 60], [D1, D2, D3], { gated: [false, true, false] }),
    ferritin:  mk("iron", [10, 12]),
  }, []);
  const e = r.faint.find(f => f.id === "estradiol");
  ok(!!e, "CYCLE-1: the marker survives when a middle point is gated");
  eq(e.points.length, 2, "CYCLE-2: and the gated point is gone from the line");
  ok(e.points.every(pt => pt.date !== D2), "CYCLE-3: specifically the gated panel's date");
  eq(r.mode, "multi", "CYCLE-4: two dated points left, so the strip stays multi-panel");
}
{
  // Two panels with one gated leaves a single point, which is not a line. It drops out of a
  // multi-panel plot rather than being drawn as a lone dot pretending to be a trend.
  const r = model({
    estradiol: mk("sex_hormones", [40, 90], [D1, D3], { gated: [false, true] }),
    ferritin:  mk("iron", [10, 12]),
  }, []);
  ok(!ids(r).includes("estradiol"), "CYCLE-5: gated down to one point, the marker is not plotted");
  ok(ids(r).includes("ferritin"), "CYCLE-6: and the marker beside it still is");
}
{
  const r = model({ estradiol: mk("sex_hormones", [40, 90], [D1, D3], { gated: true }) }, []);
  eq(r.mode, "none", "CYCLE-7: a marker whose every point is gated leaves nothing to draw");
  eq(ids(r).length, 0, "CYCLE-8: and it appears nowhere");
}

console.log("UNIT MISMATCH -- the whole marker is skipped");
{
  const r = model({
    b12:      mk("vitamins", [300, 600], [D1, D3], { unit: ["pg/mL", "pmol/L"] }),
    ferritin: mk("iron", [10, 12]),
  }, []);
  ok(!ids(r).includes("b12"), "UNIT-1: a canonical_unit change skips the marker entirely");
  ok(ids(r).includes("ferritin"), "UNIT-2: the comparable marker beside it is unaffected");
}
{
  const r = model({ b12: mk("vitamins", [300, 600], [D1, D3], { unit: ["pg/mL", "pg/mL"] }) }, []);
  ok(ids(r).includes("b12"), "UNIT-3: the same marker IS drawn when the unit holds, so UNIT-1 is not vacuous");
}

console.log("PERCENT -- from each marker's own earliest point, clamped to plus or minus 50");
{
  const r = model({
    rocket: mk("iron", [10, 100]),      // +900
    sink:   mk("iron", [100, 5]),       // -95
    small:  mk("iron", [100, 110]),     // +10
    flat:   mk("iron", [50, 50]),       // 0
  }, ["rocket", "sink", "small"]);
  const by = {};
  r.highlights.concat(r.faint).forEach(m => { by[m.id] = m.points[m.points.length - 1].pct; });
  eq(by.rocket, 50, "CLAMP-1: +900 percent clamps to +50");
  eq(by.sink, -50, "CLAMP-2: -95 percent clamps to -50");
  eq(by.small, 10, "CLAMP-3: a small move is untouched, so the clamp is not flattening everything");
  eq(by.flat, 0, "CLAMP-4: no change is zero, the centre line");
  eq(r.highlights[0].points[0].pct, 0, "CLAMP-5: every marker starts at zero, its own baseline");
}
{
  const r = model({ zero: mk("iron", [0, 5]) }, []);
  eq(r.mode, "none", "CLAMP-6: a zero baseline has no percent change and is skipped, never Infinity");
}

console.log("SINGLE PANEL -- detection and caption");
{
  const one = { points: [{ value: 10, date: D1, unit: "ng/mL", cycleGated: false }], system_id: "iron" };
  const r = model({ ferritin: one, vitamin_d: { system_id: "vitamins", points: one.points.slice() } }, ["ferritin"]);
  eq(r.mode, "single", "SINGLE-1: no marker with two dated points is the single-panel state");
  eq(r.caption, "One panel is a snapshot. Your next one turns every dot into a line.",
     "SINGLE-2: single-panel caption is exact");
  eq(r.highlights.length, 1, "SINGLE-3: priorities are still highlighted");
  ok(!r.caption.includes(":"), "SINGLE-4: no colon in the caption");
}
{
  const r = model({ ferritin: mk("iron", [10, 12]) }, []);
  eq(r.mode, "multi", "MULTI-1: two dated points is the multi-panel state");
  eq(r.caption, "Each line is one marker. Height shows how far it moved since March, not whether that is good.",
     "MULTI-2: multi-panel caption is exact, naming the first panel month");
  ok(!r.caption.includes(":"), "MULTI-3: no colon in the caption");
  ok(!r.caption.includes("—"), "MULTI-4: and no em dash");
}

console.log("CAPS -- 3 highlighted, 12 faint, priority order");
{
  const s = {}, prio = [];
  for (let i = 0; i < 20; i++) {
    const id = "m" + i;
    s[id] = mk("iron", [100, 100 + i + 1]);   // each one moves a little more than the last
    if (i < 5) prio.push(id);
  }
  const r = model(s, prio);
  eq(r.highlights.length, 3, "CAP-1: at most 3 highlighted");
  eq(r.faint.length, 12, "CAP-2: at most 12 faint");
  eq(r.highlights.map(h => h.id).join(","), "m0,m1,m2", "CAP-3: highlights follow priority order");
  eq(r.highlights[0].color, "var(--coral-dark)", "CAP-4: first priority is coral-dark");
  eq(r.highlights[1].color, "var(--amber-deep)", "CAP-5: second is amber-deep, the 3:1 token");
  eq(r.highlights[2].color, "var(--teal-dark)", "CAP-6: third is teal-dark");
  ok(r.faint.every(f => !r.highlights.some(h => h.id === f.id)), "CAP-7: no marker is both");
  eq(r.faint[0].id, "m19", "CAP-8: faint is ranked by largest absolute percent change");
  ok(Math.abs(r.faint[0].lastPct) >= Math.abs(r.faint[11].lastPct), "CAP-9: and ordered descending");
}
{
  const r = model({ a: mk("iron", [10, 12]) }, ["nope", "a"]);
  eq(r.highlights.length, 1, "CAP-10: a priority id with no drawable marker is skipped, not rendered empty");
  eq(r.highlights[0].id, "a", "CAP-11: and the next priority still gets highlighted");
}

console.log("Y IS DISTANCE, NEVER A VERDICT");
{
  const r = model({ ferritin: mk("iron", [10, 12]) }, ["ferritin"]);
  const keys = Object.keys(r.highlights[0].points[0]).sort().join(",");
  eq(keys, "date,pct", "AXIS-1: a plotted point carries only a date and a percent, no band or status");
}

// ── GEOMETRY. heroTrajectorySVG derives every x from the width it is handed, so the
// viewBox width IS the rendered width and 11px text is 11px at every size. A coordinate
// outside [0, W] is a mark drawn off the well, which at 390 is most of the plot.
console.log("WIDTH-DERIVED GEOMETRY -- nothing is drawn outside the width");
const wide = () => {
  const s = {}, prio = [];
  for (let i = 0; i < 20; i++) {
    const id = "m" + i;
    s[id] = mk("iron", [100, 100 + i + 1], [D1, D3], { name: "Marker " + i });
    if (i < 3) prio.push(id);
  }
  return { series: s, prio };
};
// Every x-bearing attribute in the output, plus both coordinates of every polyline point.
function xsOf(svg) {
  const xs = [];
  for (const m of svg.matchAll(/\b(?:x|x1|x2|cx)="(-?[\d.]+)"/g)) xs.push(parseFloat(m[1]));
  for (const m of svg.matchAll(/points="([^"]+)"/g))
    for (const pair of m[1].trim().split(/\s+/)) xs.push(parseFloat(pair.split(",")[0]));
  return xs;
}
const labelYs = (svg) =>
  [...svg.matchAll(/<text class="ht-label"[^>]*\by="([\d.]+)"/g)].map(m => parseFloat(m[1]));

for (const W of [300, 390, 680]) {
  const { series, prio } = wide();
  const r = model(series, prio);
  const svg = draw(r, W);
  const xs = xsOf(svg);
  ok(xs.length > 0, "GEO-" + W + "-1: the plot emitted x coordinates at all");
  ok(xs.every(x => x >= 0 && x <= W),
     "GEO-" + W + "-2: every x is inside the width  (min " + Math.min(...xs) + ", max " + Math.max(...xs) + ", W " + W + ")");
  ok(svg.includes('viewBox="0 0 ' + W + ' 136"'),
     "GEO-" + W + "-3: the viewBox width is the width handed in, so text is not scaled");
}
{
  // The floor and the default. The default exists because clientWidth is 0 while the
  // dashboard view is still hidden at first render. The floor is 200 rather than 300
  // because the real well at a 390px viewport is 218px wide, and a floor above that
  // would scale the viewBox down and shrink the text again.
  const { series, prio } = wide();
  const r = model(series, prio);
  ok(draw(r, 120).includes('viewBox="0 0 200 136"'), "GEO-4: a width under the floor clamps up to 200");
  ok(draw(r, 218).includes('viewBox="0 0 218 136"'), "GEO-5: a real 390px-phone well is drawn at its own width, not scaled");
  ok(draw(r, 0).includes('viewBox="0 0 680 136"'), "GEO-6: width 0, the hidden-view case, defaults to 680");
}

console.log("MOBILE -- the faint set halves under 480");
{
  const { series, prio } = wide();
  const r = model(series, prio);
  eq(r.faint.length, 12, "MOB-1: the model still offers 12, so the cap is the drawing's call");
  const count = (svg) => (svg.match(/class="ht-faint"/g) || []).length;
  eq(count(draw(r, 390)), 6, "MOB-2: at 390 wide only 6 faint lines are drawn");
  eq(count(draw(r, 479)), 6, "MOB-3: 479 is still narrow");
  eq(count(draw(r, 480)), 12, "MOB-4: 480 is not, so the cap has a real boundary");
  eq(count(draw(r, 680)), 12, "MOB-5: and a wide well draws all 12");
}

console.log("LABELS -- 16px apart at the narrowest width");
{
  const { series, prio } = wide();
  const ys = labelYs(draw(model(series, prio), 300));
  eq(ys.length, 3, "LBL-1: three highlights are labelled at 300 wide");
  const sorted = ys.slice().sort((a, b) => a - b);
  let minGap = Infinity;
  for (let i = 1; i < sorted.length; i++) minGap = Math.min(minGap, sorted[i] - sorted[i - 1]);
  ok(minGap >= 15.99, "LBL-2: the closest pair is at least 16px apart  (got " + minGap + ")");
  ok(ys.join(",") === sorted.join(","), "LBL-3: labels are emitted top to bottom, so spacing pushes against the one above");
}
{
  // The spacing pass is MULTI-PANEL ONLY. In the first-panel well every label shares its own
  // row's y, so a pass that pushed labels apart would drag a name off the row it names.
  const one = (n) => ({ system_id: "iron", display_name: n,
                        points: [{ value: 10, date: D1, unit: "ng/mL", cycleGated: false }] });
  const s = {}; const prio = [];
  for (let i = 0; i < 9; i++) { s["s" + i] = one("Marker " + i); if (i < 3) prio.push("s" + i); }
  const r = model(s, prio);
  eq(r.mode, "single", "LBL-4: nine single-point markers is the single-panel state");
  const svg = draw(r, 630);
  eq(labelYs(svg).length, 0, "LBL-5: the multi-panel .ht-label is not used in the first-panel well");
}

// ── FIRST-PANEL WELL, the approved mock. Rows, not a plot: no axis, no faint marks, and a
// label that belongs to exactly one row.
console.log("FIRST-PANEL WELL -- rows, no faint marks, label on its row");
const slabels = (svg) =>
  [...svg.matchAll(/<text class="ht-slabel"[^>]*\bx="([\d.]+)"[^>]*\by="([\d.]+)"/g)]
    .map(m => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }));
const dots = (svg) =>
  [...svg.matchAll(/<circle class="ht-end"[^>]*\bcx="([\d.]+)"[^>]*\bcy="([\d.]+)"/g)]
    .map(m => ({ x: parseFloat(m[1]), y: parseFloat(m[2]) }));
const vbH = (svg) => parseFloat(/viewBox="0 0 [\d.]+ ([\d.]+)"/.exec(svg)[1]);
const singleSeries = (names) => {
  const s = {}, prio = [];
  names.forEach((n, i) => {
    s["m" + i] = { system_id: "iron", display_name: n,
                   points: [{ value: 10 + i, date: D1, unit: "ng/mL", cycleGated: false }] };
    prio.push("m" + i);
  });
  // Extra unhighlighted markers, which in the old drawing became faint dots.
  for (let i = 0; i < 9; i++)
    s["x" + i] = { system_id: "iron", display_name: "Other " + i,
                   points: [{ value: 5 + i, date: D1, unit: "ng/mL", cycleGated: false }] };
  return { series: s, prio };
};
{
  const { series, prio } = singleSeries(["Ferritin", "Vitamin D", "TSH"]);
  const r = model(series, prio);
  eq(r.mode, "single", "FPW-1: the fixture is the single-panel state");
  ok(r.faint.length > 0, "FPW-2: and the model still offers faint markers, so the drawing is what drops them");
  const svg = draw(r, 630);
  eq((svg.match(/class="ht-faint"/g) || []).length, 0, "FPW-3: no faint lines are drawn");
  eq((svg.match(/fill="rgba\(71,55,43,\.28\)"/g) || []).length, 0, "FPW-4: and no faint dots either");
  eq(dots(svg).length, 3, "FPW-5: exactly one dot per highlight");
  eq(slabels(svg).length, 3, "FPW-6: exactly one label per highlight");
  eq((svg.match(/class="ht-ring"/g) || []).length, 3, "FPW-7: one empty next-panel ring per row");
  eq((svg.match(/class="ht-wait"/g) || []).length, 3, "FPW-8: one dashed wait line per row");
  eq((svg.match(/class="ht-axis"/g) || []).length, 0, "FPW-9: no centre line, because there is no change to measure");
  const ls = slabels(svg), ds = dots(svg);
  ls.forEach((l, i) => eq(l.y - 4, ds[i].y, "FPW-10." + i + ": label " + i + " shares its dot's row (baseline is +4)"));
  ok(ds.every(d => Math.abs(d.x - Math.round(630 * 0.42)) < 1), "FPW-11: dots sit at about 42 percent of the width");
  ok(svg.includes(">today<") && svg.includes(">next<"), "FPW-12: both ticks are present");
  ok(!/…/.test(svg), "FPW-13: no name is truncated at 630 wide");
}
{
  // Under 480 the name takes its own line 12px above the row, and the dot moves to x 26.
  const { series, prio } = singleSeries(["Ferritin", "Vitamin D", "TSH"]);
  const svg = draw(model(series, prio), 390);
  const ls = slabels(svg), ds = dots(svg);
  eq(ls.length, 3, "FPW-14: three labels at 390 too");
  ls.forEach((l, i) => eq(l.y - 4, ds[i].y - 12, "FPW-15." + i + ": label " + i + " sits 12px above its row"));
  ok(ds.every(d => d.x === 26), "FPW-16: the dot moves to x 26 on a phone");
  ok(!/…/.test(svg), "FPW-17: and still nothing is truncated");
}
{
  // Height follows the rows rather than the old fixed 136.
  const h1 = vbH(draw(model(singleSeries(["Ferritin"]).series, ["m0"]), 630));
  const h2 = vbH(draw(model(singleSeries(["Ferritin", "Vitamin D"]).series, ["m0", "m1"]), 630));
  const h3 = vbH(draw(model(singleSeries(["Ferritin", "Vitamin D", "TSH"]).series, ["m0", "m1", "m2"]), 630));
  eq(h2 - h1, 34, "FPW-18: a second row adds exactly one 34px row");
  eq(h3 - h2, 34, "FPW-19: and so does a third");
  ok(h3 !== 136, "FPW-20: the well is no longer the fixed 136 of the multi-panel plot  (got " + h3 + ")");
  const m3 = draw(model(singleSeries(["Ferritin", "Vitamin D", "TSH"]).series, ["m0", "m1", "m2"]), 390);
  ok(vbH(m3) > h3, "FPW-21: the phone well is taller, because the labels take their own lines");
}

console.log("HIGHLIGHTS -- one marker per priority, in payload order");
{
  // Three priorities, the first carrying three primary markers. Flat-listing them let the
  // first priority take all three highlight slots and silenced priorities two and three.
  const s = {};
  for (const id of ["a1", "a2", "a3", "b1", "c1"])
    s[id] = mk("iron", [100, 120], [D1, D3], { name: id.toUpperCase() });
  const r = model(s, [["a1", "a2", "a3"], ["b1"], ["c1"]]);
  eq(r.highlights.map(h => h.id).join(","), "a1,b1,c1",
     "PRIO-1: one marker from each priority, in payload order");
  ok(r.faint.some(f => f.id === "a2") && r.faint.some(f => f.id === "a3"),
     "PRIO-2: the priority's other markers fall to the faint set rather than vanishing");
}
{
  // Only when a priority yields nothing do the leftovers fill the remaining slots.
  const s = { a2: mk("iron", [100, 120], [D1, D3]), b1: mk("iron", [100, 90], [D1, D3]) };
  const r = model(s, [["missing", "a2"], ["b1"]]);
  eq(r.highlights.map(h => h.id).join(","), "a2,b1",
     "PRIO-3: a priority whose first marker was excluded contributes its second");
}
{
  const s = { a1: mk("iron", [100, 120], [D1, D3]), a2: mk("iron", [100, 130], [D1, D3]),
              a3: mk("iron", [100, 140], [D1, D3]) };
  const r = model(s, [["a1", "a2", "a3"]]);
  eq(r.highlights.map(h => h.id).join(","), "a1,a2,a3",
     "PRIO-4: with one priority and slots to spare, its leftovers DO fill them");
}
{
  const r = model({ a1: mk("iron", [100, 120], [D1, D3]) }, ["a1"]);
  eq(r.highlights.length, 1, "PRIO-5: a flat list of ids still works, so the old shape is not broken");
}

console.log("SWATCH -- colour lives on the stroke, the name is brown");
{
  const { series, prio } = wide();
  const svg = draw(model(series, prio), 680);
  eq((svg.match(/class="ht-swatch"/g) || []).length, 3, "SWATCH-1: one swatch per highlighted marker");
  ok(/class="ht-swatch"[^>]*stroke="var\(--coral-dark\)"/.test(svg), "SWATCH-2: the first swatch carries the first colour");
  ok(!/<text class="ht-label"[^>]*fill="var\(--/.test(svg), "SWATCH-3: no label text carries a colour fill, so CSS keeps it brown");
}

// ── THE PANEL-COUNT GUARD. renderHeroTrajectory needs a DOM, so it is loaded separately with
// a stub host. The guard exists because the single-panel caption is a factual claim about how
// many panels she has, and the model infers that from DATED POINTS, not from panels.
console.log("PANEL-COUNT GUARD -- two panels must never see the one-panel caption");
{
  const lets = (HTML.match(/^let HERO_TRAJ_\w+ = [^\n]*$/gm) || []).join("\n");
  ok(lets.includes("HERO_TRAJ_DRAWN"), "GUARD-0: the module state was extracted, not assumed");
  const host = {
    innerHTML: "", classes: new Set(["hidden"]), clientWidth: 630,
    classList: { add: (c) => host.classes.add(c), remove: (c) => host.classes.delete(c),
                 contains: (c) => host.classes.has(c) },
    querySelector: () => null
  };
  globalThis.$ = (id) => (id === "hero-traj" ? host : null);
  globalThis.markerName = (mk) => mk.display_name || mk.marker_id;
  globalThis.window = {};
  new Function([extractConst("SENSITIVE_MARKER_IDS"), extractConst("SENSITIVE_SYSTEMS"),
                extract("esc"), extract("markerSeriesInfo"), extract("markerHistory"),
                extract("heroTrajectoryModel"), extract("heroTrajectorySVG"), lets,
                extract("heroTrajWidth"), extract("heroTrajPanelCount"),
                extract("renderHeroTrajectory"), extract("heroTrajWatch"), extract("heroTrajResize"),
                "globalThis.__render = renderHeroTrajectory; globalThis.__count = heroTrajPanelCount;"
               ].join("\n"))();

  // The dedup rule this mirrors is dashboard.html:2318-2322, over window.__allReports (:2298)
  // and window.__doneReportIds (:2310). Two reprocesses of one date count once; undated panels
  // stay distinct, which is :2319.
  const setUp = (reports, doneIds) => {
    globalThis.window.__allReports = reports;
    globalThis.window.__doneReportIds = new Set(doneIds);
  };
  setUp([{ id: "r1", collected_on: "2026-03-05" }, { id: "r2", collected_on: "2026-03-05" }], ["r1", "r2"]);
  eq(globalThis.__count(), 1, "GUARD-1: two reprocesses of one collection date are one panel");
  setUp([{ id: "r1", collected_on: null }, { id: "r2", collected_on: null }], ["r1", "r2"]);
  eq(globalThis.__count(), 2, "GUARD-2: two UNDATED panels stay distinct, per :2319");
  setUp([{ id: "r1", collected_on: "2026-03-05" }, { id: "r2", collected_on: "2026-08-05" }], ["r1"]);
  eq(globalThis.__count(), 1, "GUARD-3: a report with no results row is not a completed panel");
  setUp([], []);
  eq(globalThis.__count(), 0, "GUARD-4: no reports is zero, not a crash");

  // A payload whose series carries no dated points resolves to single. With ONE panel that is
  // the truth and the well renders; with TWO it is false and the strip hides itself.
  const PAY = { systems: [{ system_id: "iron", markers: [
      { marker_id: "ferritin", display_name: "Ferritin", value: 17, canonical_unit: "ng/mL" },
      { marker_id: "tsh", display_name: "TSH", value: 2.6, canonical_unit: "uIU/mL" }] }],
    priorities: [{ primary_markers: [{ marker_id: "ferritin" }] }] };
  const render = (reports, doneIds) => {
    setUp(reports, doneIds);
    globalThis.window.__rdSeries = {};   // undated series: nothing to plot across panels
    host.innerHTML = ""; host.classes = new Set(["hidden"]);
    globalThis.__render(PAY);
    return { hidden: host.classes.has("hidden"), html: host.innerHTML };
  };
  const onePanel = render([{ id: "r1", collected_on: null }], ["r1"]);
  ok(!onePanel.hidden && onePanel.html.length > 0,
     "GUARD-5: ONE panel renders the first-panel well, so the guard is not hiding everything");
  ok(onePanel.html.includes(">today<"), "GUARD-6: and it really is the first-panel well");
  const twoPanels = render([{ id: "r1", collected_on: null }, { id: "r2", collected_on: null }], ["r1", "r2"]);
  ok(twoPanels.hidden, "GUARD-7: TWO undated panels resolving to single hides the strip");
  eq(twoPanels.html, "", "GUARD-8: and the host is cleared, not left showing a stale plot");
  const twoDated = render([{ id: "r1", collected_on: "2026-03-05" }, { id: "r2", collected_on: "2026-03-05" }], ["r1", "r2"]);
  ok(!twoDated.hidden, "GUARD-9: two reprocesses of ONE date are one panel, so that still renders");
}

console.log("KNOWN-POSITIVE CONTROLS -- the harness can actually fail");
{
  let threw = false;
  try { extract("thisFunctionDoesNotExist"); } catch (_) { threw = true; }
  ok(threw, "CTRL-1: extract() throws on a missing function, so a silent no-op is impossible");
  let threw2 = false;
  try { extractConst("NOT_A_REAL_CONST"); } catch (_) { threw2 = true; }
  ok(threw2, "CTRL-2: extractConst() throws too, so an empty safety set cannot pass as green");
  const empty = model({}, []);
  eq(empty.mode, "none", "CTRL-3: an empty series is the none state, not a drawn plot");
  eq(model(null, []).mode, "none", "CTRL-4: and a null series does not throw");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
