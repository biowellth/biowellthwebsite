#!/usr/bin/env node
// CYCLE_MOVEMENT_V1 -- the daily card reads its phase and its movement row from the shared module.
//
// js/cycle-movement.js and scripts/fixtures/cycle-movement-corpus.json are byte-identical to supa
// supabase/functions/_shared/cycle-movement.js + cycle-movement-corpus.json and backend-branches
// src/services/cycle-movement.js + tests/fixtures/cycle-movement-corpus.json. The two constants below
// are the SAME constants both of those repositories pin. Edit one copy without the others and that
// repository goes red.
//
// Sections:
//   1. pins, and the import URL's cache key matches the pinned module
//   2. every corpus case resolves as labelled (the same corpus supa and backend-branches run)
//   3. PARITY with the superseded dcResolvePhase (LOCKED Option A) for days 1..L, and the two
//      ruled DIFFERENCES pinned as differences, so neither can drift silently
//   4. the real dcRenderDailyCard, booted from the app block with a fake supabase client
//
//   node scripts/test-cycle-movement.mjs
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const MODULE_SHA256 = "6aec9b31075f24b61bd59283e19079868fb3ef1bcbab49f55392b8b326e36487";
const CORPUS_SHA256 = "d8c449d26c5bdff6a444de4eed3f0bbe615f2bda77475fc4c02d24d9d2245f5e";
const MODULE_PATH = new URL("../js/cycle-movement.js", import.meta.url);
const CORPUS_PATH = new URL("./fixtures/cycle-movement-corpus.json", import.meta.url);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

console.log("CYCLE_MOVEMENT_V1");
const HTML = readFileSync(process.env.DASH || new URL("../dashboard.html", import.meta.url), "utf8");
const CM = await import(MODULE_PATH);
const CORPUS = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));

// ── 1. pins ──────────────────────────────────────────────────────────────────
eq(sha(MODULE_PATH), MODULE_SHA256, "CM-W1: the module is the pinned bytes, the same pin supa and backend-branches hold");
eq(sha(CORPUS_PATH), CORPUS_SHA256, "CM-W2: the corpus is the pinned bytes, the same pin supa and backend-branches hold");
const src = (HTML.match(/const CM_SRC = '([^']+)'/) || [])[1];
eq(src, "/js/cycle-movement.js?v=" + MODULE_SHA256.slice(0, 8), "CM-W3: the import URL's cache key is the pinned module's sha prefix");

// ── 2. corpus ────────────────────────────────────────────────────────────────
function mismatches(c) {
  const r = CM.resolveCycleMovement(c.profile, c.opts);
  const out = [];
  for (const [k, want] of Object.entries(c.expect)) {
    let got;
    if (k === "periodEstimated") got = r.inputsEstimated.periodLength;
    else if (k === "hasStatusLine") got = typeof r.statusLine === "string" && r.statusLine.length > 0;
    else got = r[k];
    if (got !== want) out.push(`${c.name}: ${k} want ${JSON.stringify(want)} got ${JSON.stringify(got)}`);
  }
  if (r.status === "phase" && typeof r.movementLine !== "string") out.push(`${c.name}: phase without a line`);
  if (r.status !== "phase" && r.movementLine !== null) out.push(`${c.name}: line without a phase`);
  return out;
}
ok(CORPUS.cases.length >= 60, `CM-W4: the corpus holds ${CORPUS.cases.length} cases`);
const wrong = CORPUS.cases.flatMap(mismatches);
eq(wrong.length, 0, "CM-W5: every corpus case resolves as labelled" + (wrong.length ? " -- " + wrong.slice(0, 3).join("; ") : ""));

// ── 3. parity with the superseded dcResolvePhase ─────────────────────────────
// VERBATIM from dashboard.html at 0357f70 except that `today` is a parameter instead of the clock.
function optionA(profile, lmpRaw, today) {
  const parse = (s) => { const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  if (!profile || profile.menstrual_status !== "regular") return null;
  const lmp = parse(lmpRaw); if (!lmp) return null;
  const days = Math.round((parse(today) - lmp) / 86400000);
  if (!(days >= 0 && days <= 90)) return null;
  let L = profile.typical_cycle_length_days; if (typeof L !== "number" || !isFinite(L)) L = null;
  if (!(L >= 21 && L <= 35)) return null;
  let P = profile.typical_period_duration_days; if (typeof P !== "number" || !isFinite(P)) P = null;
  if (!(P >= 2 && P <= 8)) return null;
  const cd = (((days % L) + L) % L) + 1;
  const ov = L - 14;
  if (cd >= 1 && cd <= P) return "menstrual";
  if (cd >= ov - 1 && cd <= ov + 1) return "ovulatory";
  if (cd >= L - 13 && cd <= L) return "luteal";
  return "follicular";
}
const ymd = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const T = 20000, TODAY = ymd(T);
let same = 0, diff = [], wrappedOld = 0, wrappedNew = 0;
for (let L = 21; L <= 35; L++) for (let P = 2; P <= 8; P++) for (let cd = 1; cd <= L + 20; cd++) {
  const prof = { menstrual_status: "regular", typical_cycle_length_days: L, typical_period_duration_days: P };
  const lmp = ymd(T - (cd - 1));
  const a = optionA(prof, lmp, TODAY);
  const r = CM.resolveCycleMovement(prof, { reportLmp: lmp, today: TODAY });
  const b = r.status === "phase" ? r.dailyCardKey : null;
  if (cd <= L) { if (a === b) same++; else diff.push(`L${L} P${P} cd${cd} A=${a} new=${b}`); }
  else { if (a !== null) wrappedOld++; if (cd > L + 7 && b !== null) wrappedNew++; }
}
eq(diff.length, 0, `CM-W6: PARITY, days 1..L give Option A's flavor key in all ${same} cases` + (diff.length ? " -- " + diff.slice(0, 3).join("; ") : ""));
ok(wrappedOld > 0, `CM-W7: CONTROL, Option A DID wrap past L (${wrappedOld} cases), so the change below is real`);
eq(wrappedNew, 0, "CM-W8: RULED CHANGE, past L+7 the module gives no phase");
{
  const prof = { menstrual_status: "regular", typical_cycle_length_days: 28, typical_period_duration_days: 5, last_period_start_date: ymd(T - 5) };
  eq(optionA(prof, ymd(T - 40), TODAY), "ovulatory", "CM-W9: CONTROL, Option A read the REPORT date only (cd 41 wraps to cd 13, its ovulatory window)");
  eq(CM.resolveCycleMovement(prof, { reportLmp: ymd(T - 40), today: TODAY }).dailyCardKey, "follicular",
     "CM-W10: RULED CHANGE, the later PROFILE date wins (cd 6)");
  eq(CM.resolveCycleMovement(prof, { reportLmp: ymd(T - 40), today: TODAY }).lmpSource, "profile", "CM-W11: and says so");
}

// ── 4. the real dcRenderDailyCard ────────────────────────────────────────────
// Lexical state is unreachable from the vm context, so ONE test-only line is appended to the
// EXTRACTED source (the repo file is untouched) to set USER and read __dcState.
const APP = extractApp(HTML, "dashboard.html")
  + "\n;globalThis.__setUser = (u) => { USER = u; }; globalThis.__getDc = () => __dcState;\n";

function localToday() { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
const todayN = Math.round(localToday().getTime() / 86400000);

function boot(world) {
  const calls = [];
  const host = { _h: "", get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    querySelector: () => ({ textContent: "" }), querySelectorAll: () => [] };
  // A chainable query recorder: from(t).select(cols).eq(...).maybeSingle() / awaited directly.
  function q(table) {
    const rec = { table, cols: null };
    calls.push(rec);
    const result = () => world[table] ? world[table](rec) : { data: null, error: null };
    const chain = {
      select(c) { rec.cols = c; return chain; }, eq() { return chain; }, order() { return chain; }, limit() { return chain; },
      maybeSingle: async () => result(), single: async () => result(),
      then(res, rej) { return Promise.resolve(result()).then(res, rej); },
      insert: async () => ({ error: null }), delete() { return chain; },
    };
    return chain;
  }
  const any = () => new Proxy({}, { get: (t, k) => (k === "then" ? undefined : typeof k === "symbol" ? undefined : any), apply: () => any() });
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, dataset: {},
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, querySelector: () => null,
    querySelectorAll: () => [], textContent: "", innerHTML: "", value: "" });
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    document: { getElementById: (id) => (id === "daily-card" ? host : el()), querySelector: () => el(), querySelectorAll: () => [],
      addEventListener() {}, createElement: () => el(), body: el(), documentElement: el(), visibilityState: "visible" },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    location: { search: "", hash: "", pathname: "/dashboard", replace() {}, assign() {} },
    history: { pushState() {}, replaceState() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    IntersectionObserver: class { observe() {} disconnect() {} }, ResizeObserver: class { observe() {} disconnect() {} },
    navigator: { userAgent: "node", language: "en-US" },
    Intl, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise, Set, Map, RegExp, Error,
    supabase: { createClient: () => ({
      auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange() {}, getUser: async () => ({ data: { user: null } }) },
      from: (t) => q(t), functions: { invoke: async () => ({ data: null, error: null }) }, storage: { from: () => ({}) }, rpc: async () => ({}),
    }) },
  };
  ctx.globalThis = ctx; ctx.self = ctx; Object.assign(ctx.window, ctx);
  vm.createContext(ctx);
  new vm.Script(APP).runInContext(ctx);
  ctx.__setUser({ id: "00000000-0000-4000-8000-000000000001" });
  // the dynamic import cannot resolve inside the vm, so the loader is pointed at the real module
  ctx.dcLoadCycleMovement = async () => (world.moduleFails ? null : CM);
  return { ctx, host, calls };
}

const POOL = [
  { action_id: "a1", priority_marker_id: "ferritin", base_text: "Try lentils at lunch.", phase_notes: { menstrual: "M note.", follicular: "F note.", ovulatory: "O note.", luteal: "L note." } },
  { action_id: "a2", priority_marker_id: "vitamin_d", base_text: "Try some morning sun.", phase_notes: null },
  { action_id: "a3", priority_marker_id: "tsh", base_text: "Try a ten minute walk.", phase_notes: null },
];
const REGULAR = { menstrual_status: "regular", typical_cycle_length_days: 28, typical_period_duration_days: 5 };

async function render(profile, opts = {}) {
  const world = {
    action_pool: () => ({ data: opts.pool || POOL, error: null }),
    profiles: () => (opts.profileError ? { data: null, error: { code: "42501", message: "denied" } } : { data: profile, error: null }),
    reports: () => ({ data: { lmp_date_before_draw: opts.reportLmp ?? null }, error: null }),
    action_completions: () => ({ data: [], error: null }),
    moduleFails: !!opts.moduleFails,
  };
  const b = boot(world);
  const r = await b.ctx.dcRenderDailyCard({ priorities: [] }, "rep-1");
  return { rendered: r, html: b.host.innerHTML, calls: b.calls, st: b.ctx.__getDc() };
}
const flavors = (h) => [...h.matchAll(/class="dc-flavor">([^<]*)</g)].map((m) => m[1]);

eq(typeof boot({}).ctx.dcRenderDailyCard, "function", "CM-W12: REACHABILITY, dcRenderDailyCard is in the app block");
eq(/function dcResolvePhase\s*\(/.test(HTML), false, "CM-W13: dcResolvePhase is gone, so there is ONE phase calculation");

{ // cd 6 from the profile date, report date older: follicular flavor, movement row, profile read widened
  const r = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 5) }, { reportLmp: ymd(todayN - 40) });
  eq(r.rendered, true, "CM-W14: the card renders");
  eq(JSON.stringify(flavors(r.html)), JSON.stringify(["F note."]), "CM-W15: cd 6 from the later profile date shows the follicular flavor");
  ok(r.html.includes('<div class="dc-move-label">Movement for today</div>'), "CM-W16: the movement row renders");
  ok(r.html.includes(CM.MOVEMENT_LINES.follicular.high), "CM-W17: with the module's own follicular line, verbatim");
  ok(r.html.includes("An estimate from the period date you gave us"), "CM-W18: and says it is an estimate");
  ok(r.html.indexOf('class="dc-actions"') < r.html.indexOf('class="dc-move"') && r.html.indexOf('class="dc-move"') < r.html.indexOf('class="dc-closing"'),
     "CM-W19: the row sits after the three actions and before the closing line");
  eq((r.html.match(/class="dc-tick"/g) || []).length, 3, "CM-W20: CONTROL, still three tickable actions, the row is not a fourth");
  const pc = r.calls.find((c) => c.table === "profiles");
  ok(pc && /last_period_start_date/.test(pc.cols) && /hormonal_contraception/.test(pc.cols) && /pregnant_or_postpartum_within_6_months/.test(pc.cols),
     "CM-W21: the profile read carries the current period date, contraception and pregnancy");
  ok(r.calls.some((c) => c.table === "reports" && /lmp_date_before_draw/.test(c.cols)), "CM-W22: and the report date is still read (read-both)");
}
{ // OVULATORY_SHOWS_FOLLICULAR_V1: the ovulatory key keeps its name inside, and shows the FOLLICULAR note
  const r = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 13) });
  eq(JSON.stringify(flavors(r.html)), JSON.stringify(["F note."]), "CM-W23: cd 14 shows the follicular note in place of the ovulatory one");
  eq(r.html.includes("O note."), false, "CM-W40: and the ovulatory note appears nowhere on the card");
  eq(r.st.three.find((t) => t.action.action_id === "a1").phase, "ovulatory", "CM-W41: CONTROL, the internal key is still ovulatory (display only)");
  const noF = [{ ...POOL[0], phase_notes: { menstrual: "M note.", ovulatory: "O note.", luteal: "L note." } }, POOL[1], POOL[2]];
  const r2 = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 13) }, { pool: noF });
  eq(flavors(r2.html).length, 0, "CM-W42: no follicular note for the action, no phase note at all");
  eq(r2.html.includes("O note."), false, "CM-W43: the ovulatory note is never the fallback");
  const blankF = [{ ...POOL[0], phase_notes: { follicular: "  ", ovulatory: "O note." } }, POOL[1], POOL[2]];
  const r3 = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 13) }, { pool: blankF });
  eq(flavors(r3.html).length + (r3.html.includes("O note.") ? 1 : 0), 0, "CM-W44: a blank follicular note counts as none");
  const r4 = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 20) });
  eq(JSON.stringify(flavors(r4.html)), JSON.stringify(["L note."]), "CM-W45: CONTROL, cd 21 still shows its own luteal note");
}
{ // current contraception: no flavor, no movement row, the card still renders
  const r = await render({ ...REGULAR, hormonal_contraception: "current", last_period_start_date: ymd(todayN - 5) });
  eq(r.rendered, true, "CM-W24: contraception, the card still renders");
  eq(flavors(r.html).length, 0, "CM-W25: contraception, no phase flavor");
  eq(r.html.includes("dc-move"), false, "CM-W26: contraception, no movement row and no reason shown");
}
{ // amenorrheic: the gentle clinician line, no label, no workout
  const r = await render({ ...REGULAR, cycle_status: "amenorrheic" });
  ok(r.html.includes(CM.STATUS_LINES.raise_with_clinician), "CM-W27: amenorrhea, the clinician line renders");
  eq(r.html.includes("dc-move-label"), false, "CM-W28: amenorrhea, no 'Movement for today' label");
  eq(flavors(r.html).length, 0, "CM-W29: amenorrhea, no phase flavor");
}
{ // overdue and no date: NO row, because no control on this page can log a period (R8 held)
  const r = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 60) });
  eq(r.html.includes("dc-move"), false, "CM-W30: overdue, no row until a log-period control exists");
  eq(r.html.includes(CM.STATUS_LINES.log_period), false, "CM-W31: overdue, the log-period line is not shown");
  eq(flavors(r.html).length, 0, "CM-W32: overdue, no wrapped phase flavor");
  const r2 = await render({ ...REGULAR });
  eq(r2.html.includes("dc-move"), false, "CM-W33: no date, no row");
}
{ // failures stay unphased and never cost her the card
  const r = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 5) }, { profileError: true });
  eq(r.rendered, true, "CM-W34: a refused profile read still renders the card");
  eq(flavors(r.html).length + (r.html.includes("dc-move") ? 1 : 0), 0, "CM-W35: and leaves it unphased");
  const r2 = await render({ ...REGULAR, last_period_start_date: ymd(todayN - 5) }, { moduleFails: true });
  eq(r2.rendered, true, "CM-W36: a failed module load still renders the card");
  eq(flavors(r2.html).length + (r2.html.includes("dc-move") ? 1 : 0), 0, "CM-W37: and leaves it unphased");
}

// ── 5. stylesheet ────────────────────────────────────────────────────────────
eq((HTML.match(/^\.dc-move\{/gm) || []).length, 1, "CM-W38: exactly one .dc-move rule");
eq((HTML.match(/^\.dc-flavor\{/gm) || []).length, 1, "CM-W39: CONTROL, .dc-flavor is also defined once");

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
