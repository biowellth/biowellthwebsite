#!/usr/bin/env node
// NEEDS_REVIEW_SUPPLEMENT_HIGH_V1 -- every live engine status lands in the right theme tier.
//
// THE ENGINE'S LIVE VOCABULARY IS NINE VALUES: optimal, normal, watch, flag, not_scored,
// unknown_unit, no_value, supplement_high, needs_review. The theme panel's unscored divert keys
// on REPORT_NOT_SCORED_STATUS, so anything NOT in that set falls through to the class buckets and
// then to a catch-all `else good.push(mk)` -- rendered under "In range" with a teal chip.
//
// needs_review was not in the set. It is not a verdict: the engine is saying it has not settled
// one. It was measured rendering as IN RANGE, on real stored data -- 4 markers, 2 distinct marker
// ids, 1 report, 1 owner, both ids themed and in non-sensitive systems.
//
// supplement_high WAS in the set, and was therefore being counted in the "N not scored." line.
// That is wrong in the other direction: it is a REAL reading that is high, a water-soluble vitamin
// above range because she is supplementing. It is not unread. It goes with watch. Measured live:
// 16 markers, 1 distinct id, 16 reports, 13 owners.
//
// THIS TEST PINS ALL NINE, not just the two that moved, because the failure mode is a status with
// no branch falling through a catch-all. A tenth status would land in `good` exactly as
// needs_review did, and the table below is where that gets noticed.
//
//   node scripts/test-status-vocabulary.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
// OPEN_THEME, THEME_TALLY and RANGES_LOOKUP are LEXICAL (`let`) and unreachable from a vm context.
// Test-only setters are appended to the EXTRACTED source -- THE REPO FILE IS UNTOUCHED.
const SRC = extractApp(readFileSync(FILE, "utf8"), FILE)
  + "\n;globalThis.__setTheme = (k) => { OPEN_THEME = k; };"
  + "\n;globalThis.__setTally = (t) => { THEME_TALLY = t; };"
  + "\n;globalThis.__setRanges = (r) => { RANGES_LOOKUP = r; };"
  + "\n;globalThis.__NOT_SCORED = REPORT_NOT_SCORED_STATUS;\n";

let pass = 0, fail = 0;
const ok = (c, m) => {
  let v;
  try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  if (v) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); }
};

function mkAny() {
  return new Proxy({
    style:{}, classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    dataset:{}, children:[], value:"", textContent:"", innerHTML:"",
    appendChild(){},removeChild(){},remove(){},setAttribute(){},removeAttribute(){},
    getAttribute(){return null;},addEventListener(){},removeEventListener(){},
    querySelector(){return mkAny();},querySelectorAll(){return [];},
    closest(){return null;},focus(){},blur(){},scrollIntoView(){},click(){},
    insertAdjacentHTML(){},cloneNode(){return mkAny();},
    getBoundingClientRect(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},
  },{get:(t,k)=>(k in t?t[k]:undefined),set:(t,k,v)=>{t[k]=v;return true;}});
}
const panelEl = {
  _html:"", get innerHTML(){return this._html;}, set innerHTML(v){this._html=v;},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  querySelector(){return null;}, querySelectorAll(){return [];},
};
function boot() {
  const ctx = {
    console:{log(){},warn(){},error(){}},
    document:{getElementById:(id)=>(id==="theme-panel"?panelEl:mkAny()),
              querySelector:()=>mkAny(),querySelectorAll:()=>[],addEventListener(){},
              createElement:()=>mkAny(),body:mkAny(),documentElement:mkAny()},
    window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})},
    location:{search:"",hash:"",pathname:"/dashboard",replace(){},assign(){}},
    history:{pushState(){},replaceState(){}},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
    fetch:async()=>({ok:true,json:async()=>({})}),
    IntersectionObserver:class{observe(){}disconnect(){}},
    ResizeObserver:class{observe(){}disconnect(){}},
    navigator:{userAgent:"node",language:"en-GB"},
    Intl,Date,JSON,Math,Object,Array,String,Number,Boolean,Promise,Set,Map,RegExp,Error,
    supabase:{createClient:()=>({
      auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){},
            getUser:async()=>({data:{user:null}})},
      from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null}),single:async()=>({data:null}),
        limit:()=>({maybeSingle:async()=>({data:null})})})})}),
      functions:{invoke:async()=>({data:null,error:null})}, storage:{from:()=>({})},
    })},
  };
  ctx.globalThis=ctx; ctx.self=ctx; Object.assign(ctx.window,ctx);
  vm.createContext(ctx);
  new vm.Script(SRC).runInContext(ctx);
  return ctx;
}
const ctx = boot();

const THEME = "energy";
ctx.__setRanges({ themes_by_marker_id: { m_probe:[THEME], m_optimal:[THEME] } });
ctx.__setTally({ [THEME]: { total: 9 } });
ctx.__setTheme(THEME);
const mk = (id, status) => ({ marker_id:id, display_name:id, status, value:1, unit:"x", band:null });

// Render the probe marker ALONGSIDE a genuinely optimal one, so the "In range" tier always exists.
// That is what makes "m_probe is not in the In range tier" a real observation instead of a check
// that found nothing because nothing was rendered.
function render(status) {
  panelEl._html = "";
  ctx.renderThemePanel({ systems:[{ system_id:"energy_sys",
    markers:[mk("m_optimal","optimal"), mk("m_probe", status)] }] });
  return panelEl._html;
}
const LABELS = ["Worth a closer look", "Worth watching", "In range"];
/** The markup of one tier section, or "" when that tier is absent. */
function section(h, label) {
  const i = h.indexOf(label);
  if (i < 0) return "";
  const next = LABELS.map(l => h.indexOf(l, i + label.length)).filter(x => x > 0);
  const end = next.length ? Math.min(...next) : h.length;
  return h.slice(i, end);
}
function tierOf(h) {
  if (section(h, "Worth a closer look").includes(">m_probe<")) return "flag";
  if (section(h, "Worth watching").includes(">m_probe<")) return "watch";
  if (section(h, "In range").includes(">m_probe<")) return "IN RANGE";
  return "unscored";
}
const inRangeN = (h) => { const m = h.match(/tp-chip-teal">(\d+) in range/); return m ? Number(m[1]) : null; };
const notScored = (h) => { const m = h.match(/<div class="mk-note">([^<]*)<\/div>/); return m ? m[1] : null; };

console.log("NEEDS_REVIEW_SUPPLEMENT_HIGH_V1");

// ── 1. reachability ──────────────────────────────────────────────────────────
console.log("REACHABILITY — the assertions below must reach the real renderer");
ok(typeof ctx.renderThemePanel === "function", "R-1: renderThemePanel is in the app block");
ok(typeof ctx.markerRowHTML === "function", "R-2: markerRowHTML is in the app block");
const BASE = render("optimal");
ok(BASE.includes("In range"), "R-3: a baseline render produced an In range tier");
ok(section(BASE, "In range").includes(">m_optimal<"),
   "R-4: the companion optimal marker IS named in that tier, so every 'not in it' below is on real markup");
ok(inRangeN(BASE) === 2, "R-5: baseline in-range count is 2 — the mutated path is reached (got " + inRangeN(BASE) + ")");

// ── 2. all nine statuses, one table ──────────────────────────────────────────
console.log("\nALL NINE LIVE ENGINE STATUSES");
const EXPECT = {
  optimal:"IN RANGE", normal:"IN RANGE", watch:"watch", flag:"flag",
  not_scored:"unscored", unknown_unit:"unscored", no_value:"unscored",
  supplement_high:"watch", needs_review:"unscored",
};
for (const [st, want] of Object.entries(EXPECT)) {
  const h = render(st);
  const got = tierOf(h);
  ok(got === want, "V-" + st + ": tier is " + want + " (got " + got + ")");
  // Companion is always optimal, so the in-range count is 2 only when the probe joined it.
  const wantN = want === "IN RANGE" ? 2 : 1;
  ok(inRangeN(h) === wantN, "V-" + st + "-count: in-range chip reads " + wantN + " (got " + inRangeN(h) + ")");
}

// ── 3. needs_review specifically ─────────────────────────────────────────────
console.log("\nneeds_review — not a verdict");
const NR = render("needs_review");
ok(ctx.__NOT_SCORED.has("needs_review"), "NR-1: needs_review is in REPORT_NOT_SCORED_STATUS");
ok(notScored(NR) === "1 not scored.", "NR-2: it produces the not-scored line (got " + JSON.stringify(notScored(NR)) + ")");
ok(!section(NR, "In range").includes(">m_probe<"), "NR-3: it is NOT named in the In range tier");
ok(section(NR, "In range").includes(">m_optimal<"), "NR-3-CONTROL: but that tier is present and names the optimal marker");
ok(ctx.reportMarkerScored({ status:"needs_review", band:"x" }) === false,
   "NR-4: reportMarkerScored does not count it as scored, even with a band");
ok(ctx.reportMarkerScored({ status:"optimal", band:"x" }) === true,
   "NR-4-CONTROL: an optimal marker with a band IS counted as scored");
// The ruled row treatment: the EXISTING not_scored copy path, not new copy.
const rowNR = ctx.markerRowHTML(mk("m_probe","needs_review")).split('<div class="sm-mk-detail">')[0];
const rowNS = ctx.markerRowHTML(mk("m_probe","not_scored")).split('<div class="sm-mk-detail">')[0];
ok(rowNR === rowNS, "NR-5: its row is BYTE-IDENTICAL to a not_scored row — the existing copy path, no new copy");
ok(rowNS.includes("We do not have a scored reference range"),
   "NR-5-CONTROL: and that shared path really does carry the not_scored note");

// ── 4. supplement_high specifically ──────────────────────────────────────────
console.log("\nsupplement_high — a real reading that is high");
const SH = render("supplement_high");
ok(!section(SH, "In range").includes(">m_probe<"), "SH-1: it is NOT named in the In range tier");
ok(section(SH, "In range").includes(">m_optimal<"), "SH-1-CONTROL: but that tier is present and names the optimal marker");
ok(section(SH, "Worth watching").includes(">m_probe<"), "SH-2: it IS named in the Worth watching tier");
ok(notScored(SH) === null, "SH-3: it is NOT counted in the not-scored line — it was read (got " + JSON.stringify(notScored(SH)) + ")");
ok(ctx.sysStatus("supplement_high").label === "Expected if supplementing",
   "SH-4: its calm label is unchanged (got " + JSON.stringify(ctx.sysStatus("supplement_high").label) + ")");

// ── 5. an all-optimal theme is unchanged ─────────────────────────────────────
console.log("\nAN ALL-OPTIMAL THEME IS UNCHANGED");
panelEl._html = "";
ctx.renderThemePanel({ systems:[{ system_id:"energy_sys",
  markers:[mk("m_optimal","optimal"), mk("m_probe","optimal")] }] });
const ALL = panelEl._html;
ok(inRangeN(ALL) === 2, "Z-1: both markers count as in range (got " + inRangeN(ALL) + ")");
ok(notScored(ALL) === null, "Z-2: no not-scored line (got " + JSON.stringify(notScored(ALL)) + ")");
ok(!ALL.includes("Worth watching") && !ALL.includes("Worth a closer look"), "Z-3: no watch or flag tier");
ok(ALL.includes(">m_probe<") && ALL.includes(">m_optimal<"), "Z-3-CONTROL: both markers ARE rendered, so Z-3 is not vacuous");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
