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
  + "\n;globalThis.__setUser = (u) => { USER = u; }; globalThis.__getCy = () => __cy; globalThis.__getCopy = () => CY_COPY;\n";

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
      select(c) { rec.cols = c; return chain; }, update(u) { rec.update = u; return chain; }, eq() { return chain; }, order() { return chain; }, limit() { return chain; },
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
    profiles: (rec) => {
      if (rec && rec.update) {
        if (extra.updateError) return { data: null, error: { code: "42501" } };
        profileRef.p = { ...profileRef.p, ...rec.update };
        return { data: null, error: null };
      }
      return extra.profileError ? { data: null, error: { code: "42501" } } : { data: { ...profileRef.p }, error: null };
    },
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

// overdue: CYCLE_CARD_DAYCOUNT_V1 replaced the log-period line with the day count (2026-10-18);
// no date: the module's line 8 and the control; period stopped: line 10, no control
{
  const r1 = await render({ ...REG, last_period_start_date: ago(40) });
  ok(r1.rail.innerHTML.includes("Day 41<") && r1.rail.innerHTML.includes("since your last period"), "CC-12 overdue: Day 41 since your last period");
  ok(r1.rail.innerHTML.includes('data-cy="open"'), "CC-13 overdue: a Log period control");
  eq(r1.rail.innerHTML.includes("of ~"), false, "CC-14 overdue: no wrapped cycle day, no Day N of ~L");
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
  // "cycle length missing" left this list on 2026-10-18: CYCLE_CARD_DAYCOUNT_V1 shows it (CC-50 on).
  // out_of_range_inputs with no date left it the same day: it gets the live Log period card (CC-88).
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
  ok(b.hosts["cycle-card-rail"].innerHTML.includes("Day 41<"), "CC-22 CONTROL: overdue (day count) before logging");
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
  // CC-39 PINNED THE 960px MEDIA QUERY UNTIL 2026-10-13. DASHBOARD_V2_DESIGN made the dashboard one
  // column at every width, so the card sits after Sana everywhere: the main host shows whenever it
  // is filled and the rail host never does. Still exactly one host on screen, now at every width.
  ok(/\n\.cy-host-rail\{display:none\}\n\.cy-host-main:not\(\.hidden\)\{display:block/.test(HTML), "CC-39 exactly one host shows, the main one, at every width (no media query)");
  ok(!/@media\(max-width:960px\)\{ \.cy-host-rail\{display:none\}/.test(HTML), "CC-39b the 960px-only placement is gone, so the rail host cannot reappear on desktop");
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

// ── CYCLE_CARD_DAYCOUNT_V1 (2026-10-18) ─────────────────────────────────────
// Every case first asks the module for its own result (the CONTROL), then checks the card shows it.
const LONG = "A cycle this long is worth looking into with a clinician.";
const SINCE = "since your last period";
const resolve = (prof) => CM.resolveCycleMovement(prof, { today: ymd(T) });
const NOLEN = { menstrual_status: "regular" };

// 1. cycle_length_unknown with a date: day count and the cycle-length link, no Log period, no line.
{
  const prof = { ...NOLEN, last_period_start_date: ago(9) };
  const want = resolve(prof);
  ok(want.reason === "cycle_length_unknown" && want.daysSince === 9, `CC-48 CONTROL: the module gives cycle_length_unknown, daysSince 9 (got ${want.reason}, ${want.daysSince})`);
  const r = await render(prof);
  const h = r.rail.innerHTML;
  ok(h.includes("Day 10<") && h.includes(SINCE), "CC-50 no cycle length, with a date: Day 10 since your last period (daysSince + 1)");
  ok(h.includes('data-cy="len-open"') && h.includes(">Add your usual cycle length<"), "CC-51 the small Add your usual cycle length link");
  ok(h.includes('data-cy="open"') && h.includes(">Log period<"), "CC-52 the Log period button on this state (2026-10-18 ruling)");
  ok(h.indexOf('data-cy="len-open"') > 0 && h.indexOf('data-cy="len-open"') < h.indexOf('data-cy="open"'), "CC-52b the Log period button sits below the cycle-length link");
  eq(/not sure|unsure/i.test(h), false, "CC-53 no Not sure button");
  eq(h.includes("data-cy-len="), false, "CC-54 the ask stays closed until the link is tapped");
  eq(h.includes(LONG), false, "CC-55 no clinician line on this state");
  eq(r.main.innerHTML, h, "CC-56 the phone host carries the same card");
  const g = r.ctx.__getCy();
  g.len = { open: true, sel: null, msg: null }; r.ctx.cyPaint();
  const o = r.rail.innerHTML;
  const chips = [...o.matchAll(/data-cy-len="(\d+)"/g)].map((m) => Number(m[1]));
  eq(JSON.stringify(chips), JSON.stringify([24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]), "CC-57 opened, the ask offers 24 to 35");
  ok(o.includes('data-cy="len"') && o.includes('min="15"') && o.includes('max="90"'), "CC-58 opened, a type-in field bounded 15 to 90");
  ok(o.includes('data-cy="len-save"'), "CC-59 opened, a Save control");
  eq(/not sure|unsure/i.test(o), false, "CC-60 opened, still no Not sure");
  g.len = { open: true, sel: 30, msg: null }; r.ctx.cyPaint();
  ok(r.rail.innerHTML.includes('class="cy-chip sel" type="button" data-cy-len="30" aria-pressed="true"'), "CC-61 a tapped chip shows selected");
  const prof50 = { ...NOLEN, last_period_start_date: ago(49) };
  ok(resolve(prof50).daysSince === 49, "CC-62 CONTROL: the module gives daysSince 49");
  const r50 = await render(prof50);
  ok(r50.rail.innerHTML.includes("Day 50<") && !r50.rail.innerHTML.includes(LONG), "CC-63 no cycle length at Day 50: still no clinician line (that line is for states 3 only)");
}

// 1b. saving the cycle length: ONE write of exactly { typical_cycle_length_days }, then re-render.
{
  const ref = { p: { ...NOLEN, last_period_start_date: ago(9) } };
  const b = boot(world(ref));
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  ok(b.hosts["cycle-card-rail"].innerHTML.includes(SINCE), "CC-64 CONTROL: the day-count card before saving");
  const poolBefore = b.calls.filter((c) => c.table === "action_pool").length;
  eq(await b.ctx.cySaveCycleLength(28), "ok", "CC-65 the save succeeds");
  const ups = b.calls.filter((c) => c.update);
  eq(ups.length, 1, "CC-66 exactly one write");
  eq(ups[0].table, "profiles", "CC-67 to profiles, through onb2Write");
  eq(JSON.stringify(ups[0].update), JSON.stringify({ typical_cycle_length_days: 28 }), "CC-68 the patch is EXACTLY { typical_cycle_length_days }");
  const h = b.hosts["cycle-card-rail"].innerHTML;
  const want = resolve(ref.p);
  ok(want.status === "phase" && h.includes("Day " + want.cycleDay + "<") && h.includes("of ~28"), `CC-69 the card re-rendered as the phase card (Day ${want.cycleDay} of ~28)`);
  ok(b.calls.filter((c) => c.table === "action_pool").length > poolBefore, "CC-70 the daily card re-rendered too");
  eq(await b.ctx.cySaveCycleLength(" 31 "), "ok", "CC-71 a typed value with spaces saves (onb2Int trims)");
}
{
  const ref = { p: { ...NOLEN, last_period_start_date: ago(9) } };
  const NEW = ago(2);
  const b = boot(world(ref, { invoke: (name, opts) => { ref.p = { ...ref.p, last_period_start_date: opts.body.last_period_start_date }; return { data: { ok: true, mode: "log_period", last_period_start_date: NEW }, error: null }; } }));
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  ok(b.hosts["cycle-card-rail"].innerHTML.includes("Day 10<"), "CC-71a CONTROL: Day 10 before logging");
  eq(await b.ctx.cyLogPeriod(NEW), "ok", "CC-71b no cycle length: Log period succeeds");
  eq(JSON.stringify(b.invokes[0].opts), JSON.stringify({ body: { mode: "log_period", last_period_start_date: NEW } }), "CC-71c the body is EXACTLY { mode, last_period_start_date }");
  const h = b.hosts["cycle-card-rail"].innerHTML;
  ok(h.includes("Day 3<") && h.includes(SINCE) && h.includes('data-cy="len-open"'), "CC-71d re-rendered from the new date as the same state (Day 3, link still there)");
}
for (const [v, want] of [["12", "invalid"], ["91", "invalid"], ["abc", "invalid"], ["", "invalid"], ["15", "ok"], ["90", "ok"]]) {
  const ref = { p: { ...NOLEN, last_period_start_date: ago(9) } };
  const b = boot(world(ref));
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  eq(await b.ctx.cySaveCycleLength(v), want, `CC-72 ${JSON.stringify(v)} reads as ${want} (onb2Int 15 to 90)`);
  eq(b.calls.filter((c) => c.update).length, want === "ok" ? 1 : 0, `CC-73 ${JSON.stringify(v)}: ${want === "ok" ? "one write" : "no write"}`);
  if (want === "invalid") ok(b.hosts["cycle-card-rail"].innerHTML.includes("Choose a number of days from 15 to 90.") && b.hosts["cycle-card-rail"].innerHTML.includes('data-cy="len-save"'), `CC-74 ${JSON.stringify(v)}: the calm range line, ask still open`);
}
{
  const ref = { p: { ...NOLEN, last_period_start_date: ago(9) } };
  const b = boot(world(ref, { updateError: true }));
  await b.ctx.cyRenderCard({ priorities: [] }, "rep-1");
  eq(await b.ctx.cySaveCycleLength(28), "failed", "CC-75 a refused write reads as failed");
  const h = b.hosts["cycle-card-rail"].innerHTML;
  ok(h.includes("That did not save. Try again in a moment.") && h.includes('data-cy="len-save"'), "CC-76 the retry line, ask still open");
  eq(b.calls.filter((c) => c.table === "action_pool").length, 0, "CC-77 nothing re-rendered for a refused write");
}

// 2. cycle_length_unknown with no date: the live Log period card.
{
  const want = resolve(NOLEN);
  ok(want.reason === "cycle_length_unknown" && want.daysSince === null, "CC-78 CONTROL: the module gives cycle_length_unknown, daysSince null");
  eq(r_copy().logLine, CM.STATUS_LINES.log_period, "CC-49 the card's logLine is the module's STATUS_LINES.log_period word for word");
  const r = await render(NOLEN);
  const live = await render({ ...REG });
  ok(resolve({ ...REG }).reason === "lmp_unknown", "CC-79 CONTROL: REG with no date is the live log_period/lmp_unknown card");
  eq(r.rail.innerHTML, live.rail.innerHTML, "CC-80 no cycle length, no date: byte-identical to the live Log period card");
  eq(r.rail.innerHTML.includes(SINCE) || r.rail.innerHTML.includes("len-open"), false, "CC-81 no day count, no cycle-length link");
}
function r_copy() { return boot({}).ctx.__getCopy(); }

// 3. out_of_range_inputs and overdue: day count, Log period, the line ONLY when N > 35.
const THREE = [
  // [name, profile, reason, N, line?]
  ["cycle length 40, Day 21", { ...REG, typical_cycle_length_days: 40, last_period_start_date: ago(20) }, "out_of_range_inputs", 21, false],
  ["cycle length 40, Day 35", { ...REG, typical_cycle_length_days: 40, last_period_start_date: ago(34) }, "out_of_range_inputs", 35, false],
  ["cycle length 40, Day 36", { ...REG, typical_cycle_length_days: 40, last_period_start_date: ago(35) }, "out_of_range_inputs", 36, true],
  ["cycle length 40, Day 41", { ...REG, typical_cycle_length_days: 40, last_period_start_date: ago(40) }, "out_of_range_inputs", 41, true],
  ["period length 20, Day 12", { ...REG, typical_period_duration_days: 20, last_period_start_date: ago(11) }, "out_of_range_inputs", 12, false],
  ["period length 20, Day 60", { ...REG, typical_period_duration_days: 20, last_period_start_date: ago(59) }, "out_of_range_inputs", 60, true],
  ["overdue at 24, Day 33", { ...REG, typical_cycle_length_days: 24, last_period_start_date: ago(32) }, "overdue", 33, false],
  ["overdue at 28, Day 36", { ...REG, last_period_start_date: ago(35) }, "overdue", 36, true],
  ["overdue at 28, Day 41", { ...REG, last_period_start_date: ago(40) }, "overdue", 41, true],
];
for (const [name, prof, reason, n, line] of THREE) {
  const want = resolve(prof);
  ok(want.reason === reason && want.daysSince + 1 === n, `CC-82 CONTROL ${name}: the module gives ${reason}, daysSince ${n - 1} (got ${want.reason}, ${want.daysSince})`);
  const r = await render(prof);
  const h = r.rail.innerHTML;
  ok(h.includes("Day " + n + "<") && h.includes(SINCE), `CC-83 ${name}: Day ${n} since your last period`);
  ok(h.includes('data-cy="open"') && h.includes(">Log period<"), `CC-84 ${name}: the Log period button`);
  eq(h.includes(LONG), line, `CC-85 ${name}: clinician line ${line ? "SHOWS (N > 35)" : "absent (N <= 35)"}`);
  eq(h.includes("of ~") || h.includes("cy-bar") || h.includes("len-open"), false, `CC-86 ${name}: no phase strip, no Day N of ~L, no cycle-length link`);
  eq(moveLinesIn(h), 0, `CC-87 ${name}: no movement line`);
}
// out_of_range_inputs with no date: the live Log period card, byte-identical (2026-10-18 ruling).
{
  const live = await render({ ...REG });
  ok(resolve({ ...REG }).reason === "lmp_unknown" && live.rail.innerHTML.includes(CM.STATUS_LINES.log_period), "CC-88 CONTROL: the live log_period/lmp_unknown card renders its line");
  for (const [name, prof] of [["period length 20", { ...REG, typical_period_duration_days: 20 }], ["cycle length 40", { ...REG, typical_cycle_length_days: 40 }]]) {
    const want = resolve(prof);
    ok(want.reason === "out_of_range_inputs" && want.daysSince === null, `CC-88a CONTROL ${name}, no date: the module gives out_of_range_inputs, daysSince null`);
    const r = await render(prof);
    eq(r.rail.innerHTML, live.rail.innerHTML, `CC-88b ${name}, no date: byte-identical to the live Log period card`);
    eq(r.main.innerHTML, live.main.innerHTML, `CC-88c ${name}, no date: the phone host too`);
    ok(!r.rail.hidden() && !r.main.hidden(), `CC-88d ${name}, no date: the hosts are shown`);
  }
  const other = await render({ ...REG, typical_cycle_length_days: 40, last_period_start_date: ago(20) });
  ok(other.rail.innerHTML !== live.rail.innerHTML, "CC-88e CONTROL: the byte-identity test tells a different card apart (out of range WITH a date)");
}

// 4. unchanged states carry none of the new pieces.
{
  const ph = await render({ ...REG, last_period_start_date: ago(6) });
  const lu = await render({ ...REG });
  const ra = await render({ ...REG, cycle_status: "amenorrheic" });
  for (const [name, r] of [["phase", ph], ["log_period/lmp_unknown", lu], ["raise_with_clinician", ra]]) {
    eq(r.rail.innerHTML.includes(SINCE) || r.rail.innerHTML.includes(LONG) || r.rail.innerHTML.includes("len-open"), false, `CC-89 ${name}: no day count, clinician line or cycle-length link`);
  }
  ok(ph.rail.innerHTML.includes("of ~28") && lu.rail.innerHTML.includes(CM.STATUS_LINES.log_period) && ra.rail.innerHTML.includes(CM.STATUS_LINES.raise_with_clinician), "CC-90 CONTROL: the three unchanged states still render their own content");
}

// copy and palette for the new pieces, each with a planted control that fires.
{
  const c = r_copy();
  const NEW_KEYS = ["logLine", "since", "long", "lenLink", "lenAsk", "lenHelp", "lenType", "lenDays", "lenGroup", "lenInvalid"];
  const vals = NEW_KEYS.map((k) => c[k]);
  ok(vals.every((v) => typeof v === "string" && v.length > 0), "CC-91 CONTROL: every new copy key is present");
  const BANNED = /[:—!]|\bcommon\b|many women|most women|\bnormal\b|\bfertil|conceiv|pregnan|ovulat|pcos|polycystic|amenorrh|endometri|menopaus|thyroid|disorder|syndrome|diagnos|condition/i;
  eq(vals.filter((v) => BANNED.test(v)).length, 0, "CC-92 new copy: no colon, em dash, exclamation, prevalence, fertility, diagnosis or condition word");
  ok(["Common for many women — see PCOS", "Fertile window: day 14"].every((t) => BANNED.test(t)), "CC-93 CONTROL: the banned-word test fires on planted text");
  const css = HTML.slice(HTML.indexOf("/* CYCLE_CARD_DAYCOUNT_V1"), HTML.indexOf(".comp-head{"));
  ok(css.includes(".cy-chip.sel{") && css.includes("var(--olive)"), "CC-94 CONTROL: the new CSS block was found");
  eq(/teal/i.test(css), false, "CC-95 the new CSS names no teal token");
  ok(/teal/i.test(HTML.slice(HTML.indexOf("/* REVEAL_PALETTE_V1: the teal tokens"), HTML.indexOf(".cy-btn{"))), "CC-96 CONTROL: the teal test fires on the comment just above it");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
