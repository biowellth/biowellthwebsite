#!/usr/bin/env node
// FOOD_GUARD_V1 -- the daily card never shows red meat. The pool is passed through the shared guard before
// scheduling: a banned base_text drops the action, a banned phase note drops only that note. No diet is
// passed (phase 1), which reads as Vegetarian, so eggs, fish and chicken drop too.
//
// js/food-guard.js is byte-identical to supa supabase/functions/_shared/food-guard.js. The constant below
// is the SAME constant supa pins. Edit one copy without the other and that repository goes red.
//
// Sections:
//   1. pin, the import URL's cache key, and the supa copy when it is on disk
//   2. full renders through dcRenderDailyCard: the stored beef pattern is dropped, a vegetarian control
//      is kept, a red-meat phase note is dropped with its action kept, a failed guard load shows no card
//
//   node scripts/test-food-guard.mjs
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const GUARD_SHA256 = "91e0e2c82e79db58f4060f774d5aa0919255627ecbdf150af6f903a0a0545d34";
const GUARD_PATH = new URL("../js/food-guard.js", import.meta.url);
const SUPA_COPY = (process.env.SUPA_DIR || homedir() + "/Desktop/biowellth-backend-supa") + "/supabase/functions/_shared/food-guard.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

console.log("FOOD_GUARD_V1");
const HTML = readFileSync(process.env.DASH || new URL("../dashboard.html", import.meta.url), "utf8");
const FG = await import(GUARD_PATH);
const CM = await import(new URL("../js/cycle-movement.js", import.meta.url));
const PNG = await import(new URL("../js/phase-note-guard.js", import.meta.url));

// ── 1. pins ──────────────────────────────────────────────────────────────────
eq(sha(GUARD_PATH), GUARD_SHA256, "FG-W1: the guard is the pinned bytes, the same pin supa holds");
const src = (HTML.match(/const FG_SRC = '([^']+)'/) || [])[1];
eq(src, "/js/food-guard.js?v=" + GUARD_SHA256.slice(0, 8), "FG-W2: the import URL's cache key is the pinned guard's sha prefix");
if (existsSync(SUPA_COPY)) eq(sha(SUPA_COPY), GUARD_SHA256, "FG-W3: the supa copy on disk is the same bytes");
else console.log("  skip FG-W3: supa checkout not on disk (the pin above still binds both repos)");
eq(FG.foodCategory("Try including a source of iron-rich food, like beef, chicken, or tofu, at least once today.", null), "red_meat",
  "FG-W4 KNOWN POSITIVE: the stored beef pattern is red_meat");

// ── 2. renders ───────────────────────────────────────────────────────────────
const APP = extractApp(HTML, "dashboard.html")
  + "\n;globalThis.__setUser = (u) => { USER = u; }; globalThis.__getDc = () => __dcState;\n";

function boot(world) {
  const host = { _h: "", get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    querySelector: () => ({ textContent: "" }), querySelectorAll: () => [] };
  function q(table) {
    const result = () => world[table] ? world[table]() : { data: null, error: null };
    const chain = {
      select() { return chain; }, eq() { return chain; }, order() { return chain; }, limit() { return chain; },
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
  // a dynamic import cannot resolve inside the vm, so each loader is pointed at the real module
  ctx.dcLoadCycleMovement = async () => CM;
  ctx.dcLoadPhaseNoteGuard = async () => PNG;
  ctx.dcLoadFoodGuard = async () => (world.foodGuardFails ? null : FG);
  return { ctx, host };
}

const BEEF = "Try including a source of iron-rich food, like beef, chicken, or tofu, at least once today.";
const VEG = "Try a bowl of rajma with a squeeze of lemon at lunch.";
const RED_NOTE = "Red meat is a good pick on these days.";
const CLEAN_NOTE = "A warm bowl of dal can feel good right now.";
const REGULAR = { menstrual_status: "regular", typical_cycle_length_days: 28, typical_period_duration_days: 5 };

async function render(pool, opts = {}) {
  const day = new Date(); day.setDate(day.getDate() - 1);   // cycle day 2: menstrual
  const world = {
    action_pool: () => ({ data: pool, error: null }),
    profiles: () => ({ data: opts.profile ?? null, error: null }),
    reports: () => ({ data: { lmp_date_before_draw: null }, error: null }),
    action_completions: () => ({ data: [], error: null }),
    foodGuardFails: !!opts.foodGuardFails,
  };
  if (opts.profile) opts.profile.last_period_start_date = day.toISOString().slice(0, 10);
  const b = boot(world);
  const r = await b.ctx.dcRenderDailyCard({ priorities: [] }, "rep-1");
  return { rendered: r, html: b.host.innerHTML };
}

eq(typeof boot({}).ctx.dcLoadFoodGuard, "function", "FG-W5: REACHABILITY, dcLoadFoodGuard is in the app block");

{ // the stored beef pattern beside a vegetarian control
  const pool = [
    { action_id: "ferritin_a1", priority_marker_id: "ferritin", base_text: BEEF, phase_notes: null },
    { action_id: "ferritin_a2", priority_marker_id: "ferritin", base_text: VEG, phase_notes: null },
  ];
  const r = await render(pool);
  eq(r.rendered, true, "FG-W6: the card renders with the vegetarian action");
  eq(r.html.includes("beef"), false, "FG-W7: the stored beef action is NOT shown");
  eq(r.html.includes("rajma"), true, "FG-W8 CONTROL: the vegetarian action IS shown");
}

{ // a pool holding only banned actions shows no card
  const r = await render([
    { action_id: "iron_serum_a2", priority_marker_id: "iron_serum", base_text: "Consider including red meat, chicken, or fish in your meals.", phase_notes: null },
    { action_id: "zinc_a1", priority_marker_id: "zinc", base_text: "Try including zinc-rich foods like pumpkin seeds, red meat, or chickpeas in a meal today.", phase_notes: null },
  ]);
  eq(r.rendered, false, "FG-W9: every action banned, no card");
}

{ // a red-meat phase note is dropped, its action stays, a clean note on another action shows
  const pool = [
    { action_id: "hemoglobin_a1", priority_marker_id: "hemoglobin", base_text: VEG, phase_notes: { menstrual: RED_NOTE } },
    { action_id: "hemoglobin_a2", priority_marker_id: "hemoglobin", base_text: "Try ragi at breakfast.", phase_notes: { menstrual: CLEAN_NOTE } },
  ];
  const r = await render(pool, { profile: { ...REGULAR } });
  eq(r.rendered, true, "FG-W10: the card renders");
  eq(/red meat/i.test(r.html), false, "FG-W11: the red-meat phase note is NOT shown");
  eq(r.html.includes("rajma") && r.html.includes("ragi"), true, "FG-W12: both actions stay");
  eq(r.html.includes(CLEAN_NOTE), true, "FG-W13 CONTROL: the clean menstrual note IS shown, so notes were reachable");
}

{ // the guard fails to load: no card, never unchecked actions
  const r = await render([{ action_id: "a1", priority_marker_id: "ferritin", base_text: VEG, phase_notes: null }], { foodGuardFails: true });
  eq(r.rendered, false, "FG-W14: no guard, no card");
  eq(r.html, "", "FG-W15: nothing rendered");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
