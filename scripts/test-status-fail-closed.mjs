#!/usr/bin/env node
// FAIL_CLOSED_STATUS_V1 -- nothing reaches "In range", or the read count, by default.
//
// TWICE THIS PAGE SHIPPED A STATUS NOBODY HAD A BRANCH FOR, AS A HEALTHY RESULT. unknown_unit
// reached the theme panel's "In range" tier through a catch-all `else`, and after that was fixed
// needs_review reached it the same way. Both were found by measurement, not by a test, because a
// test that enumerates known statuses cannot fail on a status nobody has thought of.
//
// So the two sites are now ALLOWLISTS and this test asserts the property, not the enumeration:
//   THEME_HEALTHY_STATUS -- optimal, normal. Only these reach "In range".
//   COUNTS_AS_READ       -- optimal, normal, watch, flag, supplement_high. Only these count
//                           toward the number that renders as "we read N of them".
// The invented status below is the part that matters. It stands in for the tenth engine status,
// whatever it turns out to be, and it must land in unscored without anyone editing this file.
//
// ONE DELIBERATE BEHAVIOUR CHANGE, RECORDED HERE SO IT IS NOT MISTAKEN FOR DRIFT.
// supplement_high is a member of REPORT_NOT_SCORED_STATUS, so the old exclusion form of
// reportMarkerScored returned FALSE for it. It is a member of COUNTS_AS_READ, so it now returns
// TRUE. That is the ruled allowlist, and it follows the 2026-09-21 ruling that supplement_high is
// a real reading that came back high: we took it and we read it against a range, so it counts
// toward "we read N of them". It is still NOT in range -- it renders with watch -- and those two
// facts are why the two sets are separate. Every other one of the nine is unchanged at both sites.
//
//   node scripts/test-status-fail-closed.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
// OPEN_THEME, THEME_TALLY and RANGES_LOOKUP are LEXICAL (`let`) and unreachable from a vm context.
// Test-only setters are appended to the EXTRACTED source -- THE REPO FILE IS UNTOUCHED.
const SRC = extractApp(readFileSync(FILE, "utf8"), FILE)
  + "\n;globalThis.__setTheme=(k)=>{OPEN_THEME=k;};"
  + "\n;globalThis.__setTally=(t)=>{THEME_TALLY=t;};"
  + "\n;globalThis.__setRanges=(r)=>{RANGES_LOOKUP=r;};\n";

let pass = 0, fail = 0;
const ok = (c, m) => {
  let v;
  try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  if (v) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); }
};

function mkAny(){return new Proxy({
  style:{},classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  dataset:{},children:[],value:"",textContent:"",innerHTML:"",
  appendChild(){},removeChild(){},remove(){},setAttribute(){},removeAttribute(){},
  getAttribute(){return null;},addEventListener(){},removeEventListener(){},
  querySelector(){return mkAny();},querySelectorAll(){return [];},
  closest(){return null;},focus(){},blur(){},scrollIntoView(){},click(){},
  insertAdjacentHTML(){},cloneNode(){return mkAny();},
  getBoundingClientRect(){return {top:0,left:0,width:0,height:0,bottom:0,right:0};},
},{get:(t,k)=>(k in t?t[k]:undefined),set:(t,k,v)=>{t[k]=v;return true;}});}

const panelEl = {
  _html:"", get innerHTML(){return this._html;}, set innerHTML(v){this._html=v;},
  classList:{add(){},remove(){},toggle(){},contains(){return false;}},
  querySelector(){return null;}, querySelectorAll(){return [];},
};
function boot(){
  const ctx = {
    console:{log(){},warn(){},error(){}},
    document:{getElementById:(id)=>(id==="theme-panel"?panelEl:mkAny()),querySelector:()=>mkAny(),
      querySelectorAll:()=>[],addEventListener(){},createElement:()=>mkAny(),
      body:mkAny(),documentElement:mkAny()},
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
    supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),
      onAuthStateChange(){},getUser:async()=>({data:{user:null}})},
      from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null}),single:async()=>({data:null}),
        limit:()=>({maybeSingle:async()=>({data:null})})})})}),
      functions:{invoke:async()=>({data:null,error:null})},storage:{from:()=>({})}})},
  };
  ctx.globalThis=ctx; ctx.self=ctx; Object.assign(ctx.window,ctx);
  vm.createContext(ctx);
  new vm.Script(SRC).runInContext(ctx);
  return ctx;
}
const ctx = boot();

const THEME = "energy";
ctx.__setRanges({themes_by_marker_id:{m_probe:[THEME],m_optimal:[THEME]}});
ctx.__setTally({[THEME]:{total:9}});
ctx.__setTheme(THEME);

// `status` is OMITTED entirely when undefined, so the missing-status case is genuinely missing
// rather than an explicit undefined.
const mk = (id, status) => {
  const o = { marker_id:id, display_name:id, value:1, unit:"x", band:"b" };
  if (status !== undefined) o.status = status;
  return o;
};

// The probe marker always renders BESIDE a genuinely optimal one, so the "In range" tier exists
// in every render. That is what makes "the probe is not in it" an observation about the probe
// instead of a check that found nothing because nothing was rendered.
const LABELS = ["Worth a closer look", "Worth watching", "In range"];
function section(h, label){
  const i = h.indexOf(label);
  if (i < 0) return "";
  const nx = LABELS.map(l => h.indexOf(l, i + label.length)).filter(x => x > 0);
  return h.slice(i, nx.length ? Math.min(...nx) : h.length);
}
function render(status){
  panelEl._html = "";
  ctx.renderThemePanel({ systems:[{ system_id:"energy_sys",
    markers:[mk("m_optimal","optimal"), mk("m_probe", status)] }] });
  return panelEl._html;
}
function tierOf(h){
  if (section(h,"Worth a closer look").includes(">m_probe<")) return "flagged";
  if (section(h,"Worth watching").includes(">m_probe<")) return "watch";
  if (section(h,"In range").includes(">m_probe<")) return "IN RANGE";
  return "unscored";
}
const notScored = (h) => { const m = h.match(/<div class="mk-note">([^<]*)<\/div>/); return m ? m[1] : null; };
const scored = (status) => ctx.reportMarkerScored(mk("m_probe", status));

console.log("FAIL_CLOSED_STATUS_V1");

// ── 1. reachability ──────────────────────────────────────────────────────────
console.log("REACHABILITY — the assertions below must reach the real renderer");
ok(typeof ctx.renderThemePanel === "function", "R-1: renderThemePanel is in the app block");
ok(typeof ctx.reportMarkerScored === "function", "R-2: reportMarkerScored is in the app block");
const BASE = render("optimal");
ok(section(BASE,"In range").includes(">m_optimal<"),
   "R-3: the companion optimal marker IS named in the In range tier — every 'not in it' below is on real markup");
ok(tierOf(BASE) === "IN RANGE", "R-4: an optimal probe reaches In range — the mutated path is reached (got " + tierOf(BASE) + ")");
ok(scored("optimal") === true, "R-5: an optimal marker with a band counts as read — the second mutated path is reached");
ok(ctx.reportMarkerScored({ marker_id:"m", status:"optimal", band:null }) === false,
   "R-6: and the band guard still returns false with no band, so the allowlist is not the only gate");

// ── 2. the nine live statuses, theme bucket ──────────────────────────────────
console.log("\nTHE NINE LIVE ENGINE STATUSES — theme bucket, unchanged");
const TIER = {
  optimal:"IN RANGE", normal:"IN RANGE", watch:"watch", flag:"flagged",
  not_scored:"unscored", unknown_unit:"unscored", no_value:"unscored",
  supplement_high:"watch", needs_review:"unscored",
};
for (const [st, want] of Object.entries(TIER)) {
  ok(tierOf(render(st)) === want, "T-" + st + ": tier is " + want + " (got " + tierOf(render(st)) + ")");
}

// ── 3. the nine live statuses, read count ────────────────────────────────────
console.log("\nTHE NINE LIVE ENGINE STATUSES — counts as read");
// supplement_high is TRUE here and was FALSE under the old exclusion form. Deliberate, ruled,
// and explained in the header. Every other value in this table is unchanged.
const READ = {
  optimal:true, normal:true, watch:true, flag:true,
  not_scored:false, unknown_unit:false, no_value:false,
  supplement_high:true, needs_review:false,
};
for (const [st, want] of Object.entries(READ)) {
  ok(scored(st) === want, "S-" + st + ": counts as read = " + want + " (got " + scored(st) + ")");
}

// ── 4. THE POINT: anything unrecognised fails closed ─────────────────────────
console.log("\nUNRECOGNISED, EMPTY AND MISSING — the tenth engine status, whatever it is");
const UNKNOWN = [["brand_new_status","brand_new_status"], ["(empty string)",""], ["(missing)",undefined]];
for (const [label, st] of UNKNOWN) {
  const h = render(st);
  ok(tierOf(h) === "unscored", "U-" + label + ": lands in unscored (got " + tierOf(h) + ")");
  ok(!section(h,"In range").includes(">m_probe<"), "U-" + label + "-notinrange: it is NOT named in the In range tier");
  ok(section(h,"In range").includes(">m_optimal<"),
     "U-" + label + "-CONTROL: but that tier IS present and names the optimal marker, so the line above is not vacuous");
  ok(notScored(h) === "1 not scored.", "U-" + label + "-line: produces the not-scored line (got " + JSON.stringify(notScored(h)) + ")");
  ok(scored(st) === false, "U-" + label + "-read: does NOT count as read (got " + scored(st) + ")");
}

// ── 5. the allowlists are allowlists, not a rewritten exclusion ──────────────
console.log("\nTHE SETS ARE ALLOWLISTS");
// A status that is in NEITHER the healthy allowlist NOR the not-scored set is the case that used
// to fall through. Asserting on a second invented name guards against a fix that special-cased
// one string rather than inverting the logic.
for (const st of ["zzz_unheard_of", "OPTIMAL_BUT_SHOUTING", "optimal_ish"]) {
  ok(tierOf(render(st)) === "unscored", "A-" + st + ": still unscored (got " + tierOf(render(st)) + ")");
  ok(scored(st) === false, "A-" + st + "-read: does not count as read (got " + scored(st) + ")");
}
// CONTROL: the exact allowlisted spellings DO pass, so the assertions above are not passing
// because everything fails.
ok(tierOf(render("optimal")) === "IN RANGE" && tierOf(render("normal")) === "IN RANGE",
   "A-CONTROL: the two allowlisted healthy spellings DO reach In range");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
