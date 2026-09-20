#!/usr/bin/env node
// DRAW_DATE_CONFIRM_V1 -- the beat that asks which period she meant.
//
// WHY IT EXISTS. reports.lmp_date_before_draw is named for the draw, but the upload card asks a
// present-tense question, so the answer is current as of upload. Measured on the stored rows: of
// 12 non-keeper reports carrying an LMP, 10 are dated AFTER their draw. This beat is the only
// place both dates can be shown together, because collected_on is written by the worker from
// Call A and does not exist while she is answering the upload card.
//
// WHAT THIS FILE PINS.
//   * it renders only when BOTH dates are present and provenance is null or reported_at_upload
//   * a null draw date renders nothing, silently
//   * an already-confirmed row is never asked again
//   * each button sends its OWN value, through submit-mode
//   * the body carries the answer and NOT the date: resending the date would put a second writer
//     on lmp_date_before_draw, and since DATE_CHANGE_CLEARS_V1 a differing date clears the very
//     confirm the call is setting
//   * a write that does not land shows NO acknowledgement
//   * both dates render through rvFmtDate, never fmtDrawDate
//
// THE SCRIPT EXTRACTION IS DELIBERATELY NOT THE ONE THE OTHER TEST FILES USE. They take the FIRST
// <script> to the LAST </script>, which was correct while the page had one bare block. A Sentry
// block was added ahead of the app on 2026-09-20, so that span now swallows an intervening
// </script> and the extracted text is not valid JS. Measured: 6 of the 26 scripts fail at HEAD for
// exactly this reason, before any change of mine. This file takes the LAST bare block, which is
// the app.
//
//   node scripts/test-draw-date-confirm.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML = readFileSync(process.env.DASH || "dashboard.html", "utf8");
const lines = HTML.split("\n");
const opens = lines.map((l, i) => (l.trim() === "<script>" ? i : -1)).filter((i) => i >= 0);
const closes = lines.map((l, i) => (l.trim() === "</script>" ? i : -1)).filter((i) => i >= 0);
const s = opens[opens.length - 1];
const e = closes.filter((c) => c > s)[0];
if (s == null || e == null) { console.log("  FAIL could not locate the app script block"); process.exit(1); }
const SRC = lines.slice(s + 1, e).join("\n");

let pass = 0, fail = 0;
const ok  = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq  = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);

// ── a DOM just rich enough for this beat ─────────────────────────────────────
function mkBtn(val) {
  return { _val: val, onclick: null, getAttribute: (k) => (k === "data-ddc-val" ? val : null) };
}
// Permissive, like the other test files: only a REAL error should surface, so an unknown
// selector yields another element rather than null. The beat's two selectors are answered
// specifically; everything else is scenery.
function mkAny() {
  const el = {
    style: new Proxy({}, { get: () => "", set: () => true }),
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset: {}, children: [], value: "", textContent: "", innerHTML: "",
    checked: false, disabled: false, onclick: null,
    appendChild(){}, removeChild(){}, remove(){}, setAttribute(){}, removeAttribute(){},
    getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    querySelector(){ return mkAny(); }, querySelectorAll(){ return []; },
    closest(){ return null; }, focus(){}, blur(){}, scrollIntoView(){}, click(){},
    insertAdjacentHTML(){}, cloneNode(){ return mkAny(); },
    getBoundingClientRect(){ return { top:0,left:0,width:0,height:0,bottom:0,right:0 }; },
  };
  return new Proxy(el, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
}
function mkHost() {
  const h = mkAny();
  h._buttons = []; h._card = null;
  h.querySelector = (sel) => (sel === ".clarify-card" ? h._card : mkAny());
  h.querySelectorAll = (sel) => (sel === ".clarify-opt" ? h._buttons : []);
  return h;
}

function run({ report, invokeResult, invokeThrows, mountRow = null }) {
  const selects = [];
  const host = mkHost();
  const wrap = { classList: { add(){ wrap._hidden = true; }, remove(){ wrap._hidden = false; } }, _hidden: null };
  const card = { outerHTML: null, querySelector: () => null, insertAdjacentHTML(_p, h) { card._appended = h; } };
  host._card = card;

  const invocations = [];
  const logs = [];
  const els = { "ddc-wrap": wrap, "ddc": host };

  const ctx = {
    console: { log(){}, warn(){}, error: (...a) => logs.push(a.map(String).join(" ")) },
    document: {
      getElementById: (id) => els[id] || mkAny(),
      querySelector: () => mkAny(), querySelectorAll: () => [],
      addEventListener(){}, createElement: () => mkAny(), body: mkAny(),
      documentElement: { style: {}, classList: { add(){}, remove(){} } },
    },
    window: { __ddcAnswered: {}, addEventListener(){}, location: { search: "", hash: "", pathname: "/" },
              matchMedia: () => ({ matches: false, addEventListener(){} }) },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    location: { search: "", hash: "", pathname: "/dashboard", href: "", replace(){}, assign(){}, reload(){} },
    history: { pushState(){}, replaceState(){}, back(){} },
    setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    IntersectionObserver: class { observe(){} disconnect(){} },
    ResizeObserver: class { observe(){} disconnect(){} },
    navigator: { userAgent: "node", language: "en-GB" },
    Intl, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise, Set, Map, RegExp, Error,
    supabase: { createClient: () => ({
      auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange(){}, getUser: async () => ({ data: { user: null } }) },
      from: (table) => ({ select: (cols) => ({ eq: (_c, id) => ({
        maybeSingle: async () => {
          if (table === "reports" && String(cols).includes("cycle_date_provenance")) {
            selects.push({ table, cols, id });
            return { data: mountRow, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => ({ data: null, error: null }),
        limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }) }) }),
      functions: { invoke: async (name, opts) => {
        invocations.push({ name, body: opts && opts.body });
        if (invokeThrows) throw new Error("simulated transport failure");
        return invokeResult;
      } },
      storage: { from: () => ({ upload: async () => ({}), createSignedUrl: async () => ({}) }) },
    }) },
  };
  ctx.globalThis = ctx; ctx.self = ctx;
  Object.assign(ctx.window, ctx);

  vm.createContext(ctx);
  try { new vm.Script(SRC).runInContext(ctx); }
  catch (err) { console.log("  FAIL app block threw on load: " + String(err).split("\n")[0]); process.exit(1); }

  const rendered = ctx.ddcRender(report);
  return { rendered, host, wrap, card, invocations, logs, ctx, selects };
}

const QUALIFY = {
  id: "b48bd09f-0000-4000-8000-000000000001",
  collected_on: "2024-07-25",
  lmp_date_before_draw: "2026-08-04",
  cycle_date_provenance: "reported_at_upload",
};
const OKRESULT = { data: { ok: true, persisted: { cycle: true } }, error: null };

console.log("DRAW_DATE_CONFIRM_V1");

// 1. renders for a qualifying report, and the dates go through rvFmtDate
{
  const r = run({ report: QUALIFY, invokeResult: OKRESULT });
  ok(r.rendered === true, "renders for a qualifying report");
  ok(r.host.innerHTML.includes("Your panel was from 25 July 2024."),
     "headline carries the draw date through rvFmtDate");
  ok(r.host.innerHTML.includes("your last period started on 4 August 2026"),
     "body carries the period date through rvFmtDate");
  // CONTROL against fmtDrawDate, which renders a day early in a negative offset.
  ok(!r.host.innerHTML.includes("July 24, 2024") && !r.host.innerHTML.includes("August 3, 2026"),
     "neither date was rendered by fmtDrawDate");
  ok(r.host.innerHTML.includes("The one before this draw")
     && r.host.innerHTML.includes("My most recent one")
     && r.host.innerHTML.includes("I&#39;m not sure") || r.host.innerHTML.includes("I'm not sure"),
     "all three buttons render");
}

// 2. does not render with a null draw date
{
  const r = run({ report: { ...QUALIFY, collected_on: null }, invokeResult: OKRESULT });
  eq(r.rendered, false, "a null draw date renders nothing");
  eq(r.host.innerHTML, "", "and writes no markup");
}
// 2b. nor with a null period date  (control: the same shape WITH both dates rendered above)
{
  const r = run({ report: { ...QUALIFY, lmp_date_before_draw: null }, invokeResult: OKRESULT });
  eq(r.rendered, false, "a null period date renders nothing");
}

// 3. does not render when already confirmed
for (const prov of ["confirmed_before_draw", "confirmed_after_draw", "unknown"]) {
  const r = run({ report: { ...QUALIFY, cycle_date_provenance: prov }, invokeResult: OKRESULT });
  eq(r.rendered, false, `a stored ${prov} is never asked again`);
}
// 3b. a null provenance IS asked  (control that the provenance gate can pass)
{
  const r = run({ report: { ...QUALIFY, cycle_date_provenance: null }, invokeResult: OKRESULT });
  eq(r.rendered, true, "a null provenance still gets asked");
}

// 4. each button sends its own value, and NOT the date
{
  const expect = ["confirmed_before_draw", "confirmed_after_draw", "unknown"];
  for (let i = 0; i < 3; i++) {
    const r = run({ report: QUALIFY, invokeResult: OKRESULT });
    r.host._buttons = [mkBtn(expect[0]), mkBtn(expect[1]), mkBtn(expect[2])];
    const btns = [];
    r.host.querySelectorAll = () => r.host._buttons;
    r.ctx.ddcRender(QUALIFY);                      // re-render so onclick binds to our buttons
    await r.host._buttons[i].onclick();
    eq(r.invocations.length, 1, `button ${i} issued exactly one invoke`);
    eq(r.invocations[0].name, "process-report", `button ${i} calls process-report`);
    eq(r.invocations[0].body.mode, "submit", `button ${i} uses submit mode`);
    eq(r.invocations[0].body.cycle_date_provenance, expect[i], `button ${i} sends its own value`);
    ok(!("lmp_date_before_draw" in r.invocations[0].body), `button ${i} does NOT resend the date`);
    eq(Object.keys(r.invocations[0].body).sort().join(","),
       "cycle_date_provenance,mode,report_id", `button ${i} sends exactly three keys`);
  }
}

// 5. a failed write shows NO acknowledgement
{
  // 5a. transport threw
  const a = run({ report: QUALIFY, invokeThrows: true });
  a.host._buttons = [mkBtn("unknown")];
  a.host.querySelectorAll = () => a.host._buttons;
  a.ctx.ddcRender(QUALIFY);
  await a.host._buttons[0].onclick();
  eq(a.card.outerHTML, null, "a thrown write shows no acknowledgement");
  ok(a.logs.some((l) => l.includes("confirm write failed")), "and it is logged");

  // 5b. 200 but the server did not persist -- the ACTIVE v36 case
  const b = run({ report: QUALIFY, invokeResult: { data: { ok: true, persisted: {} }, error: null } });
  b.host._buttons = [mkBtn("unknown")];
  b.host.querySelectorAll = () => b.host._buttons;
  b.ctx.ddcRender(QUALIFY);
  await b.host._buttons[0].onclick();
  eq(b.card.outerHTML, null, "a 200 without persisted.cycle shows no acknowledgement");
  ok(b.logs.some((l) => l.includes("confirm write failed")), "and it is logged too");

  // CONTROL: a genuine success DOES acknowledge, so the two above are not passing vacuously
  const c = run({ report: QUALIFY, invokeResult: OKRESULT });
  c.host._buttons = [mkBtn("unknown")];
  c.host.querySelectorAll = () => c.host._buttons;
  c.ctx.ddcRender(QUALIFY);
  await c.host._buttons[0].onclick();
  ok(typeof c.card.outerHTML === "string" && c.card.outerHTML.includes("clarify-ack"),
     "CONTROL: a successful write does acknowledge");
  eq(c.ctx.window.__ddcAnswered[QUALIFY.id], "unknown", "and the answer is mirrored locally");
}

// 6. the mount actually FETCHES and renders -- the beat has to be reachable, not just correct.
//    Caught during the build: an earlier draft read a window global nothing ever set, so the beat
//    could never have rendered in production while every unit test above still passed.
{
  const r = run({ report: QUALIFY, invokeResult: OKRESULT, mountRow: QUALIFY });
  r.ctx.window.__drawReportId = QUALIFY.id;
  r.host.innerHTML = "";
  r.ctx.mountDrawDateConfirm();
  await new Promise((res) => setTimeout(res, 0));
  eq(r.selects.length, 1, "the mount issues exactly one read");
  eq(r.selects[0].table, "reports", "and it reads the reports table");
  ok(String(r.selects[0].cols).includes("collected_on")
     && String(r.selects[0].cols).includes("lmp_date_before_draw")
     && String(r.selects[0].cols).includes("cycle_date_provenance"),
     "selecting the three fields it gates on");
  ok(r.host.innerHTML.includes("Your panel was from"), "and the card is rendered from what it read");
}

// 6b. no report id: the mount reads nothing  (control: 6 above DID read, same fake)
{
  const r = run({ report: QUALIFY, invokeResult: OKRESULT, mountRow: QUALIFY });
  r.ctx.window.__drawReportId = null;
  r.ctx.mountDrawDateConfirm();
  await new Promise((res) => setTimeout(res, 0));
  eq(r.selects.length, 0, "with no report id the mount reads nothing");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
