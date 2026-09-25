#!/usr/bin/env node
// BOOT_RESUME_POLL_V1 + DDC_AT_REVEAL_V1 -- what happens when a first result lands.
//
// THE TWO DEFECTS IT PINS, both found by the first-account walkthrough map (2026-09-21):
//   (A) Boot had no branch for a report still in flight. pollForResult was started only by the
//       upload path and the retry button, so a reload mid-reading landed on the upload card or the
//       companion while transcription was still running, with no progress and no reveal.
//   (B) The draw-date confirm beat was mounted only from navigateAfterSubmit. On a first upload she
//       taps "Start my reading" while Call A is still running, so collected_on does not exist yet,
//       the beat does not render, and nothing asked again when the result landed.
//
// HOW. The REAL app block (extractApp) is booted in a vm against a fake Supabase and a DOM that
// tracks exactly what these fixes depend on: which view is visible, which intervals are armed, and
// where the ONE #ddc-wrap node lives. Everything else is permissive scenery, so only a real error
// surfaces. Every value is invented; no real report is read.
//
// ACTIVE POLLS are counted as 3000ms intervals armed and not cleared, which is how pollForResult
// and pcResumePoll both poll. A count, not a flag, so "exactly one" can fail in both directions.
//
//   node scripts/test-first-upload-resume.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const SRC = extractApp(readFileSync(FILE, "utf8"), FILE);

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

const VIEWS = ["upload", "processing", "pending", "reveal", "dashboard", "interim", "companion"];   // REVIEW_GATE_V1 adds pending
const BEAT = "Your panel was from";

// ── DOM ────────────────────────────────────────────────────────────────────────────────────────
// parentNode always holds the PROXY, never the raw target, so identity checks in the app
// (wrap.parentNode !== slot) and in these assertions compare like with like.
const STYLE_FNS = { setProperty() {}, removeProperty() {}, getPropertyValue() { return ""; } };
// Untracked elements hang off a scenery parent, so code that swaps a node in place
// (parentNode.replaceChild) runs rather than throwing on a null parent.
const SCENERY = { _children: [], replaceChild() {}, removeChild() {}, appendChild() {}, insertBefore() {} };
function mkEl(id) {
  const cls = new Set();
  let html = "";
  let self = null;
  const el = {
    id, parentNode: SCENERY, _children: [], _beatRenders: 0,
    style: new Proxy({}, { get: (_, k) => (k in STYLE_FNS ? STYLE_FNS[k] : ""), set: () => true }),
    classList: {
      add: (...c) => c.forEach((x) => cls.add(x)),
      remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      contains: (c) => cls.has(c),
    },
    dataset: {}, value: "", textContent: "", checked: false, disabled: false, options: [],
    get children() { return el._children; },
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); if (html.includes(BEAT)) el._beatRenders++; },
    appendChild(c) { detach(c); c.parentNode = self; el._children.push(c); return c; },
    after(n) { const p = el.parentNode; detach(n); n.parentNode = p; if (p) p._children.push(n); },
    removeChild() {}, remove() {}, setAttribute() {}, removeAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, scrollIntoView() {}, click() {},
    querySelector() { return mkEl(); }, querySelectorAll() { return []; }, closest() { return null; },
    insertAdjacentHTML() {}, cloneNode() { return mkEl(); }, prepend() {}, append() {}, replaceChildren() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }; },
  };
  self = new Proxy(el, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
  return self;
}
function detach(n) { if (n.parentNode) n.parentNode._children = n.parentNode._children.filter((x) => x !== n); }

// ── one boot ───────────────────────────────────────────────────────────────────────────────────
// reports: the rows buildPicker reads, newest first. done: report ids that have a results row.
// ddcRow: what the beat's mount read returns. inflight: what pollTick's reports read returns.
async function boot({ reports, done = [], ddcRow = null, inflight = null, src = SRC }) {
  const els = {};
  const $el = (id) => (els[id] = els[id] || mkEl(id));
  for (const v of VIEWS) $el("view-" + v).classList.add("hidden");
  $el("view-dashboard").appendChild($el("ddc-home"));
  $el("view-dashboard").appendChild($el("ddc-wrap"));
  $el("ddc-wrap").classList.add("hidden");
  $el("view-reveal").appendChild($el("ddc-rv-slot"));

  const PAYLOAD = { systems: [], priorities: [], vitality: {} };
  const ddcReads = [];
  const resolve = (st) => {
    const cols = String(st.cols || "");
    if (st.table === "profiles") return { data: { full_name: "T", dob: "1990-01-01", age_affirmed_at: "2026-09-01T00:00:00Z",
                                                  consent_accepted_at: "2026-09-01T00:00:00Z" }, error: null };
    if (st.table === "tester_acceptances") return { data: [{ id: 1 }], error: null };
    if (st.table === "reports" && cols.includes("cycle_date_provenance")) {
      ddcReads.push(st.filters.id);
      return { data: typeof ddcRow === "function" ? ddcRow(st.filters.id) : ddcRow, error: null };
    }
    if (st.table === "reports" && cols.includes("file_path")) return { data: reports, error: null };
    if (st.table === "reports" && cols.includes("transcribed")) return { data: inflight, error: null };   // RELEASE_HARDENING_V1: pollTick selects transcribed, never transcription_json
    if (st.table === "results" && cols.includes("report_id")) {
      return { data: done.map((id) => ({ report_id: id, payload: PAYLOAD })), error: null };
    }
    if (st.table === "results") return { data: done.includes(st.filters.report_id) ? { payload: PAYLOAD } : null, error: null };
    return { data: st.single ? null : [], error: null };
  };
  const qb = (table) => {
    const st = { table, cols: null, filters: {}, single: false };
    const chain = new Proxy(function () {}, {
      get(_, k) {
        if (k === "then") return (res, rej) => Promise.resolve(resolve(st)).then(res, rej);
        if (k === "select") return (c) => { st.cols = c; return chain; };
        if (k === "eq" || k === "in") return (c, v) => { st.filters[c] = v; return chain; };
        if (k === "maybeSingle" || k === "single") return () => { st.single = true; return Promise.resolve(resolve(st)); };
        return () => chain;
      },
    });
    return chain;
  };
  const sb = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "00000000-0000-4000-8000-00000000f1a5",
        email: "resume@example.test", user_metadata: { full_name: "T", age_affirmed: true } } } } }),
      getUser: async () => ({ data: { user: null } }), signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: qb, rpc: () => qb("rpc"),
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
    functions: { invoke: async () => ({ data: {}, error: null }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {},
  };

  const active = new Set();
  const slow = new Set();   // REVIEW_GATE_V1: the 60s pending poll
  let nextId = 1;
  let bootError = null;
  const document = new Proxy({
    getElementById: (id) => $el(id), querySelector: () => mkEl(), querySelectorAll: () => [],
    createElement: () => mkEl(), createElementNS: () => mkEl(), addEventListener() {}, removeEventListener() {},
    body: mkEl(), documentElement: mkEl(), head: mkEl(), readyState: "complete", cookie: "", title: "",
    visibilityState: "visible",
  }, { get: (t, k) => (k in t ? t[k] : () => mkEl()) });
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    document, supabase: { createClient: () => sb },
    location: new Proxy({ href: "https://biowellth.ai/dashboard", search: "", pathname: "/dashboard", hash: "",
      replace() {}, assign() {}, reload() {} }, { get: (t, k) => (k in t ? t[k] : "") }),
    history: { pushState() {}, replaceState() {}, back() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    navigator: { userAgent: "node", language: "en-GB", clipboard: { writeText: async () => {} } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" }),
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 50)), clearTimeout,
    setInterval: (f, ms) => { const id = nextId++; if (ms === 3000) active.add(id); if (ms === 60000) slow.add(id); return id; },
    clearInterval: (id) => { active.delete(id); slow.delete(id); },
    requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame() {},
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    URLSearchParams, URL, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean,
    Error, TypeError, ReferenceError, Set, Map, WeakMap, RegExp, Intl, crypto, Symbol,
    alert() {}, confirm: () => true, prompt: () => null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    scrollTo() {}, getComputedStyle: () => ({ getPropertyValue: () => "" }),
    innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1,
    atob: (b) => Buffer.from(b, "base64").toString("binary"), btoa: (b) => Buffer.from(b, "binary").toString("base64"),
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const onRej = (e) => { if (!bootError) bootError = e; };
  process.on("unhandledRejection", onRej);
  try { new vm.Script(src, { filename: "dashboard-inline.js" }).runInContext(ctx, { timeout: 20000 }); }
  catch (e) { bootError = bootError || e; }
  await new Promise((r) => setTimeout(r, 400));
  process.off("unhandledRejection", onRej);

  const probe = (expr) => new vm.Script(expr).runInContext(ctx);
  const visible = () => VIEWS.filter((v) => !$el("view-" + v).classList.contains("hidden"));
  return {
    ctx, els, $el, probe, active, slow, ddcReads, bootError, visible,
    pollId: () => probe("__pcPollReportId"),
    settle: () => new Promise((r) => setTimeout(r, 100)),
  };
}

const NOW = new Date().toISOString();
const R = (id, status, extra = {}) => ({ id, status, created_at: NOW, collected_on: null, lab_name: null,
  reveal_seen_at: null, clarify_prompts: null, file_path: "u/" + id + ".pdf", ...extra });
const QUALIFY = (id) => ({ id, collected_on: "2024-07-25", lmp_date_before_draw: "2024-07-01",
  cycle_date_provenance: "reported_at_upload" });

// ── (A) boot ──────────────────────────────────────────────────────────────────────────────────
console.log("BOOT_RESUME_POLL_V1");
{
  const b = await boot({ reports: [R("r-proc", "processing")], inflight: { status: "processing", transcribed: false, created_at: NOW } });
  ok(!b.bootError, "A1: boot with a processing report completes without throwing" + (b.bootError ? " -> " + b.bootError : ""));
  eq(b.visible().join(","), "processing", "A1: a processing report shows the processing screen");
  eq(b.active.size, 1, "A1: exactly one poll is armed");
  eq(b.pollId(), "r-proc", "A1: and it watches that report");
}
{
  const b = await boot({ reports: [R("r-up", "uploaded")], inflight: { status: "uploaded", transcribed: false, created_at: NOW } });
  eq(b.visible().join(","), "processing", "A2: an uploaded report shows the processing screen too");
  eq(b.active.size, 1, "A2: exactly one poll is armed");
}
{
  // Newest in flight, an older panel done: the ruling is her MOST RECENT report.
  const b = await boot({ reports: [R("r-new", "processing"), R("r-old", "done", { reveal_seen_at: NOW })], done: ["r-old"],
                         inflight: { status: "processing", transcribed: false, created_at: NOW } });
  eq(b.visible().join(","), "processing", "A3: newest in flight beats an older finished panel");
  eq(b.pollId(), "r-new", "A3: and the poll watches the newest report");
}
{
  // A second resume attempt for the same report must not arm a second poll.
  const b = await boot({ reports: [R("r-proc", "processing")], inflight: { status: "processing", transcribed: false, created_at: NOW } });
  b.probe("pcResumePoll()");
  await b.settle();
  eq(b.active.size, 1, "A4: a focus resume on top of the boot poll still leaves exactly one poll");
}
{
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"] });
  ok(!b.bootError, "A5: boot with a completed report completes without throwing" + (b.bootError ? " -> " + b.bootError : ""));
  eq(b.active.size, 0, "A5: a completed report arms no poll");
  eq(b.visible().join(","), "dashboard", "A5: and lands on the dashboard exactly as before");
}
{
  // Rescore shape: status back to processing, but a payload exists. Completed, so untouched.
  const b = await boot({ reports: [R("r-rs", "processing", { reveal_seen_at: NOW })], done: ["r-rs"] });
  eq(b.active.size, 0, "A6: a report WITH a payload is never resumed, whatever its status");
  eq(b.visible().join(","), "dashboard", "A6: it opens on the dashboard");
}
{
  const b = await boot({ reports: [R("r-err", "error")] });
  ok(!b.bootError, "A7: boot with an errored report completes without throwing" + (b.bootError ? " -> " + b.bootError : ""));
  eq(b.active.size, 0, "A7: an errored report arms no poll");
  eq(b.visible().join(","), "processing", "A7: it still shows the failure state on the processing view");
  ok(!b.$el("view-processing").innerHTML.includes("Reading your report") && b.$el("view-processing").innerHTML.length > 0,
     "A7: and that view holds the failure render, not a spinner  (len " + b.$el("view-processing").innerHTML.length + ")");
}

// ── (B) the beat at the reveal ─────────────────────────────────────────────────────────────────
console.log("DDC_AT_REVEAL_V1");
const revealBoot = (row) => boot({ reports: [R("r-rv", "done")], done: ["r-rv"], ddcRow: row });
{
  const b = await revealBoot(QUALIFY("r-rv"));
  await b.settle();
  ok(!b.bootError, "B1: the reveal boot completes without throwing" + (b.bootError ? " -> " + String(b.bootError.stack || b.bootError).split("\n").slice(0,3).join(" | ") : ""));
  eq(b.visible().join(","), "reveal", "B1: an unseen completed panel opens the reveal");
  ok(b.$el("ddc-wrap").parentNode === b.$el("ddc-rv-slot"), "B1: the beat's node is in the reveal slot");
  ok(b.$el("ddc").innerHTML.includes(BEAT), "B1: the beat renders at the reveal when both dates exist and it is unanswered");
  ok(!b.$el("ddc-wrap").classList.contains("hidden"), "B1: and it is not hidden");
  eq(b.ddcReads.length, 1, "B1: one read for it");
  // Leaving the reveal returns the node to the dashboard, where it always lived.
  b.probe('showView("dashboard")');
  ok(b.$el("ddc-wrap").parentNode === b.$el("view-dashboard"), "B1: leaving the reveal puts the node back on the dashboard");
}
{
  // null provenance is the other unanswered state
  const b = await revealBoot({ ...QUALIFY("r-rv"), cycle_date_provenance: null });
  await b.settle();
  ok(b.$el("ddc").innerHTML.includes(BEAT), "B2: a null provenance is asked at the reveal too");
}
for (const prov of ["confirmed_before_draw", "confirmed_after_draw", "unknown"]) {
  const b = await revealBoot({ ...QUALIFY("r-rv"), cycle_date_provenance: prov });
  await b.settle();
  ok(b.$el("ddc-wrap").parentNode === b.$el("ddc-rv-slot") && b.ddcReads.length === 1,
     "B3: located  (the node is in the slot and the read ran for " + prov + ")");
  eq(b.$el("ddc").innerHTML, "", "B3: an answered beat (" + prov + ") does not render");
}
for (const [label, patch] of [["collected_on", { collected_on: null }], ["lmp_date_before_draw", { lmp_date_before_draw: null }]]) {
  const b = await revealBoot({ ...QUALIFY("r-rv"), ...patch });
  await b.settle();
  ok(b.ddcReads.length === 1, "B4: located  (the read ran with " + label + " missing)");
  eq(b.$el("ddc").innerHTML, "", "B4: a missing " + label + " renders nothing");
}
{
  // Never twice in one session: replay the reveal, and the submit-path mount racing the reveal.
  const b = await revealBoot(QUALIFY("r-rv"));
  await b.settle();
  const first = b.$el("ddc")._beatRenders;
  b.probe('showView("dashboard")'); b.probe('showView("reveal")');
  await b.settle();
  eq(first, 1, "B5: control, the beat rendered once on the first reveal");
  eq(b.$el("ddc")._beatRenders, 1, "B5: re-opening the reveal does not render it again");
  eq(b.ddcReads.length, 1, "B5: and does not read again");
}
{
  // Fast case: navigateAfterSubmit mounts (read in flight), then shows the reveal in the same tick.
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"], ddcRow: QUALIFY("r-fast") });
  b.probe('window.__drawReportId = "r-fast"; window.__rdReport = "r-fast"; window.__drawReady = { kind: "reveal" }; navigateAfterSubmit();');
  await b.settle();
  eq(b.visible().join(","), "reveal", "B6: the fast case still lands on the reveal");
  eq(b.ddcReads.length, 1, "B6: the submit mount and the reveal mount issue ONE read between them");
  eq(b.$el("ddc")._beatRenders, 1, "B6: and render the beat exactly once");
  ok(b.$el("ddc-wrap").parentNode === b.$el("ddc-rv-slot"), "B6: in the reveal slot, above the cards");
}
{
  // The first-upload case itself: the submit mount found no collected_on, so it must NOT block the
  // reveal's mount later. Same session, the result lands, the reveal asks.
  const state = { callADone: false };
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         ddcRow: () => (state.callADone ? QUALIFY("r-slow") : { ...QUALIFY("r-slow"), collected_on: null }) });
  b.probe('window.__drawReportId = "r-slow"; window.__drawReady = { kind: "processing" }; navigateAfterSubmit();');
  await b.settle();
  eq(b.ddcReads.length, 1, "B7: one read at submit");
  eq(b.$el("ddc").innerHTML, "", "B7: control, at submit there is no collected_on and nothing renders");
  // Call A lands, the result is written, and the reveal opens for that report.
  state.callADone = true;
  b.probe('window.__rdReport = "r-slow"; showView("reveal");');
  await b.settle();
  eq(b.ddcReads.length, 2, "B7: the reveal reads again, because the submit mount found nothing to ask");
  ok(b.$el("ddc").innerHTML.includes(BEAT), "B7: and the beat now renders at the reveal");
}

// ── (C) REVIEW_GATE_V1, Phase 2 Step 5: a report held for review ─────────────────────────────────
console.log("REVIEW_GATE_V1");
const LONG_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();   // 3h, past the 25-minute bail
{
  const b = await boot({ reports: [R("r-held", "awaiting_review")], inflight: { status: "awaiting_review", transcribed: true, created_at: LONG_AGO } });
  ok(!b.bootError, "C1: boot with a held report completes without throwing" + (b.bootError ? " -> " + b.bootError : ""));
  eq(b.visible().join(","), "pending", "C1: a held newest report boots to the pending view");
  eq(b.pollId(), "r-held", "C1: and the poll watches it");
  await b.probe('pollTick("r-held")');
  await b.settle();
  eq(b.visible().join(","), "pending", "C2: three hours in, a tick still shows pending, NOT the overdue failure");
  ok(!String(b.$el("view-processing").innerHTML || "").includes(b.probe("PC_OVERDUE")), "C2: and the overdue copy was never rendered");
  eq(b.slow.size, 1, "C3: the poll is slowed to once a minute");
  eq(b.active.size, 0, "C3: and no 3-second poll is left running");
  await b.probe('pollTick("r-held")');
  await b.settle();
  eq(b.slow.size, 1, "C4: a second pending tick does not arm a second slow poll");
}
{
  // CONTROL for C2: the same three-hour report NOT held does hit the overdue bail, so C2 is not vacuous.
  const b = await boot({ reports: [R("r-proc", "processing")], inflight: { status: "processing", transcribed: true, created_at: LONG_AGO } });
  await b.probe('pollTick("r-proc")');
  await b.settle();
  ok(b.probe('PC_OVERDUE_MS') < 3 * 60 * 60 * 1000, "C5-CONTROL: three hours is past PC_OVERDUE_MS");
  eq(b.visible().join(","), "processing", "C5-CONTROL: an unheld report that old renders the overdue state on the processing view");
  ok(String(b.$el("view-processing").innerHTML || "").includes(b.probe("PC_OVERDUE")), "C5-CONTROL: the overdue copy IS rendered there, so C2's absence check can fire");
}
{
  // The draw-context form is not pulled out from under her: the held state waits for her submit.
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         inflight: { status: "awaiting_review", transcribed: true, created_at: NOW } });
  b.probe('showView("upload"); window.__drawBlockActive = true; window.__drawReady = null;');
  await b.probe('pollTick("r-new")');
  await b.settle();
  eq(b.probe('window.__drawReady && window.__drawReady.kind'), "pending", "C6: with the form mounted, the held state is acknowledged as pending");
  eq(b.visible().join(","), "upload", "C6: and she stays on the form");
  b.probe('window.__drawBlockActive = false; navigateAfterSubmit();');
  await b.settle();
  eq(b.visible().join(","), "pending", "C7: after submit she lands on the pending view");
}

console.log("PENDING_FROM_UPLOAD_V1");
// process-report's upload reply carries review_gate. true -> pending from the start, with the fast
// poll kept so a failure still surfaces in one tick. false or missing -> today's flow, proved below by
// running the SAME scenarios against the dashboard as it was at 15be94b and requiring identical views.
const { execSync } = await import("node:child_process");
let BEFORE_SRC = "";
try { BEFORE_SRC = extractApp(execSync("git show 15be94b:dashboard.html", { encoding: "utf8", maxBuffer: 64 << 20 }), "15be94b"); } catch (_) {}
ok(BEFORE_SRC.length > 100000 && !BEFORE_SRC.includes("pcGateHeld"), "F0-CONTROL: the pre-change app (15be94b) was read and has no gate flag (" + BEFORE_SRC.length + " chars)");
const HELD = { data: { ok: true, accepted: true, review_gate: true }, error: null };
const REL = { data: { ok: true, accepted: true, review_gate: false }, error: null };
const OLD = { data: { ok: true, accepted: true }, error: null };   // an older process-report, no flag
const setGate = (b, id, res) => b.probe("pcGateFromUpload(" + JSON.stringify(id) + ", " + JSON.stringify(res) + ")");
const FAILED_H = "We could not finish this reading";
{
  // F1: held from upload, still in flight: pending at once, fast poll kept, never slowed.
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         inflight: { status: "processing", transcribed: false, created_at: NOW } });
  setGate(b, "r-up", HELD);
  b.probe('pollForResult("r-up")');
  await b.probe('pollTick("r-up")');
  await b.settle();
  eq(b.visible().join(","), "pending", "F1: a held upload in flight shows the pending view, not Reading your report");
  eq(b.slow.size, 0, "F1: the poll is NOT slowed while the report is only in flight");
  eq(b.active.size, 1, "F1: the 3-second poll is still running");
  ok(!String(b.$el("view-processing").innerHTML || "").includes(FAILED_H), "F1: and no failure was rendered");
}
{
  // F2: the honest failure path. Held from upload, then the pipeline errors: one tick replaces pending
  // with the failure screen.
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         inflight: { status: "error", transcribed: true, created_at: NOW } });
  setGate(b, "r-up", HELD);
  b.probe('showView("pending"); pollForResult("r-up")');
  const terminal = await b.probe('pollTick("r-up")');
  await b.settle();
  eq(terminal, true, "F2: an error tick is terminal");
  eq(b.visible().join(","), "processing", "F2: the failure screen replaces pending on the FIRST tick");
  ok(String(b.$el("view-processing").innerHTML || "").includes(FAILED_H), "F2: and it is the failure copy, not the spinner");
}
{
  // F3: the overdue bail still fires under the gate (25 minutes in flight, never held).
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         inflight: { status: "processing", transcribed: true, created_at: LONG_AGO } });
  setGate(b, "r-up", HELD);
  b.probe('showView("pending"); pollForResult("r-up")');
  await b.probe('pollTick("r-up")');
  await b.settle();
  eq(b.visible().join(","), "processing", "F3: a held-from-upload report stuck in flight past 25 minutes reaches the overdue state");
  ok(String(b.$el("view-processing").innerHTML || "").includes(b.probe("PC_OVERDUE")), "F3: with the overdue copy");
}
{
  // F4: once the worker really holds it, the existing branch takes over: pending and the slow poll.
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         inflight: { status: "awaiting_review", transcribed: true, created_at: NOW } });
  setGate(b, "r-up", HELD);
  b.probe('pollForResult("r-up")');
  await b.probe('pollTick("r-up")');
  await b.settle();
  eq(b.visible().join(","), "pending", "F4: awaiting_review is still pending");
  eq(b.slow.size, 1, "F4: and only now is the poll slowed to once a minute");
}
{
  // F5: a prediction that turns out wrong cannot strand her. Flag said held, the worker released it.
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done", "r-up"],
                         inflight: { status: "done", transcribed: true, created_at: NOW } });
  setGate(b, "r-up", HELD);
  b.probe('showView("pending")');
  await b.probe('pollTick("r-up")');
  await b.settle();
  eq(b.visible().join(","), "reveal", "F5: a released report reaches the reveal even though the flag said held");
}
{
  // F6: "Start my reading" goes straight to pending, and the confirmation says prepared, not reading.
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         inflight: { status: "processing", transcribed: false, created_at: NOW } });
  b.$el("ad-start"); b.$el("up-postfile");
  setGate(b, "r-up", HELD);
  b.probe('showView("upload"); window.__drawReportId = "r-up"; window.__drawBlockActive = true; window.__drawReady = null;');
  await b.probe("submitAboutDraw()");
  const conf = String(b.$el("up-postfile").innerHTML || "");
  ok(conf.includes(b.probe("PFU_SAVED_H")) && conf.includes(b.probe("PFU_SAVED_B")), "F6: the confirmation says the report is being prepared");
  ok(!conf.includes("We are reading your report now"), "F6: and does NOT say we are reading it now");
  await new Promise((r) => setTimeout(r, 150));
  eq(b.visible().join(","), "pending", "F6: after Start my reading she lands on the pending view");
  ok(!/—|–/.test(b.probe("PFU_SAVED_H + PFU_SAVED_B")), "F6: no em or en dash in the new copy");
  const view = (readFileSync(FILE, "utf8").match(/<div id="view-pending" class="hidden">([\s\S]*?)<\/div>/) || [])[1] || "";
  // REVIEW_GATE_COPY_V2 (2026-09-25): PFU_SAVED_B is no longer the pending view's first sentence
  // verbatim. What must still hold is that the two surfaces make the SAME promise and neither keeps
  // the old "checks every report" wording.
  const savedB = String(b.probe("PFU_SAVED_B"));
  const promise = (t) => /reviewed for accuracy/.test(t) && /before it's released to you/.test(t);
  ok(promise(savedB) && promise(view), "F6: the confirmation and the pending view make the same accuracy-review promise");
  ok(!/checks every report/i.test(savedB + " " + view), "F6: neither keeps the old \"checks every report\" wording");
  ok(!promise("Our team checks every report before you see it during early access."), "F6-MUTANT: the old sentence would fail the promise check");
}
{
  // F7: the draw-context form stays on the upload card and is still offered under the gate: an
  // in-flight tick with the form mounted keeps her on it (the form is not pulled into another view).
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                         inflight: { status: "processing", transcribed: false, created_at: NOW } });
  setGate(b, "r-up", HELD);
  b.probe('showView("upload"); window.__drawBlockActive = true; window.__drawReady = null;');
  await b.probe('pollTick("r-up")');
  await b.settle();
  eq(b.visible().join(","), "upload", "F7: with the form mounted she stays on the upload card, gate on");
}

// ── GATE OFF: today's flow, proved differentially against 15be94b ─────────────────────────────
// Each scenario runs on the pre-change app and on this app with a false flag, a missing flag and no
// upload reply at all. The visible view and the processing view's markup must be identical.
const SCEN = [
  ["in flight", { status: "processing", transcribed: false, created_at: NOW }, 'pollTick("r-up")'],
  ["error", { status: "error", transcribed: true, created_at: NOW }, 'pollTick("r-up")'],
  ["overdue", { status: "processing", transcribed: true, created_at: LONG_AGO }, 'pollTick("r-up")'],
  ["held by the worker", { status: "awaiting_review", transcribed: true, created_at: NOW }, 'pollTick("r-up")'],
  ["after submit", { status: "processing", transcribed: false, created_at: NOW },
    'window.__drawReportId = "r-up"; window.__drawBlockActive = false; window.__drawReady = null; navigateAfterSubmit()'],
];
async function runScenario(src, gateRes, inflight, act) {
  const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"], inflight, src });
  if (gateRes !== undefined) setGate(b, "r-up", gateRes);
  b.probe('pollForResult("r-up")');
  await b.probe(act);
  await b.settle();
  return { view: b.visible().join(","), proc: String(b.$el("view-processing").innerHTML || ""), slow: b.slow.size, fast: b.active.size, err: b.bootError };
}
let diffs = 0, runs = 0;
for (const [name, inflight, act] of SCEN) {
  const before = await runScenario(BEFORE_SRC, undefined, inflight, act);
  ok(!before.err, "F8-CONTROL: the pre-change app booted for " + name);
  for (const [label, res] of [["review_gate false", REL], ["no flag", OLD], ["no upload reply", undefined]]) {
    const now = await runScenario(SRC, res, inflight, act);
    runs++;
    const same = now.view === before.view && now.proc === before.proc && now.slow === before.slow && now.fast === before.fast;
    if (!same) diffs++;
    ok(same, "F8: gate off (" + label + "), " + name + ": view " + now.view + " / polls " + now.fast + "+" + now.slow + " identical to 15be94b (" + before.view + ")");
  }
}
eq(diffs + "/" + runs, "0/15", "F8: no difference in any of the fifteen gate-off runs");
{
  // F8-MUTANT: the same differential DOES see the held flag, so F8 is not blind.
  const before = await runScenario(BEFORE_SRC, undefined, SCEN[0][1], SCEN[0][2]);
  const held = await runScenario(SRC, HELD, SCEN[0][1], SCEN[0][2]);
  ok(before.view !== held.view, "F8-MUTANT: with review_gate true the same scenario differs (" + before.view + " vs " + held.view + ")");
}

{
  // F9: gate off, the confirmation after "Start my reading" is byte-identical to 15be94b.
  const submitOn = async (src, gateRes) => {
    const b = await boot({ reports: [R("r-done", "done", { reveal_seen_at: NOW })], done: ["r-done"],
                           inflight: { status: "processing", transcribed: false, created_at: NOW }, src });
    b.$el("ad-start"); b.$el("up-postfile");
    if (gateRes !== undefined) setGate(b, "r-up", gateRes);
    b.probe('showView("upload"); window.__drawReportId = "r-up"; window.__drawBlockActive = true; window.__drawReady = null;');
    await b.probe("submitAboutDraw()");
    return String(b.$el("up-postfile").innerHTML || "");
  };
  const before = await submitOn(BEFORE_SRC, undefined);
  ok(before.includes("Saved. Your reading is underway."), "F9-CONTROL: the pre-change confirmation was captured");
  for (const [label, res] of [["review_gate false", REL], ["no flag", OLD], ["no upload reply", undefined]])
    eq(await submitOn(SRC, res), before, "F9: gate off (" + label + "), the confirmation markup is identical to 15be94b");
  ok((await submitOn(SRC, HELD)) !== before, "F9-MUTANT: with review_gate true it differs, so F9 can fail");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
