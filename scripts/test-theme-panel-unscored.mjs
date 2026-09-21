#!/usr/bin/env node
// THEME_PANEL_UNSCORED_V1 -- unscored markers never count or render as "In range".
//
// WHAT WAS WRONG. renderThemePanel bucketed by sysStatus(...).cls with a catch-all `else`:
//   if(cls === "s-flag") flag.push(mk); else if(cls === "s-watch") watch.push(mk); else good.push(mk);
// Every status in REPORT_NOT_SCORED_STATUS resolves to s-none or s-ref -- measured, all seven --
// so the else swept all of them into `good`, and TIER 3 rendered `good` under "In range" with a
// teal "<n> in range" chip. A marker we could not read was presented as a healthy result.
// Measured on real data when found: 265 such markers across 21 reports and 15 owners.
//
// RULED 2026-09-21: such a marker is NEVER counted or shown as in range. It leaves the good group
// and the in-range count. If a theme has one or more, one grey .mk-note line renders, verbatim:
//   N not scored.
// with "1 not scored." for one. No teal, no amber, no chip. Flagged, watch and genuinely in-range
// markers render exactly as today.
//
// WHY THE SIBLING COUNTERS ARE NOT TESTED HERE. The hero counts and the markers-view pills bucket
// with `cls === "s-good"`, which no unscored status can satisfy. That is asserted below as a
// standing guard -- if any unscored status ever starts resolving to s-good, this fails here rather
// than silently re-opening the same hole on three other surfaces.
//
//   node scripts/test-theme-panel-unscored.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
// OPEN_THEME, THEME_TALLY and RANGES_LOOKUP are all LEXICAL (`let`), so none is reachable from a
// vm context. Test-only setters are appended to the EXTRACTED source -- THE REPO FILE IS UNTOUCHED.
const SRC = extractApp(readFileSync(FILE, "utf8"), FILE)
  + "\n;globalThis.__setTheme = (k) => { OPEN_THEME = k; };"
  + "\n;globalThis.__setTally = (t) => { THEME_TALLY = t; };"
  + "\n;globalThis.__setRanges = (r) => { RANGES_LOOKUP = r; };\n";

const UNSCORED = ["no_value", "unknown_unit", "not_scored", "cycle_gated",
                  "reference_only", "supplement_high", "life_stage_reference"];

let pass = 0, fail = 0;
const ok = (c, m) => {
  let v;
  try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  if (v) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); }
};

// ── a DOM permissive enough that only REAL errors surface ────────────────────
function mkAny() {
  return new Proxy({
    style: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset: {}, children: [], value: "", textContent: "", innerHTML: "",
    appendChild(){}, removeChild(){}, remove(){}, setAttribute(){}, removeAttribute(){},
    getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    querySelector(){ return mkAny(); }, querySelectorAll(){ return []; },
    closest(){ return null; }, focus(){}, blur(){}, scrollIntoView(){}, click(){},
    insertAdjacentHTML(){}, cloneNode(){ return mkAny(); },
    getBoundingClientRect(){ return { top:0,left:0,width:0,height:0,bottom:0,right:0 }; },
  }, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
}

// The panel element records what renderThemePanel writes into it.
const panel = {
  _html: "",
  get innerHTML() { return this._html; },
  set innerHTML(v) { this._html = v; },
  classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  querySelector() { return null; }, querySelectorAll() { return []; },
};

function boot() {
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    document: { getElementById: (id) => (id === "theme-panel" ? panel : mkAny()),
                querySelector: () => mkAny(), querySelectorAll: () => [], addEventListener(){},
                createElement: () => mkAny(), body: mkAny(), documentElement: mkAny() },
    window: { addEventListener(){}, matchMedia: () => ({ matches:false, addEventListener(){} }) },
    location: { search:"", hash:"", pathname:"/dashboard", replace(){}, assign(){} },
    history: { pushState(){}, replaceState(){} },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    fetch: async () => ({ ok:true, json: async () => ({}) }),
    IntersectionObserver: class { observe(){} disconnect(){} },
    ResizeObserver: class { observe(){} disconnect(){} },
    navigator: { userAgent:"node", language:"en-GB" },
    Intl, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise, Set, Map, RegExp, Error,
    supabase: { createClient: () => ({
      auth: { getSession: async () => ({ data:{ session:null } }), onAuthStateChange(){},
              getUser: async () => ({ data:{ user:null } }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data:null }),
              single: async () => ({ data:null }), limit: () => ({ maybeSingle: async () => ({ data:null }) }) }) }) }),
      functions: { invoke: async () => ({ data:null, error:null }) },
      storage: { from: () => ({}) },
    }) },
  };
  ctx.globalThis = ctx; ctx.self = ctx; Object.assign(ctx.window, ctx);
  vm.createContext(ctx);
  new vm.Script(SRC).runInContext(ctx);
  return ctx;
}

const ctx = boot();
const THEME = "energy";

// Every marker used here is themed to THEME, so themesOf() admits it to the panel.
const IDS = ["m_flag", "m_good", "m_x1", "m_x2", "m_x3"];
ctx.__setRanges({ themes_by_marker_id: Object.fromEntries(IDS.map((i) => [i, [THEME]])) });
ctx.__setTally({ [THEME]: { total: 99 } });
ctx.__setTheme(THEME);

/** Render one theme from a flat marker list and return the panel HTML. */
function render(markers) {
  panel._html = "";
  ctx.renderThemePanel({ systems: [{ system_id: "energy_sys", markers }] });
  return panel._html;
}
const mk = (id, status, extra) => Object.assign(
  { marker_id: id, display_name: id, status, value: 1, unit: "x", band: null }, extra || {});

// The teal in-range chip text, read out of the rendered panel.
const inRangeCount = (h) => {
  const m = h.match(/<span class="tp-chip tp-chip-teal">(\d+) in range<\/span>/);
  return m ? Number(m[1]) : null;
};
const notScoredLine = (h) => {
  const m = h.match(/<div class="mk-note">([^<]*)<\/div>/);
  return m ? m[1] : null;
};

console.log("THEME_PANEL_UNSCORED_V1");

// ── 1. reachability, before any verdict is trusted ───────────────────────────
console.log("REACHABILITY — the assertions below must be reaching the real renderer");
ok(typeof ctx.renderThemePanel === "function", "R-1: renderThemePanel is in the app block (got " + typeof ctx.renderThemePanel + ")");
ok(typeof ctx.themesOf === "function", "R-2: themesOf is in the app block");
const BASE = render([mk("m_flag", "low"), mk("m_good", "optimal")]);
ok(BASE.includes("tp-chip-teal"), "R-3: a baseline render produced the in-range chip — the panel really rendered");
ok(ctx.themesOf({ marker_id: "m_good" }).includes(THEME), "R-4: the test markers are admitted by themesOf");
ok(inRangeCount(BASE) === 1, "R-5: the mutated path is reached — baseline in-range count is 1 (got " + inRangeCount(BASE) + ")");

// ── 2. the ruled case: one flagged, one in-range, one unknown_unit ───────────
console.log("\nONE FLAGGED, ONE IN RANGE, ONE unknown_unit");
const H = render([mk("m_flag", "low"), mk("m_good", "optimal"), mk("m_x1", "unknown_unit")]);
ok(inRangeCount(H) === 1, "A-1: the in-range count is 1, not 2 — the unscored marker left the count (got " + inRangeCount(H) + ")");
ok(H.includes("Worth a closer look"), "A-2: the flagged marker still renders flagged");
ok(H.includes(">m_flag<"), "A-2-CONTROL: and it is the flagged marker that is named there");
ok(notScoredLine(H) === "1 not scored.", "A-3: the ruled line reads exactly \"1 not scored.\" (got " + JSON.stringify(notScoredLine(H)) + ")");
ok(!H.includes(">m_x1<"), "A-4: the unscored marker is not named in the in-range list");
ok(H.includes(">m_good<"), "A-4-CONTROL: the genuinely in-range marker IS named, so A-4 is not vacuous");

// ── 3. no unscored markers -> no line at all ─────────────────────────────────
console.log("\nA THEME WITH ONLY IN-RANGE MARKERS");
const G = render([mk("m_good", "optimal"), mk("m_x2", "normal")]);
ok(notScoredLine(G) === null, "B-1: no not-scored line is rendered (got " + JSON.stringify(notScoredLine(G)) + ")");
ok(inRangeCount(G) === 2, "B-1-CONTROL: and both markers counted as in range, so B-1 is not passing on an empty panel (got " + inRangeCount(G) + ")");
ok(!G.includes("not scored"), "B-2: the words do not appear anywhere in the panel");

// ── 4. every unscored status behaves the same ────────────────────────────────
console.log("\nEVERY STATUS IN REPORT_NOT_SCORED_STATUS, not just unknown_unit");
// LEAVING THE IN-RANGE COUNT is the invariant, and it holds for EVERY member of the set including
// supplement_high. Asserted for all of them below, unconditionally.
//
// PRODUCING THE "N not scored." LINE is a narrower claim, and supplement_high is deliberately NOT
// part of it as of 2026-09-21: it is a REAL reading that is high -- a water-soluble vitamin above
// range because she is supplementing -- so it was read, and it goes with watch instead. That is
// asserted positively here rather than dropped, and pinned again in test-status-vocabulary.mjs.
const UNREAD = UNSCORED.filter((s) => s !== "supplement_high");
for (const st of UNSCORED) {
  const h = render([mk("m_good", "optimal"), mk("m_x1", st)]);
  ok(inRangeCount(h) === 1, "C-" + st + ": in-range count is 1, not 2 (got " + inRangeCount(h) + ")");
}
for (const st of UNREAD) {
  const h = render([mk("m_good", "optimal"), mk("m_x1", st)]);
  ok(notScoredLine(h) === "1 not scored.", "C-" + st + "-line: shows \"1 not scored.\" (got " + JSON.stringify(notScoredLine(h)) + ")");
}
{
  const h = render([mk("m_good", "optimal"), mk("m_x1", "supplement_high")]);
  ok(notScoredLine(h) === null, "C-supplement_high-line: it is NOT in the not-scored count — it was read (got " + JSON.stringify(notScoredLine(h)) + ")");
  ok(h.includes("Worth watching"), "C-supplement_high-watch: it renders under Worth watching instead");
  ok(h.includes(">m_x1<"), "C-supplement_high-CONTROL: and the marker IS rendered somewhere, so the two above are not vacuous");
}

// ── 5. the count is the count ────────────────────────────────────────────────
console.log("\nTHE COUNT IS THE COUNT");
const T = render([mk("m_good", "optimal"), mk("m_x1", "unknown_unit"), mk("m_x2", "not_scored"), mk("m_x3", "no_value")]);
ok(notScoredLine(T) === "3 not scored.", "D-1: three unscored markers read \"3 not scored.\" (got " + JSON.stringify(notScoredLine(T)) + ")");
ok(inRangeCount(T) === 1, "D-2: and the in-range count is still 1 (got " + inRangeCount(T) + ")");
const ONLY = render([mk("m_x1", "unknown_unit")]);
ok(notScoredLine(ONLY) === "1 not scored.", "D-3: a theme with ONLY unscored markers reads \"1 not scored.\" (got " + JSON.stringify(notScoredLine(ONLY)) + ")");
ok(inRangeCount(ONLY) === null, "D-4: and renders no in-range chip at all (got " + inRangeCount(ONLY) + ")");

// ── 6. the line is never teal, amber or coral ────────────────────────────────
console.log("\nNEVER TEAL, NEVER AMBER, NEVER CORAL — we did not read these results");
// Captures the whole .mk-note div INCLUDING any nested markup. A [^<]* capture would stop at the
// first tag, so a line wrapped in a chip would yield "" and every absence check below would pass on
// an empty string -- measured: styling the line teal left E-tp-chip-teal green, and only E-0 caught
// it. The absence checks have to be run against the real markup to mean anything.
const LINE = (H.match(/<div class="mk-note">[\s\S]*?<\/div>/) || [""])[0];
ok(LINE !== "", "E-0: the not-scored line was located, so the checks below are on real markup");
for (const c of ["tp-chip", "tp-chip-teal", "mk-note-amber", "mk-note-coral", "s-watch", "s-flag"]) {
  ok(!LINE.includes(c), "E-" + c + ": the not-scored line carries no " + c);
}
ok(LINE.includes('class="mk-note"'), "E-1: it carries the grey .mk-note class");
ok(H.includes('class="tp-chip tp-chip-teal"'),
   "E-CONTROL: the teal chip DOES exist elsewhere in the same panel, so the absences above can fail");

// ── 7. standing guard on the sibling counters ────────────────────────────────
console.log("\nSTANDING GUARD — the hero and pill counters bucket on cls === 's-good'");
let good = 0;
for (const st of UNSCORED) if (ctx.sysStatus(st).cls === "s-good") good++;
ok(good === 0, "F-1: no unscored status resolves to s-good, so `cls === \"s-good\"` counters cannot catch one (got " + good + ")");
ok(ctx.sysStatus("optimal").cls === "s-good", "F-1-CONTROL: a genuinely healthy status DOES resolve to s-good");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
