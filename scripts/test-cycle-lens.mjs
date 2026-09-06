#!/usr/bin/env node
// LENS_FROM_PROFILE_V2 -- the cycle lens, driven from the stored profile.
//
// THE REGRESSION IT CATCHES: applyCycleLens had ZERO callers. The comment in
// mountAboutDraw said the lens was driven "by LENS_FROM_PROFILE_V1 in
// initCycleCapture, which does its own read" -- there is no such code. So the
// lens has been permanently hidden for every user since the prefill was retired
// on 2026-09-02, and a comment naming a mechanism that does not exist is what
// stopped anyone looking.
//
// It also pins the one-line change at the withLens branch: `null` is the
// no-periods answer and earns an LMP-only lens, while `undefined` is unanswered
// and stays hidden. Those two are easy to collapse and they mean opposite things.
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
["cyc-lens","cyc-cdgroup","cyc-lengroup","cyc-hcgroup","cyc-lmp-label","cyc-heading"].forEach(mkTracked);
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
ok(typeof sandbox.__T.lens === "function", "H-2: applyCycleLens is reachable");
// CONTROL: the tracker must actually track, or every 'hidden' below is meaningless.
reset(); lensEls["cyc-lens"]._hidden = false;
ok(shown("cyc-lens"), "H-3: CONTROL — the element tracker records a visible element");
reset();
ok(!shown("cyc-lens"), "H-4: CONTROL — and records a hidden one");

console.log("\nLENS MODE BY STORED STATUS");
const cases = [
  ["regular",        "LMP + cycle day"],
  ["irregular",      "LMP + cycle day"],
  ["perimenopausal", "LMP + cycle day"],
  ["postmenopausal", "LMP only"],
  ["pregnant",       "LMP only"],
  [null,             "LMP only"],
  [undefined,        "hidden"],
  ["decline",        "hidden"],
];
for (const [status, want] of cases) {
  reset();
  sandbox.__T.lens(status);
  ok(mode() === want, "L-" + String(status) + ": " + String(status) + " -> " + want + " (got " + mode() + ")");
}

console.log("\nTHE null / undefined DISTINCTION");
reset(); sandbox.__T.lens(null);
ok(shown("cyc-lens"), "N-1: null SHOWS the lens (the no-periods answer)");
ok(!shown("cyc-cdgroup"), "N-2: null hides the cycle-day group, so it is LMP only");
reset(); sandbox.__T.lens(undefined);
ok(!shown("cyc-lens"), "N-3: undefined HIDES the lens (unanswered is not an answer)");

console.log("\nLABEL");
reset(); sandbox.__T.lens("postmenopausal");
ok(/if you remember/.test(lensEls["cyc-lmp-label"].textContent),
   "B-1: postmenopausal softens the label");
reset(); sandbox.__T.lens("regular");
ok(lensEls["cyc-lmp-label"].textContent === "When did your last period start?",
   "B-2: every other cycling status keeps the default label");

console.log("\nPROFILE IS SELECTED AND CARRIED");
const P = sandbox.__T.PROFILE();
const selectStr = selectArgs.join(" | ");
// CONTROL: the recorder must have seen a select at all, or every check below is
// satisfied by an empty string and means nothing.
ok(selectArgs.length > 0, "P-0: CONTROL — a select() call was recorded (" + selectArgs.length + ")");
ok(/full_name/.test(selectStr), "P-1: CONTROL — the recorded select is the profiles one");
for (const col of ["menstrual_status","cycle_status","life_stage",
                   "pregnant_or_postpartum_within_6_months","amenorrhea_reason","hormone_therapy_status"]) {
  ok(selectStr.includes(col), "P-" + col + ": the SELECT STRING asks for " + col);
  ok(col in P, "P-" + col + "-row: PROFILE carries " + col);
}


// ── CYCLE_QUESTIONS_V1 ───────────────────────────────────────────────────────
console.log("\nTHE PURE HELPER IS THE SAME LOGIC");
// deriveMenstrualFrom replaced the body of onb2DeriveMenstrual. Pin that the
// extraction did not change a single branch.
const D = sandbox.__T.derive;
const dcases = [
  [{ preg: true }, {}, "pregnant"],
  [{ preg: false, life_stage: "perimenopause" }, {}, "perimenopausal"],
  [{ preg: false, life_stage: "postmenopause" }, {}, "postmenopausal"],
  [{ preg: false, life_stage: "premenopause", cycle_status: "regular" }, {}, "regular"],
  [{ preg: false, cycle_status: "pcos" }, {}, "irregular"],
  [{ preg: false, cycle_status: "irregular" }, {}, "irregular"],
  [{ preg: false, cycle_status: "none" }, {}, null],
  [{ preg: false, cycle_status: "amenorrheic" }, {}, null],
  [{ preg: false }, {}, undefined],
  [{}, {}, undefined],
];
for (const [a, st, want] of dcases) {
  const got = D(a, st);
  ok(got === want, "D: " + JSON.stringify(a) + " -> " + String(want) + " (got " + String(got) + ")");
}
ok(D(null, null) === undefined, "D-null: null inputs do not throw");
ok(D({}, { pregnant_or_postpartum_within_6_months: true }) === "pregnant",
   "D-stored: the stored row is the fallback when the answer is absent");

console.log("\nTHE WRAPPER STILL DELEGATES");
// onb2DeriveMenstrual keeps its name and every existing caller. Prove it is not
// a stub: it must agree with the helper on the same inputs, including a case
// where the two could plausibly diverge.
const O = sandbox.__T.onb2();
for (const [ans, want] of [
  [{ preg: true }, "pregnant"],
  [{ preg: false, cycle_status: "regular" }, "regular"],
  [{ preg: false, cycle_status: "none" }, null],
  [{}, undefined],
]) {
  O.ans = ans; O.stored = {};
  const viaWrapper = sandbox.__T.onb2Derive();
  ok(viaWrapper === want,
     "W: onb2DeriveMenstrual(" + JSON.stringify(ans) + ") -> " + String(want) + " (got " + String(viaWrapper) + ")");
  ok(viaWrapper === D(ans, {}), "W: and it agrees with deriveMenstrualFrom on the same inputs");
}
O.ans = {}; O.stored = {};

console.log("\nEIGHT STATES: payload and lens mode");
const cqSet = (preg, cycle, reason, ht) => {
  const c = sandbox.__T.cq();
  c.preg = preg; c.cycle = cycle; c.reason = reason || null; c.ht = ht || null;
};
const states = [
  ["Q1 Yes",            "yes",  null,             null, null,
   { pregnant_or_postpartum_within_6_months: true, life_stage: null, cycle_status: null,
     menstrual_status: "pregnant", amenorrhea_reason: null, hormone_therapy_status: null }, "LMP only"],
  ["Regular",           "no",   "regular",        null, "yes",
   { pregnant_or_postpartum_within_6_months: false, life_stage: "premenopause", cycle_status: "regular",
     menstrual_status: "regular", amenorrhea_reason: null, hormone_therapy_status: "yes" }, "LMP + cycle day"],
  ["Irregular or PCOS", "no",   "irregular_pcos", null, "no",
   { pregnant_or_postpartum_within_6_months: false, life_stage: null, cycle_status: "pcos",
     menstrual_status: "irregular", amenorrhea_reason: null, hormone_therapy_status: "no" }, "LMP + cycle day"],
  ["No periods",        "no",   "none",           "breastfeeding", "not_sure",
   { pregnant_or_postpartum_within_6_months: false, life_stage: null, cycle_status: "none",
     menstrual_status: null, amenorrhea_reason: "breastfeeding", hormone_therapy_status: "not_sure" }, "LMP only"],
  ["Perimenopause",     "no",   "perimenopause",  null, null,
   { pregnant_or_postpartum_within_6_months: false, life_stage: "perimenopause", cycle_status: null,
     menstrual_status: "perimenopausal", amenorrhea_reason: null, hormone_therapy_status: null }, "LMP + cycle day"],
  ["Postmenopause",     "no",   "postmenopause",  null, "yes",
   { pregnant_or_postpartum_within_6_months: false, life_stage: "postmenopause", cycle_status: null,
     menstrual_status: "postmenopausal", amenorrhea_reason: null, hormone_therapy_status: "yes" }, "LMP only"],
];
for (const [label, preg, cycle, reason, ht, want, wantMode] of states) {
  updates.length = 0; reset(); cqSet(preg, cycle, reason, ht);
  await sandbox.__T.cqCommit();
  ok(updates.length === 1, "S-" + label + ": exactly one profiles update (got " + updates.length + ")");
  ok(JSON.stringify(updates[0]) === JSON.stringify(want),
     "S-" + label + ": payload matches\n         got  " + JSON.stringify(updates[0]) +
     "\n         want " + JSON.stringify(want));
  ok(mode() === wantMode, "S-" + label + ": lens " + wantMode + " (got " + mode() + ")");
}

console.log("\nPREFER NOT TO SAY AND UNANSWERED WRITE NOTHING");
// Regression: cqRender used to derive against the LIVE PROFILE, which cqCommit
// mutates. After answering Regular, switching to Prefer not to say still derived
// "regular" from the value just written and left the lens open on a withdrawn
// answer. The snapshot fixes it, and these two assertions run AFTER the six
// successful writes above precisely so they would catch it again.
updates.length = 0; reset(); cqSet("no", "decline", null, null);
await sandbox.__T.cqCommit();
ok(updates.length === 0, "S-decline: NO profiles update (got " + updates.length + ")");
ok(mode() === "hidden", "S-decline: the lens stays hidden");
updates.length = 0; reset(); cqSet(null, null, null, null);
await sandbox.__T.cqCommit();
ok(updates.length === 0, "S-none: nothing answered writes nothing (got " + updates.length + ")");
ok(mode() === "hidden", "S-none: the lens stays hidden");

console.log("\nVISIBILITY RULES MATCH THE MOCK");
const vis = (id) => !lensEls[id] && baseGet(id) ? null : null;
const qEls = {};
for (const id of ["cq-cycle","cq-reason","cq-ht","cq-ht-t","cyc-questions"]) qEls[id] = mkTracked(id);
cqSet("yes", null, null, null); sandbox.__T.cqRender();
ok(qEls["cq-cycle"]._hidden, "V-1: Q1 Yes hides Q2");
ok(qEls["cq-reason"]._hidden, "V-2: Q1 Yes hides Q3");
ok(qEls["cq-ht"]._hidden, "V-3: Q1 Yes hides Q4");
// The UI clears cq.cycle when Q1 becomes Yes, so V-3 alone passes even with the
// pregnancy guard removed. Set BOTH and prove the guard itself is doing work.
cqSet("yes", "regular", null, null); sandbox.__T.cqRender();
ok(qEls["cq-ht"]._hidden, "V-3b: Q1 Yes hides Q4 even with a cycle answer still set");
cqSet("yes", "postmenopause", null, null); sandbox.__T.cqRender();
ok(qEls["cq-ht"]._hidden, "V-3c: and with postmenopause set, which would otherwise show Q4");
cqSet("yes", null, null, null); sandbox.__T.cqRender();
cqSet("no", "none", null, null); sandbox.__T.cqRender();
ok(!qEls["cq-reason"]._hidden, "V-4: No periods shows Q3");
ok(!qEls["cq-ht"]._hidden, "V-5: No periods shows Q4");
cqSet("no", "regular", null, null); sandbox.__T.cqRender();
ok(qEls["cq-reason"]._hidden, "V-6: Regular hides Q3");
ok(!qEls["cq-ht"]._hidden, "V-7: Regular shows Q4");
cqSet("no", "decline", null, null); sandbox.__T.cqRender();
ok(qEls["cq-ht"]._hidden, "V-8: Prefer not to say hides Q4");
cqSet("no", "postmenopause", null, null); sandbox.__T.cqRender();
ok(qEls["cq-ht-t"].textContent === "Are you using hormone therapy right now?",
   "V-9: Postmenopause uses the hormone-therapy-only wording");
cqSet("no", "regular", null, null); sandbox.__T.cqRender();
ok(/hormonal contraception or hormone therapy/.test(qEls["cq-ht-t"].textContent),
   "V-10: every other answer keeps the full wording");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
