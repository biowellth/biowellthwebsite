#!/usr/bin/env node
// CYCLE_CARD_V1 -- the cycle card, booted from the real app block with a fake supabase client.
//
// Founder rulings 2026-10-12 pinned here:
//   - every state shows the shared module's own line, and the module's four phase labels only;
//   - no ovulation state, label or text anywhere in the card's output;
//   - the hidden states (pregnancy, postmenopause, contraception, hormone therapy, perimenopause,
//     PCOS, and the rest) render NOTHING and never name a reason;
//   - "Log period" sends exactly { mode: "log_period", last_period_start_date } to process-report,
//     re-renders this card and the daily card on success, and shows ONE calm line on invalid_date;
//   - phone host after Sana, desktop host at the top of the rail.
//
//   node scripts/test-cycle-card.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);

console.log("CYCLE_CARD_V1");
const HTML = readFileSync(process.env.DASH || new URL("../dashboard.html", import.meta.url), "utf8");
const CM = await import(new URL("../js/cycle-movement.js", import.meta.url));
const APP = extractApp(HTML, "dashboard.html")
  + "\n;globalThis.__setUser = (u) => { USER = u; }; globalThis.__getCy = () => __cy;\n";

function localTodayN() { const n = new Date(); return Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000); }
const ymd = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
const T = localTodayN();
const ago = (n) => ymd(T - n);

function mkHost() {
  const cls = new Set(["hidden"]);
  return {
    _h: "", get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; },
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle() {}, contains: (c) => cls.has(c) },
    querySelector: () => null, querySelectorAll: () => [], hidden: () => cls.has("hidden"),
  };
}

function boot(world) {
  const calls = [], invokes = [];
  const hosts = { "cycle-card-rail": mkHost(), "cycle-card-main": mkHost(), "daily-card": mkHost() };
  function q(table) {
    const rec = { table, cols: null };
    calls.push(rec);
    const result = () => (world[table] ? world[table](rec) : { data: null, error: null });
    const chain = {
      select(c) { rec.cols = c; return chain; }, eq() { return chain; }, order() { return chain; }, limit() { return chain; },
      maybeSingle: async () => result(), single: async () => result(),
      then(res, rej) { return Promise.resolve(result()).then(res, rej); },
      insert: async () => ({ error: null }), delete() { return chain; },
    };
    return chain;
  }
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, dataset: {},
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, appendChild() {}, querySelector: () => null,
    querySelectorAll: () => [], textContent: "", innerHTML: "", value: "" });
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    document: { getElementById: (id) => hosts[id] || el(), querySelector: () => el(), querySelectorAll: () => [],
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
      from: (t) => q(t),
      functions: { invoke: async (name, opts) => { invokes.push({ name, opts }); return world.invoke ? world.invoke(name, opts) : { data: null, error: null }; } },
      storage: { from: () => ({}) }, rpc: async () => ({}),
    }) },
  };
  ctx.globalThis = ctx; ctx.self = ctx; Object.assign(ctx.window, ctx);
  vm.createContext(ctx);
  new vm.Script(APP).runInContext(ctx);
  ctx.__setUser({ id: "00000000-0000-4000-8000-000000000002" });
  ctx.dcLoadCycleMovement = async () => CM;   // a dynamic import cannot resolve inside the vm
  return { ctx, hosts, calls, invokes };
}

const REG = { menstrual_status: "regular", typical_cycle_length_days: 28, typical_period_duration_days: 5 };
const POOL = [{ action_id: "a1", priority_marker_id: "ferritin", base_text: "Try lentils at lunch.", phase_notes: null }];

function world(profileRef, extra = {}) {
  return {
    profiles: () => (extra.profileError ? { data: null, error: { code: "42501" } } : { data: { ...profileRef.p }, error: null }),
    reports: () => ({ data: { lmp_date_before_draw: extra.reportLmp ?? null }, error: null }),
    action_pool: () => ({ data: POOL, error: null }),
    action_completions: () => ({ data: [], error: null }),
    ...extra,
  };
}
async function render(profile, extra = {}) {
  const ref = { p: profile };
  const b = boot(world(ref, extra));
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  return { ...b, ref, rail: b.hosts["cycle-card-rail"], main: b.hosts["cycle-card-main"] };
}

// ── reachability ─────────────────────────────────────────────────────────────
{
  const b = boot({});
  eq(typeof b.ctx.cyRenderCard, "function", "CC-1 REACHABILITY: cyRenderCard is in the app block");
  eq(typeof b.ctx.cyLogPeriod, "function", "CC-2 REACHABILITY: cyLogPeriod is in the app block");
}

// ONE JOB PER CARD (2026-10-12): no movement line on this card, ever; the estimate note lives here.
const ALL_MOVE_LINES = Object.values(CM.MOVEMENT_LINES).flatMap((t) => Object.values(t));
const ESTIMATE_NOTE = "An estimate from the period date you gave us";
const moveLinesIn = (h) => ALL_MOVE_LINES.filter((l) => h.includes(l)).length;
ok(ALL_MOVE_LINES.length >= 7, `CC-44 CONTROL: the module exports ${ALL_MOVE_LINES.length} movement lines to look for`);

// ── each visible state shows the module's own words ──────────────────────────
const VISIBLE = [
  ["menstrual", { ...REG, last_period_start_date: ago(1) }],
  ["follicular", { ...REG, last_period_start_date: ago(6) }],
  ["follicular in the estimated ovulation window", { ...REG, last_period_start_date: ago(13) }],
  ["early luteal", { ...REG, last_period_start_date: ago(17) }],
  ["late luteal", { ...REG, last_period_start_date: ago(24) }],
];
for (const [name, prof] of VISIBLE) {
  const r = await render(prof);
  const want = CM.resolveCycleMovement(prof, { today: ymd(T) });
  const h = r.rail.innerHTML;
  eq(moveLinesIn(h), 0, `CC-3 ${name}: no movement line on the cycle card (one job per card)`);
  ok(h.includes(ESTIMATE_NOTE), `CC-45 ${name}: the estimate note is on the cycle card`);
  ok(h.includes('<span class="cy-est">estimated</span>'), `CC-46 ${name}: next period marked estimated`);
  ok(h.includes(">" + want.phaseLabel + "<"), `CC-4 ${name}: the module's phase label (${want.phaseLabel})`);
  ok(h.includes("Day " + want.cycleDay + "<") && h.includes("of ~" + want.cycleLength), `CC-5 ${name}: Day ${want.cycleDay} of ~${want.cycleLength}`);
  ok(h.includes('data-cy="open"'), `CC-6 ${name}: a Log period control`);
  eq(/ovulat/i.test(h), false, `CC-7 ${name}: no ovulation text in the card`);
  eq(r.main.innerHTML, h, `CC-8 ${name}: the phone host carries the same card`);
  eq(r.rail.hidden() || r.main.hidden(), false, `CC-9 ${name}: both hosts un-hidden (CSS shows one)`);
}
{
  const want = CM.resolveCycleMovement({ ...REG, last_period_start_date: ago(13) }, { today: ymd(T) });
  ok(want.inOvulationWindow === true, "CC-10 CONTROL: the window case really is inside the module's window");
  const labels = new Set(Object.values(CM.PHASE_LABELS));
  ok([...labels].every((l) => !/ovulat/i.test(l)), "CC-11 CONTROL: the module's four labels carry no ovulation word");
}

// overdue and no date: the module's line 8 and the control; period stopped: line 10, no control
{
  const r1 = await render({ ...REG, last_period_start_date: ago(40) });
  ok(r1.rail.innerHTML.includes(CM.STATUS_LINES.log_period), "CC-12 overdue: the module's log-period line");
  ok(r1.rail.innerHTML.includes('data-cy="open"'), "CC-13 overdue: a Log period control");
  eq(r1.rail.innerHTML.includes("Day "), false, "CC-14 overdue: no wrapped cycle day");
  const r2 = await render({ ...REG });
  ok(r2.rail.innerHTML.includes(CM.STATUS_LINES.log_period), "CC-15 no date: the module's log-period line");
  const r3 = await render({ ...REG, cycle_status: "amenorrheic" });
  ok(r3.rail.innerHTML.includes(CM.STATUS_LINES.raise_with_clinician), "CC-16 period stopped: the module's clinician line");
  eq(moveLinesIn(r1.rail.innerHTML + r2.rail.innerHTML + r3.rail.innerHTML), 0, "CC-47 overdue, no date, period stopped: no movement line either");
  eq(r3.rail.innerHTML.includes('data-cy="open"'), false, "CC-17 period stopped: no Log period control, no plan");
}

// ── hidden states render NOTHING ─────────────────────────────────────────────
const HIDDEN = [
  ["pregnant", { ...REG, pregnant_or_postpartum_within_6_months: true, last_period_start_date: ago(6) }],
  ["postmenopausal", { ...REG, menstrual_status: "postmenopausal", last_period_start_date: ago(6) }],
  ["hormonal contraception", { ...REG, hormonal_contraception: "current", last_period_start_date: ago(6) }],
  ["hormone therapy", { ...REG, hormone_therapy_status: "yes", last_period_start_date: ago(6) }],
  ["perimenopause", { ...REG, menstrual_status: "perimenopausal", last_period_start_date: ago(6) }],
  ["PCOS", { ...REG, cycle_status: "pcos", last_period_start_date: ago(6) }],
  ["cycle length missing", { menstrual_status: "regular", last_period_start_date: ago(6) }],
];
for (const [name, prof] of HIDDEN) {
  const r = await render(prof);
  eq(r.rail.innerHTML + r.main.innerHTML, "", `CC-18 ${name}: nothing rendered in either host`);
  ok(r.rail.hidden() && r.main.hidden(), `CC-19 ${name}: both hosts hidden`);
}
{
  const r = await render({ ...REG, last_period_start_date: ago(6) }, { profileError: true });
  eq(r.rail.innerHTML, "", "CC-20 a refused profile read renders nothing");
  const c = await render({ ...REG, last_period_start_date: ago(6) });
  ok(c.rail.innerHTML.length > 0, "CC-21 CONTROL: the same profile without the hidden reason does render");
}

// ── Log period ───────────────────────────────────────────────────────────────
{
  const ref = { p: { ...REG, last_period_start_date: ago(40) } };
  const NEW = ago(2);
  const w = world(ref, {
    invoke: (name, opts) => { ref.p = { ...ref.p, last_period_start_date: opts.body.last_period_start_date }; return { data: { ok: true, mode: "log_period", last_period_start_date: NEW }, error: null }; },
  });
  const b = boot(w);
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  ok(b.hosts["cycle-card-rail"].innerHTML.includes(CM.STATUS_LINES.log_period), "CC-22 CONTROL: overdue before logging");
  const poolReadsBefore = b.calls.filter((c) => c.table === "action_pool").length;
  const out = await b.ctx.cyLogPeriod(NEW);
  eq(out, "ok", "CC-23 the log succeeds");
  eq(b.invokes.length, 1, "CC-24 exactly one call");
  eq(b.invokes[0].name, "process-report", "CC-25 to process-report");
  eq(JSON.stringify(b.invokes[0].opts), JSON.stringify({ body: { mode: "log_period", last_period_start_date: NEW } }),
     "CC-26 the body is EXACTLY { mode, last_period_start_date }");
  const want = CM.resolveCycleMovement({ ...ref.p }, { today: ymd(T) });
  ok(b.hosts["cycle-card-rail"].innerHTML.includes("Day " + want.cycleDay + "<"), `CC-27 the card re-rendered from the new date (Day ${want.cycleDay})`);
  ok(b.calls.filter((c) => c.table === "action_pool").length > poolReadsBefore, "CC-28 the daily card re-rendered too");
}
{
  const ref = { p: { ...REG, last_period_start_date: ago(40) } };
  const b = boot(world(ref, {
    invoke: () => ({ data: null, error: { name: "FunctionsHttpError", context: { json: async () => ({ ok: false, mode: "log_period", error: "invalid_date" }) } } }),
  }));
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  eq(await b.ctx.cyLogPeriod(ago(-3)), "invalid_date", "CC-29 a refused date reads as invalid_date");
  const h = b.hosts["cycle-card-rail"].innerHTML;
  ok(h.includes("That date is later than today. Choose the day your last period started."), "CC-30 the calm inline message shows");
  eq(h.includes("That did not save"), false, "CC-31 and not the generic retry line");
  ok(h.includes('class="cy-log open"'), "CC-32 the date field stays open to correct it");
  eq(b.calls.filter((c) => c.table === "action_pool").length, 0, "CC-33 nothing re-rendered for a refused date");
}
{
  const ref = { p: { ...REG, last_period_start_date: ago(40) } };
  const b = boot(world(ref, { invoke: () => { throw new Error("network down"); } }));
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  eq(await b.ctx.cyLogPeriod(ago(2)), "failed", "CC-34 a network failure reads as failed");
  const h = b.hosts["cycle-card-rail"].innerHTML;
  ok(h.includes("That did not save. Try again in a moment."), "CC-35 the one generic retry line");
  eq(h.includes("later than today"), false, "CC-36 and not the invalid-date line");
}

// ── placement and copy ───────────────────────────────────────────────────────
{
  const iSana = HTML.indexOf('<div class="companion" id="companion">');
  const iMain = HTML.indexOf('id="cycle-card-main"');
  const iDaily = HTML.indexOf('<div class="daily-card hidden" id="daily-card">');
  ok(iSana > 0 && iSana < iMain && iMain < iDaily, "CC-37 phone host sits AFTER Sana and before the daily card");
  const iRail = HTML.indexOf('<div class="dash-rail">');
  const iRailHost = HTML.indexOf('id="cycle-card-rail"');
  const iLongi = HTML.indexOf('<div id="longi-wrap" class="hidden">');
  ok(iRail > 0 && iRail < iRailHost && iRailHost < iLongi, "CC-38 desktop host is the first thing in the rail");
  ok(/@media\(max-width:960px\)\{ \.cy-host-rail\{display:none\} \.cy-host-main:not\(\.hidden\)\{display:block/.test(HTML), "CC-39 the media query shows exactly one host");
  ok(/dcRenderDailyCard\(p, reportId\);\s*\n\s*cyRenderCard\(p, reportId\);/.test(HTML), "CC-40 renderDashboard renders the cycle card beside the daily card");
  const copy = (HTML.match(/const CY_COPY = \{[\s\S]*?\n\};/) || [""])[0];
  ok(copy.length > 100, "CC-41 CONTROL: CY_COPY found");
  const strings = [...copy.matchAll(/:\s*'([^']*)'/g)].map((m) => m[1]);
  eq(strings.filter((t) => /[:—!]|should|must|ovulat|deplet|drain|many women/i.test(t)).length, 0, "CC-42 no colon, em dash, exclamation, ovulation or banned word in the card's own copy");
  const cardCode = HTML.slice(HTML.indexOf("// CYCLE_CARD_V1 — her cycle day"), HTML.indexOf("// DAILY_CARD_LATE_POOL_V1 — bounded secondary poll"))
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  ok(cardCode.includes("function cyCardHTML"), "CC-43a CONTROL: the card's code was found");
  eq(/ovulat|inOvulationWindow/i.test(cardCode), false, "CC-43 the card's code (comments aside) never reads or names ovulation");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
