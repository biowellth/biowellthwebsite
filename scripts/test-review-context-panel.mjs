#!/usr/bin/env node
// REVIEWER_CONTEXT_V1 + REVIEW_SESSION_V1 + REVIEW_NO_STORE_V1 on /review, exercised on the page's REAL script in a
// vm, against a fake review-action and a DOM that records what was rendered. Every value is invented.
//
//   C-1  the page asks browsers not to cache it
//   C-2  the session lives in sessionStorage (ends with the tab), not localStorage
//   C-3  30 minutes without activity signs out and reloads; 29 minutes does not
//   C-4  the panel: values, "Not shared", "Not answered", the date-after-draw state; older reports "Not recorded"
//   C-5  her own words render as TEXT in their own labelled block, never as markup; hidden when absent
//   C-6  a rescore is labelled as the original interpretation's context, carried forward
//   C-7  date of birth, name, email and phone never render, even if a response carried them
//   C-8  the panel sits ABOVE the interpretation in the page
//
//   node scripts/test-review-context-panel.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const PAGE = readFileSync(process.env.REVIEW || "review.html", "utf8");
const JS = (PAGE.match(/<script>\n([\s\S]*?)<\/script>/) || [])[1] || "";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
ok(JS.length > 5000, "CONTROL: the page script located (" + JS.length + " chars)");

function mkEl(tag) {
  const cls = new Set(); const kids = []; let text = "";
  return {
    tagName: String(tag || "div").toUpperCase(), dataset: {}, value: "", style: {},
    get className() { return [...cls].join(" "); }, set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
    classList: { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; }, contains: (c) => cls.has(c) },
    get textContent() { return text + kids.map((k) => k.textContent).join(""); },
    set textContent(v) { text = String(v); kids.length = 0; },
    appendChild(k) { kids.push(k); return k; }, get children() { return kids; },
    addEventListener() {}, querySelectorAll() { return []; },
  };
}
const walk = (e, f) => { f(e); for (const k of e.children || []) walk(k, f); };
const find = (root, pred) => { const out = []; walk(root, (e) => { if (pred(e)) out.push(e); }); return out; };

function boot({ detail = null, session = null } = {}) {
  const ids = {};
  const calls = { signOut: 0, replaced: [], clientOpts: null };
  const document = {
    getElementById: (id) => (ids[id] = ids[id] || mkEl("div")),
    createElement: (t) => mkEl(t), createTextNode: (t) => { const n = mkEl("#text"); n.textContent = t; return n; },
    querySelectorAll: () => [], addEventListener() {}, hidden: false,
  };
  const store = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const sb = {
    functions: { invoke: async () => ({ data: detail ?? { ok: true, items: [], email_configured: true }, error: null }) },
    auth: { getSession: async () => ({ data: { session } }), signInWithPassword: async () => ({}), signOut: async () => { calls.signOut++; return {}; } },
  };
  const ctx = {
    document, console: { log() {}, error() {}, warn() {} }, setTimeout, JSON, Array, String, Number, Math, Object, Promise, Set, Map, Date, RegExp,
    supabase: { createClient: (u, k, opts) => { calls.clientOpts = opts; return sb; } },
    sessionStorage: store, localStorage: { getItem() { return "SHOULD-NOT-BE-USED"; } },
    location: { pathname: "/review", search: "", replace: (u) => calls.replaced.push(u) },
    addEventListener() {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  new vm.Script(JS).runInContext(ctx);
  return { ctx, calls, store, $: (id) => document.getElementById(id) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

console.log("C-1  no-cache");
ok(/<meta name="robots" content="noindex,nofollow"\/>/.test(PAGE), "C-1-CONTROL: the head is located");
ok(/<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"\/>/.test(PAGE), "C-1: Cache-Control meta present");
ok(/<meta http-equiv="Pragma" content="no-cache"\/>/.test(PAGE) && /<meta http-equiv="Expires" content="0"\/>/.test(PAGE), "C-1: Pragma and Expires present");

console.log("C-2  session storage");
{ const b = boot(); ok(b.calls.clientOpts && b.calls.clientOpts.auth && b.calls.clientOpts.auth.storage === b.store, "C-2: the client is given sessionStorage");
  ok(b.calls.clientOpts.auth.storage !== b.ctx.localStorage, "C-2-CONTROL: and not localStorage"); }

console.log("C-3  idle sign-out");
{
  const b = boot({ session: { user: {} } }); await tick(); await tick();
  const early = await b.ctx.signOutIfIdle(Date.now() + 29 * 60 * 1000);
  ok(early === false && b.calls.signOut === 0 && b.calls.replaced.length === 0, "C-3-CONTROL: 29 minutes idle does NOT sign out");
  const late = await b.ctx.signOutIfIdle(Date.now() + 31 * 60 * 1000);
  ok(late === true && b.calls.signOut === 1, "C-3: 31 minutes idle signs out");
  ok(b.calls.replaced[0] === "/review?signed_out=idle", "C-3: and reloads, clearing whatever report was on screen");
  const nob = boot({ session: null }); await tick();
  ok((await nob.ctx.signOutIfIdle(Date.now() + 60 * 60 * 1000)) === false && nob.calls.signOut === 0, "C-3: nothing to sign out when not signed in");
}

const panel = (over = {}) => ({
  status: "recorded", source: "interpretation", captured_at: "2026-01-20T10:00:00Z", engine_logic_version: "2026-09-26.1", no_profile: false,
  fields: [
    { key: "age", label: "Age", state: "value", value: 34 },
    { key: "known_conditions", label: "Known conditions", state: "not_shared", value: null },
    { key: "symptoms", label: "Symptoms", state: "not_answered", value: null },
    { key: "lmp_date_before_draw", label: "Period start before the draw", state: "withheld_date_after_draw", value: null },
    { key: "supplements", label: "Supplements", state: "value", value: ["vitamin_d", "iron"] },
    { key: "true_fasting_at_draw", label: "Fasting at the draw", state: "value", value: true },
  ],
  own_words: "I had a <b>cold</b> & slept badly", ...over,
});
const rows = (b) => find(b.$("context"), (e) => e.tagName === "TR").map((tr) => tr.children.map((c) => c.textContent));

console.log("C-4  the panel states");
{
  const b = boot(); b.ctx.renderContext(panel());
  const r = rows(b);
  ok(r.length === 6, "C-4-CONTROL: six rows rendered (" + r.length + ")");
  ok(JSON.stringify(r[0]) === '["Age","34"]', "C-4: a value renders");
  ok(JSON.stringify(r[1]) === '["Known conditions","Not shared"]', "C-4: consent-withheld reads Not shared");
  ok(JSON.stringify(r[2]) === '["Symptoms","Not answered"]', "C-4: not answered reads Not answered");
  ok(JSON.stringify(r[3]) === '["Period start before the draw","Withheld (date after the draw)"]', "C-4: date after the draw is its own state");
  ok(JSON.stringify(r[4]) === '["Supplements","vitamin_d, iron"]' && JSON.stringify(r[5]) === '["Fasting at the draw","Yes"]', "C-4: lists and yes/no read plainly");
  const nr = boot(); nr.ctx.renderContext({ status: "not_recorded" });
  ok(nr.$("context").textContent === "Not recorded for this report.", "C-4: an older report says Not recorded for this report");
  const none = boot(); none.ctx.renderContext(undefined);
  ok(none.$("context").textContent === "Not recorded for this report.", "C-4: an older review-action (no field) also says Not recorded");
}

console.log("C-5  her own words");
{
  const b = boot(); b.ctx.renderContext(panel());
  ok(b.$("own-words").textContent === "I had a <b>cold</b> & slept badly", "C-5: shown verbatim, as text (markup stays literal)");
  ok(!b.$("own-words-block").classList.contains("hidden"), "C-5: its block is visible");
  ok(/<h3[^>]*>Her own words \(may include personal details\)<\/h3>/.test(PAGE), "C-5: labelled exactly as approved");
  ok(!/innerHTML/.test(JS), "C-5: the page script never uses innerHTML");
  const n = boot(); n.ctx.renderContext(panel({ own_words: null }));
  ok(n.$("own-words-block").classList.contains("hidden") && n.$("own-words").textContent === "", "C-5-CONTROL: hidden and empty when there is no note");
}

console.log("C-6  rescore label");
{
  const r = boot(); r.ctx.renderContext(panel({ source: "original_interpretation_carried_forward" }));
  ok(/original interpretation/i.test(r.$("context-source").textContent), "C-6: a rescore says it is the original interpretation's context");
  const p = boot(); p.ctx.renderContext(panel());
  ok(!/original interpretation/i.test(p.$("context-source").textContent) && /Exactly what the model was told/.test(p.$("context-source").textContent), "C-6-CONTROL: a report does not");
}

console.log("C-7  never date of birth, name, email or phone");
{
  const bad = panel(); bad.fields.push({ key: "dob", label: "Date of birth", state: "value", value: "1990-01-01" },
    { key: "email", label: "Email", state: "value", value: "x@example.com" }, { key: "full_name", label: "Name", state: "value", value: "A B" });
  const b = boot(); b.ctx.renderContext(bad);
  const t = b.$("context").textContent;
  ok(!t.includes("1990-01-01") && !t.includes("x@example.com") && !t.includes("A B") && !t.includes("Date of birth"), "C-7: none of them render");
  ok(t.includes("34"), "C-7-CONTROL: age still does");
}

console.log("C-8  placement");
{
  const cc = PAGE.indexOf('id="context-card"'), nar = PAGE.indexOf('id="narrative"'), h = PAGE.indexOf("<h2>What the report was based on</h2>");
  ok(cc > 0 && nar > 0, "C-8-CONTROL: both containers located");
  ok(cc < nar && h > cc && h < nar, "C-8: the panel sits above the interpretation");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
