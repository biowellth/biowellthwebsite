#!/usr/bin/env node
// DRAW_CONTEXT_FLUSH_V1 -- the buffered supplement tap that used to be lost.
//
// THE REGRESSION IT CATCHES: dashboard.html's boot IIFE calls onb2Open(),
// onb2ResumeChip() and onb2RenderAccount() at top level, but those functions
// were declared INSIDE renderCompanionChips(), so they do not exist in the
// boot scope. The result is
//   Uncaught (in promise) ReferenceError: onb2Open is not defined
// and a page that renders the header and nothing else, because body.ready is
// set one line before the throw and every render call comes after it.
//
// WHY NOBODY HIT IT FOR THREE DAYS: the call is guarded by
//   const __ageBlocked = await maybeAffirmAge();
//   if(!__ageBlocked) onb2Open();
// maybeAffirmAge returns TRUE (blocking modal) whenever profiles.age_affirmed_at
// is null, which was every account that had loaded the dashboard since the call
// landed on 2026-09-02. The first account to boot with age_affirmed_at SET
// reaches the throw. That is a fresh signup, because affirm-age stamps it during
// its own first load.
//
// So the test boots the real script against a FRESH profile: age_affirmed_at
// set, dob null, no consent.
//
//   node scripts/test-boot-fresh-profile.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

const lines = HTML.split("\n");
const s = lines.findIndex((l) => l.trim() === "<script>");
const e = lines.length - 1 - [...lines].reverse().findIndex((l) => l.trim() === "</script>");
if (s < 0 || e <= s) { console.log("  FAIL could not locate the inline script block"); process.exit(1); }
const SRC = lines.slice(s + 1, e).join("\n");

// ── a DOM permissive enough that only REAL errors surface ────────────────────
const mkEl = () => {
  const el = {
    style: new Proxy({}, { get: () => "", set: () => true }),
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset: {}, children: [], value: "", textContent: "", innerHTML: "",
    checked: false, disabled: false,
    appendChild(){}, removeChild(){}, remove(){}, setAttribute(){}, removeAttribute(){},
    getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    querySelector(){ return mkEl(); }, querySelectorAll(){ return []; },
    closest(){ return null; }, focus(){}, blur(){}, scrollIntoView(){}, click(){},
    getBoundingClientRect(){ return { top:0,left:0,width:0,height:0,bottom:0,right:0 }; },
    insertAdjacentHTML(){}, cloneNode(){ return mkEl(); },
  };
  return new Proxy(el, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
};

const calls = [];
const rpcCalls = [];
const profileRow = {
  full_name: "Fresh Tester",
  dob: null,                                   // <-- the fresh-signup state
  age_affirmed_at: "2026-09-05T20:38:24.000Z", // <-- set, so maybeAffirmAge does NOT block
  consent_accepted_at: null,
  supp_b12: null, supp_folate: null, supp_status_updated_at: null,
  confounders: null, supplements: null, context_note: null,
};

const thenable = (data) => {
  const p = { data, error: null };
  const chain = new Proxy(function(){}, {
    get(_, k) {
      if (k === "then") return (res) => Promise.resolve(p).then(res);
      return () => chain;
    },
    apply() { return chain; },
  });
  return chain;
};


// The reports insert must return an id through the REAL chain shape:
//   sb.from("reports").insert({...}).select("id").single()
const REPORT_ID = "11111111-2222-4333-8444-555555555555";
// Only `.insert(...)` is special-cased. Every other call on from("reports") — the
// boot's own select, for one — must keep the normal chain, or the boot throws and
// the whole file reports on a page that never ran.
const reportsInsertChain = () => new Proxy({}, {
  get(_, k) {
    if (k === "insert") {
      return () => ({ select: () => ({ single: async () => ({ data: { id: REPORT_ID }, error: null }) }) });
    }
    return thenable([])[k];
  },
});

// The upload is held open so the test can tap DURING it. That is the real race:
// mountAboutDraw(null, ...) has run and cleared __ad, the block is on screen, and
// the reports insert has not returned yet.
let releaseUpload;
let uploadGate = new Promise((r) => { releaseUpload = r; });

const sb = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "c372a949-0000-4000-8000-000000000000",
                                 email: "fresh@example.test",
                                 user_metadata: { full_name: "Fresh Tester", age_affirmed: true } } } } }),
    getUser: async () => ({ data: { user: null } }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
  },
  from: (t) => {
    calls.push("from:" + t);
    if (t === "reports") return reportsInsertChain();
    return thenable(t === "profiles" ? profileRow : []);
  },
  rpc: (name, args) => { rpcCalls.push({ name, args }); return thenable(null); },
  storage: { from: () => ({ upload: async () => { await uploadGate; return { error: null }; }, remove: async () => ({ error: null }) }) },
  functions: { invoke: async () => ({ data: {}, error: null }) },
  channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
  removeChannel: () => {},
};

const documentStub = new Proxy({
  getElementById: () => mkEl(), querySelector: () => mkEl(), querySelectorAll: () => [],
  createElement: () => mkEl(), createElementNS: () => mkEl(),
  addEventListener(){}, removeEventListener(){},
  body: mkEl(), documentElement: mkEl(), head: mkEl(), readyState: "complete",
  cookie: "", title: "",
}, { get: (t, k) => (k in t ? t[k] : () => mkEl()) });

let bootError = null;
const sandbox = {
  console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
  document: documentStub,
  window: undefined,
  supabase: { createClient: () => sb },
  location: new Proxy({ href: "https://biowellth.ai/dashboard", search: "", pathname: "/dashboard",
                        replace(){}, assign(){}, reload(){} }, { get: (t,k) => (k in t ? t[k] : "") }),
  localStorage: { getItem: () => null, setItem(){}, removeItem(){}, clear(){} },
  sessionStorage: { getItem: () => null, setItem(){}, removeItem(){}, clear(){} },
  navigator: { userAgent: "node", language: "en-US", clipboard: { writeText: async () => {} } },
  matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" }),
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
  requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame(){},
  URLSearchParams, URL, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean,
  Error, TypeError, ReferenceError, Set, Map, WeakMap, RegExp, Intl, crypto,
  alert(){}, confirm: () => true, prompt: () => null,
  addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
  scrollTo(){}, getComputedStyle: () => ({ getPropertyValue: () => "" }),
  innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1,
  atob: (b) => Buffer.from(b, "base64").toString("binary"),
  btoa: (b) => Buffer.from(b, "binary").toString("base64"),
  __bootError: (err) => { if (!bootError) bootError = err; },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const WRAPPED = SRC + "\n;globalThis.__T = { ad: () => __ad, commit: () => __adCommit(), handleFile: (f) => handleFile(f) };";

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));
const commits = () => rpcCalls.filter((c) => c.name === "commit_between_calls");
const tick = (n) => new Promise((r) => setTimeout(r, n || 60));

process.on("unhandledRejection", (err) => { if (!bootError) bootError = err; });
try {
  new vm.Script(WRAPPED, { filename: "dashboard-inline.js" }).runInContext(sandbox, { timeout: 20000 });
} catch (err) { bootError = bootError || err; }
await tick(250);

console.log("HARNESS");
if (bootError) console.log("       boot threw -> " + String(bootError && bootError.message || bootError));
ok(!bootError, "H-1: the script booted (a broken boot makes every result below meaningless)");
ok(!!sandbox.__T && !!sandbox.__T.ad(), "H-2: __ad and __adCommit are reachable");

// KNOWN-POSITIVE CONTROL. If the recorder cannot record, every zero below is a lie.
sandbox.__T.ad().supp.add("__control__");
sandbox.window.__drawReportId = "control-id";
await sandbox.__T.commit();
ok(commits().length === 1, "H-3: CONTROL — the rpc stub records commit_between_calls (got " + commits().length + ")");
rpcCalls.length = 0; sandbox.window.__drawReportId = null; sandbox.__T.ad().supp.clear();

// ── The real sequence. mountAboutDraw(null, file.name) runs INSIDE handleFile and
//    clears __ad, so the tap must happen after it and before the insert returns.
console.log("\nSTEP 1 — tap DURING the upload, before the reportId exists");
const inflight = sandbox.__T.handleFile({ name: "panel.pdf", size: 1024, type: "application/pdf" });
await tick(80);                                  // mount has run, upload is still open
ok(sandbox.window.__drawBlockActive === true, "F-1: the About-draw block mounted with no report id");
ok(sandbox.window.__drawReportId == null, "F-2: precondition — __drawReportId is still null");

sandbox.__T.ad().supp.add("b12");                // the tap
await sandbox.__T.commit();
ok(commits().length === 0, "F-3: NO commit_between_calls while the id is null (got " + commits().length + ")");
ok(sandbox.__T.ad().supp.has("b12"), "F-4: the tap is buffered in __ad rather than discarded");

console.log("\nSTEP 2 — the reportId lands through the REAL upload path");
releaseUpload();
await tick(200);
ok(sandbox.window.__drawReportId === REPORT_ID,
   "F-5: handleFile assigned __drawReportId from the reports insert");
ok(commits().length === 1, "F-6: EXACTLY ONE commit_between_calls fired on the flush (got " + commits().length + ")");
const first = commits()[0];
ok(!!first && first.args.p_report_id === REPORT_ID, "F-7: the flush carried the real report id");
ok(!!first && Array.isArray(first.args.p_supplements) && first.args.p_supplements.includes("b12"),
   "F-8: the flush carried the buffered supplement (" + JSON.stringify(first && first.args.p_supplements) + ")");

console.log("\nSTEP 3 — a second tap after the id exists");
sandbox.__T.ad().supp.add("folate");
await sandbox.__T.commit();
await tick(60);
ok(commits().length === 2, "F-9: the second tap sends its own call (got " + commits().length + ")");
const second = commits()[1];
ok(!!second && second.args.p_supplements.includes("b12") && second.args.p_supplements.includes("folate"),
   "F-10: the second call carries BOTH supplements, so nothing was dropped");
ok(commits().length === 2, "F-11: NO duplicate flush — the flush ran once, not once per later tap");

console.log("\nSTEP 4 — the flush is conditional, not unconditional");
rpcCalls.length = 0;
sandbox.window.__drawReportId = null;
uploadGate = Promise.resolve();
await sandbox.__T.handleFile({ name: "panel2.pdf", size: 1024, type: "application/pdf" });
await tick(200);
ok(sandbox.window.__drawReportId === REPORT_ID, "F-12: the second upload also assigned the id");
ok(commits().length === 0,
   "F-13: with nothing buffered, the upload sends NO commit_between_calls (got " + commits().length + ")");

await inflight.catch(() => {});
console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
