#!/usr/bin/env node
// CYCLE_CAPTURE_V2 -- the two durable cycle questions on the per-draw upload card.
//
// WHY THEY ARE BACK. They were removed from this card on 2026-09-02 because
// onboarding was going to ask them once, and one asker per column is the rule.
// ONBOARDING_ENABLED is false and has been since, so between then and now NOTHING
// asked, and typical_cycle_length_days and typical_period_duration_days are null
// for every user. bb maps the duration onto period_length and derives
// period_end_date from it; with no duration, phaseForDay falls back to Menstrual
// meaning days 1 to 5 for everyone, so a woman who bleeds seven days is told
// Follicular on day 6 while still bleeding, and the phase selects which hormone
// reference range is quoted back to her.
//
// WHAT THIS FILE PINS.
//   * each question renders ONLY when we do not already hold a valid integer
//   * "valid" is an explicit integer parse, NOT truthiness, so a stored 0 asks again
//   * the bounds are supa migration 0015's CHECK constraints, 15-90 and 1-15
//   * a skip omits the key entirely, and never sends null or a default
//   * a hidden question is never collected, because we did not put it to her
//
// The harness is lifted from test-cycle-lens.mjs so the DOM stub and sandbox are
// the house ones rather than a second, divergent copy.
//
//   node scripts/test-cycle-capture.mjs
import { readFileSync } from "node:fs";
import { extractApp } from "./lib/extract-app.mjs";
import vm from "node:vm";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

const SRC = extractApp(HTML, FILE);

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
const PROFILE_OVERRIDES = JSON.parse(process.env.PROFILE_OVERRIDES || "{}");
const profileRow = Object.assign({
  full_name: "Fresh Tester",
  dob: "1990-04-11",
  age_affirmed_at: "2026-09-05T20:38:24.000Z",
  consent_accepted_at: "2026-09-05T20:39:00.000Z",
  supp_b12: null, supp_folate: null, supp_status_updated_at: null,
  confounders: null, supplements: null, context_note: null,
  menstrual_status: null, cycle_status: null, life_stage: null,
  pregnant_or_postpartum_within_6_months: null,
  amenorrhea_reason: null, hormone_therapy_status: null,
}, PROFILE_OVERRIDES);

const selectArgs = [];
const updates = [];
const thenable = (data) => {
  const p = { data, error: null };
  const chain = new Proxy(function(){}, {
    get(_, k) {
      if (k === "then") return (res) => Promise.resolve(p).then(res);
      // Record what was actually asked for. Asserting on the stubbed ROW cannot
      // catch a wrong select string, because the stub returns every key whatever
      // the query said. The mutation ledger caught exactly that.
      if (k === "select") return (cols) => { selectArgs.push(String(cols || "")); return chain; };
      if (k === "update") return (payload) => { updates.push(payload); return chain; };
      return () => chain;
    },
    apply() { return chain; },
  });
  return chain;
};

const sb = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "c372a949-0000-4000-8000-000000000000",
                                 email: "fresh@example.test",
                                 user_metadata: { full_name: "Fresh Tester", age_affirmed: true } } } } }),
    getUser: async () => ({ data: { user: null } }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
  },
  from: (t) => { calls.push("from:" + t); return thenable(t === "profiles" ? profileRow : []); },
  rpc: () => thenable(null),
  storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
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

// The lens elements the real applyCycleLens toggles. The shared DOM stub returns a
// fresh element per getElementById call, which cannot hold state, so these four are
// pinned to stable objects and their `hidden` class is recorded.
const lensEls = {};
const mkTracked = (id) => (lensEls[id] = { id, _hidden: true, textContent: "",
  classList: {
    add(c){ if(c === "hidden") lensEls[id]._hidden = true; },
    remove(c){ if(c === "hidden") lensEls[id]._hidden = false; },
    toggle(c, f){ if(c === "hidden") lensEls[id]._hidden = (f === undefined ? !lensEls[id]._hidden : !!f); },
    contains(c){ return c === "hidden" ? lensEls[id]._hidden : false; },
  },
  value: "", getAttribute(){ return null; }, setAttribute(){}, querySelectorAll(){ return []; },
  addEventListener(){}, appendChild(){}, focus(){},
});
["cyc-lens","cyc-cdgroup","cyc-lengroup","cyc-hcgroup","cyc-lmp-label","cyc-heading",
 "cyc-len-q","cyc-dur-q","cyc-len","cyc-dur","cyc-lmp","cyc-cd"].forEach(mkTracked);
const baseGet = documentStub.getElementById;
documentStub.getElementById = (id) => (id in lensEls ? lensEls[id] : baseGet(id));

let pass = 0, fail = 0;
const ok = (c, m) => { let v; try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  return v ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)); };

const WRAPPED = SRC + "\n;globalThis.__T = {" +
  " lens: (s) => applyCycleLens(s), PROFILE: () => PROFILE," +
  " derive: (a, s) => deriveMenstrualFrom(a, s)," +
  " cq: () => cq, cqCommit: () => cqCommit(), cqRender: () => cqRender()," +
  " initQ: () => initCycleQuestions(), onb2Derive: () => onb2DeriveMenstrual(), onb2: () => onb2," +
  " collect: () => collectCycle(), gate: () => applyCycleLenGate()," +
  " needsLen: () => cycNeedsLen(), needsDur: () => cycNeedsDur()," +
  " setProfile: (o) => { PROFILE = o; }, cycSel: () => cycSel," +
  "};";
process.on("unhandledRejection", (err) => { if (!bootError) bootError = err; });
try { new vm.Script(WRAPPED, { filename: "dashboard-inline.js" }).runInContext(sandbox, { timeout: 20000 }); }
catch (err) { bootError = bootError || err; }
await new Promise((r) => setTimeout(r, 250));

const shown = (id) => !lensEls[id]._hidden;
const reset = () => { ["cyc-lens","cyc-cdgroup","cyc-lengroup","cyc-hcgroup"].forEach((i) => { lensEls[i]._hidden = true; });
                      lensEls["cyc-lmp-label"].textContent = ""; };
const mode = () => (!shown("cyc-lens") ? "hidden" : (shown("cyc-cdgroup") ? "LMP + cycle day" : "LMP only"));

console.log("HARNESS");
if (bootError) console.log("       boot threw -> " + String(bootError && bootError.message || bootError));
ok(!bootError, "H-1: the script booted");
ok(typeof sandbox.__T.collect === "function", "H-2: collectCycle is reachable");
ok(typeof sandbox.__T.gate === "function", "H-3: applyCycleLenGate is reachable");

const T = sandbox.__T;
const setStored = (len, dur) => T.setProfile({ typical_cycle_length_days: len, typical_period_duration_days: dur });
const answer = (len, dur) => { lensEls["cyc-len"].value = len; lensEls["cyc-dur"].value = dur; };
const shownQ = (id) => { T.gate(); return !lensEls[id]._hidden; };

// CONTROL: the tracker must actually track, or every assertion below is vacuous.
lensEls["cyc-len-q"]._hidden = true;
lensEls["cyc-len-q"].classList.remove("hidden");
ok(lensEls["cyc-len-q"]._hidden === false, "H-4 CONTROL: the hidden tracker records a change");

console.log("\nRENDERS WHEN WE DO NOT ALREADY HOLD AN ANSWER");
// NO FLOAT ROW, deliberately. parseInt("28.5") truncates to 28 and would be
// accepted, but migration 0015 declares both columns smallint, so a fractional
// value is not a state the database can hold. Asserting on it would be testing a
// row the application cannot produce, which is how a suite starts proving things
// about states that do not exist.
const ABSENT = [["absent", undefined], ["null", null], ["empty string", ""],
                ["a non-integer string", "about a month"], ["zero", 0]];
for (const [label, v] of ABSENT) {
  setStored(v, v);
  ok(shownQ("cyc-len-q"), "R-len-" + label + ": cycle length asks when stored is " + label);
  ok(shownQ("cyc-dur-q"), "R-dur-" + label + ": period length asks when stored is " + label);
}
// WHICH ROW CATCHES WHAT, measured by mutation rather than assumed. Writing the
// gate as `!v` does NOT fail on zero, because `!0` is true and it still asks; the
// row that catches truthiness is the non-integer STRING, since `!"about a month"`
// is false and the question silently disappears. Zero is caught instead by a gate
// that checks Number.isInteger without the range, since 0 is an integer. Both
// rows are load-bearing and neither substitutes for the other.
setStored(0, 0);
ok(T.needsLen() && T.needsDur(), "R-zero-explicit: a stored 0 is not a valid answer and still asks");

console.log("\nDOES NOT RENDER WHEN A VALID INTEGER IS STORED");
setStored(28, 5);
ok(!shownQ("cyc-len-q"), "N-1: cycle length is not asked again when 28 is stored");
ok(!shownQ("cyc-dur-q"), "N-2: period length is not asked again when 5 is stored");
setStored("28", "5");
ok(!shownQ("cyc-len-q") && !shownQ("cyc-dur-q"), "N-3: a numeric STRING from the row still counts as answered");

console.log("\nBOUNDS, FROM MIGRATION 0015: 15-90 AND 1-15");
const collectWith = (len, dur) => { setStored(null, null); answer(len, dur); T.gate(); return T.collect(); };
ok(collectWith(15, 1).typical_cycle_length_days === 15, "B-1: 15 is accepted, the low bound");
ok(collectWith(90, 1).typical_cycle_length_days === 90, "B-2: 90 is accepted, the high bound");
ok(!("typical_cycle_length_days" in collectWith(14, 1)), "B-3: 14 is one past the low bound and omitted");
ok(!("typical_cycle_length_days" in collectWith(91, 1)), "B-4: 91 is one past the high bound and omitted");
ok(collectWith(28, 1).typical_period_duration_days === 1, "B-5: 1 is accepted, the low bound");
ok(collectWith(28, 15).typical_period_duration_days === 15, "B-6: 15 is accepted, the high bound");
ok(!("typical_period_duration_days" in collectWith(28, 0)), "B-7: 0 is one past the low bound and omitted");
ok(!("typical_period_duration_days" in collectWith(28, 16)), "B-8: 16 is one past the high bound and omitted");

console.log("\nA SKIP OMITS THE KEY, NEVER NULL AND NEVER A DEFAULT");
const skipped = collectWith("", "");
ok(!("typical_cycle_length_days" in skipped), "S-1: a blank cycle length omits the key entirely");
ok(!("typical_period_duration_days" in skipped), "S-2: a blank period length omits the key entirely");
ok(skipped.typical_cycle_length_days === undefined, "S-3: and it is absent, not null");
// CONTROL: the same collector DOES emit when answered, so S-1/S-2 are not passing
// because collectCycle returns an empty object no matter what.
const answered = collectWith(30, 6);
ok(answered.typical_cycle_length_days === 30 && answered.typical_period_duration_days === 6,
   "S-4 CONTROL: the collector emits both keys when both are answered");

console.log("\nA QUESTION WE DID NOT ASK IS NOT COLLECTED");
setStored(28, 5); answer(31, 7); T.gate();
const stale = T.collect();
ok(!("typical_cycle_length_days" in stale) && !("typical_period_duration_days" in stale),
   "H-ASK: with both already stored, neither key is sent even if the inputs hold values");

console.log("\nTHE TIMEZONE FIELD IS UNAFFECTED");
setStored(null, null); answer("", "");
ok(typeof collectWith("", "").timezone === "string" || !("timezone" in collectWith("", "")),
   "TZ-1: collectCycle still returns a timezone-shaped result");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
