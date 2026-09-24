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
["cyc-lens","cyc-cdgroup","cyc-hcgroup","cyc-lmp-label","cyc-heading","ad-about"].forEach(mkTracked);
const baseGet = documentStub.getElementById;
documentStub.getElementById = (id) => (id in lensEls ? lensEls[id] : baseGet(id));

let pass = 0, fail = 0;
const ok = (c, m) => { let v; try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  return v ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)); };

// RE-POINTED 2026-09-23 (ABOUT_YOU_DRAW_V1). The draw card's four cycle questions
// (cq*, initCycleQuestions) are gone; the same questions are asked once in About-you,
// and the lens is driven from the STORED profile by aboutDrawRefresh. Hooks follow.
const WRAPPED = SRC + "\n;globalThis.__T = {" +
  " lens: (s) => applyCycleLens(s), PROFILE: () => PROFILE," +
  " derive: (a, s) => deriveMenstrualFrom(a, s)," +
  " onb2Derive: () => onb2DeriveMenstrual(), onb2: () => onb2," +
  " setProfile: (o) => { PROFILE = o; }, lensStatus: () => aboutDrawLensStatus(), refresh: () => aboutDrawRefresh()," +
  " inPath: (id) => onb2InPath(ONB2_SCREENS.find((x) => x.id === id))," +
  " patch: (id) => onb2Patch(ONB2_SCREENS.find((x) => x.id === id)), screens: () => ONB2_SCREENS," +
  " card: (id) => onb2CardHtml(ONB2_SCREENS.find((x) => x.id === id), 0)," +
  "};";
process.on("unhandledRejection", (err) => { if (!bootError) bootError = err; });
try { new vm.Script(WRAPPED, { filename: "dashboard-inline.js" }).runInContext(sandbox, { timeout: 20000 }); }
catch (err) { bootError = bootError || err; }
await new Promise((r) => setTimeout(r, 250));
// The boot-loaded PROFILE, read BEFORE any assertion below replaces it with setProfile.
const P_BOOT = sandbox.__T.PROFILE();

const shown = (id) => !lensEls[id]._hidden;
const reset = () => { ["cyc-lens","cyc-cdgroup","cyc-hcgroup"].forEach((i) => { lensEls[i]._hidden = true; });
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
  // ABOUT_YOU_DRAW_V1 — nothing stored: the last-period question with both fallbacks.
  ["unknown",        "LMP + cycle day"],
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

// CYCLE_DAY_ORDER_V1. DOM ORDER, checked against the RAW MARKUP and not the stub.
// RE-POINTED: #cyc-questions is gone. The property it protected is that the cycle-day
// control never renders ABOVE, or INSIDE, the question it is the fallback for. That
// question is now the last-period lens, so: after #cyc-lens, and outside it.
{
  const iLens = HTML.indexOf('id="cyc-lens"');
  const iCd = HTML.indexOf('id="cyc-cdgroup"');
  const between = iLens > -1 && iCd > iLens ? HTML.slice(iLens, iCd) : "";
  const depth = (between.match(/<div\b/g) || []).length - (between.match(/<\/div>/g) || []).length;
  ok(iLens > -1 && iCd > iLens,
     "ORDER-1: #cyc-cdgroup renders AFTER #cyc-lens (cdgroup at " + iCd + ", lens at " + iLens + ")");
  ok(between.length > 0 && depth <= 0, "ORDER-2: and OUTSIDE it, so hiding the lens cannot hide it by inheritance (depth " + depth + ")");
}
reset(); sandbox.__T.lens(undefined);
ok(!shown("cyc-lens"), "N-3: undefined HIDES the lens (unanswered is not an answer)");
// ABOUT_YOU_DRAW_V1 — the card never passes undefined: nothing stored becomes "unknown".
sandbox.__T.setProfile({});
ok(sandbox.__T.lensStatus() === "unknown", "N-4: with nothing stored the card's lens status is 'unknown', not undefined");
reset(); sandbox.__T.refresh();
ok(mode() === "LMP + cycle day", "N-5: so nothing stored shows the last-period question with its fallbacks (got " + mode() + ")");

console.log("\nLABEL");
reset(); sandbox.__T.lens("postmenopausal");
ok(/if you remember/.test(lensEls["cyc-lmp-label"].textContent),
   "B-1: postmenopausal softens the label");
reset(); sandbox.__T.lens("regular");
ok(lensEls["cyc-lmp-label"].textContent === "When did your last period start?",
   "B-2: every other cycling status keeps the default label");

console.log("\nPROFILE IS SELECTED AND CARRIED");
const P = P_BOOT;
const selectStr = selectArgs.join(" | ");
ok(selectArgs.length > 0, "P-0: CONTROL — a select() call was recorded (" + selectArgs.length + ")");
ok(/full_name/.test(selectStr), "P-1: CONTROL — the recorded select is the profiles one");
for (const col of ["menstrual_status","cycle_status","life_stage",
                   "pregnant_or_postpartum_within_6_months","amenorrhea_reason","hormone_therapy_status"]) {
  ok(selectStr.includes(col), "P-" + col + ": the SELECT STRING asks for " + col);
  ok(col in P, "P-" + col + "-row: PROFILE carries " + col);
}


// ── CYCLE_QUESTIONS_V1 ───────────────────────────────────────────────────────
console.log("\nTHE PURE HELPER IS THE SAME LOGIC");
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

// RE-POINTED: EIGHT STATES. The same six answers, now given in About-you. For each:
// the columns the answered screens write (was: the cqCommit payload), the derived
// menstrual_status, and the lens the draw card shows from the stored result.
console.log("\nSIX STATES, ANSWERED IN ABOUT-YOU: payload and lens mode");
const answerAll = (ans) => {
  O.ans = ans; O.stored = {};
  const out = {};
  for (const id of ["preg","life","cyc","hbc","hbc-ht"]) if (sandbox.__T.inPath(id)) Object.assign(out, sandbox.__T.patch(id));
  return out;
};
const states = [
  ["Q1 Yes",            { preg: true },
   { pregnant_or_postpartum_within_6_months: true, menstrual_status: "pregnant" }, "LMP only"],
  ["Regular",           { preg: false, life_stage: "premenopause", cycle_status: "regular", hormonal_contraception: "current" },
   { pregnant_or_postpartum_within_6_months: false, life_stage: "premenopause", cycle_status: "regular", menstrual_status: "regular",
     amenorrhea_reason: null, hormonal_contraception: "current", on_hormonal_contraception: true }, "LMP + cycle day"],
  ["Irregular or PCOS", { preg: false, cycle_status: "pcos", hormonal_contraception: "none" },
   { pregnant_or_postpartum_within_6_months: false, cycle_status: "pcos", menstrual_status: "irregular",
     amenorrhea_reason: null, hormonal_contraception: "none", on_hormonal_contraception: false }, "LMP + cycle day"],
  ["No periods",        { preg: false, cycle_status: "amenorrheic", amen_reason: "breastfeeding" },
   { pregnant_or_postpartum_within_6_months: false, cycle_status: "amenorrheic", menstrual_status: null,
     amenorrhea_reason: "breastfeeding" }, "LMP only"],
  ["Perimenopause",     { preg: false, life_stage: "perimenopause" },
   { pregnant_or_postpartum_within_6_months: false, life_stage: "perimenopause", menstrual_status: "perimenopausal" }, "LMP + cycle day"],
  ["Postmenopause",     { preg: false, life_stage: "postmenopause", hormone_therapy_status: "yes" },
   { pregnant_or_postpartum_within_6_months: false, life_stage: "postmenopause", menstrual_status: "postmenopausal",
     hormone_therapy_status: "yes" }, "LMP only"],
];
const sortKeys = (o) => JSON.stringify(Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {}));
for (const [label, ans, want, wantMode] of states) {
  const got = answerAll(ans);
  ok(sortKeys(got) === sortKeys(want),
     "S-" + label + ": payload matches\n         got  " + sortKeys(got) + "\n         want " + sortKeys(want));
  ok(got.menstrual_status === want.menstrual_status, "S-" + label + ": menstrual_status " + String(want.menstrual_status));
  sandbox.__T.setProfile(Object.assign({}, got)); reset(); sandbox.__T.refresh();
  ok(mode() === wantMode, "S-" + label + ": lens " + wantMode + " (got " + mode() + ")");
}

// RE-POINTED: "Prefer not to say and unanswered write nothing". There is no Prefer not
// to say option in About-you; its job there is done by leaving a screen unanswered,
// which must write nothing. The regression the old pair caught was a lens deriving
// from a value that no longer described her; here the lens is re-read from the STORED
// profile every time the pop-up closes, so a changed answer changes the lens.
console.log("\nUNANSWERED WRITES NOTHING, AND THE LENS FOLLOWS WHAT IS STORED");
O.ans = {};
ok(["preg","life","cyc"].every((id) => Object.keys(sandbox.__T.patch(id)).length === 0),
   "S-decline: an unanswered pregnancy, life stage or cycle screen writes nothing");
ok(Object.keys(answerAll({})).length === 0, "S-none: nothing answered writes nothing");
sandbox.__T.setProfile({ menstrual_status: "regular" }); reset(); sandbox.__T.refresh();
const m1 = mode();
sandbox.__T.setProfile({ menstrual_status: null, cycle_status: "amenorrheic" }); reset(); sandbox.__T.refresh();
ok(m1 === "LMP + cycle day" && mode() === "LMP only",
   "S-follow: a changed stored answer changes the lens (regular -> " + m1 + ", no periods -> " + mode() + ")");

// RE-POINTED: VISIBILITY RULES. Q1 is the pregnancy screen, Q2 the life and cycle
// screens, Q3 the amenorrhea reason, Q4 the contraception or hormone therapy screen.
console.log("\nVISIBILITY RULES, ON THE ABOUT-YOU PATH");
const inPath = sandbox.__T.inPath;
O.ans = { preg: true };
ok(!inPath("life") && !inPath("cyc"), "V-1: pregnancy Yes takes the life and cycle screens off the path");
ok(!inPath("cyc") && !/Is there a reason/.test(sandbox.__T.card("preg")), "V-2: so the amenorrhea reason is never reached");
ok(!inPath("hbc-ht"), "V-3: pregnancy Yes never shows the hormone therapy question");
O.ans = { preg: true, cycle_status: "regular" };
ok(!inPath("hbc-ht"), "V-3b: even with a cycle answer still set");
O.ans = { preg: true, life_stage: "postmenopause" };
ok(!inPath("hbc-ht"), "V-3c: and with postmenopause set, which would otherwise show it");
O.ans = { preg: false, cycle_status: "amenorrheic" };
ok(/Is there a reason you know of\?/.test(sandbox.__T.card("cyc")), "V-4: No periods shows the reason question");
ok(inPath("hbc"), "V-5: No periods keeps the contraception question");
O.ans = { preg: false, cycle_status: "regular" };
ok(!/Is there a reason you know of\?/.test(sandbox.__T.card("cyc")), "V-6: Regular hides the reason question");
ok(inPath("hbc"), "V-7: Regular keeps the contraception question");
O.ans = { preg: false };
ok(inPath("hbc") && !inPath("hbc-ht"), "V-8: an unanswered life stage keeps the contraception form, never the hormone therapy one");
O.ans = { preg: false, life_stage: "postmenopause" };
ok(inPath("hbc-ht") && !inPath("hbc") && /Are you using hormone therapy right now\?/.test(sandbox.__T.card("hbc-ht")),
   "V-9: Postmenopause uses the hormone-therapy-only wording");
O.ans = { preg: false, life_stage: "perimenopause" };
ok(inPath("hbc") && /hormonal birth control/.test(sandbox.__T.card("hbc")), "V-10: every other answer keeps the contraception wording");
O.ans = {};


// ── CYCLE_DEDUPE_V1 ──────────────────────────────────────────────────────────
console.log("\nEXACTLY ONE CONTRACEPTION QUESTION EXISTS");
// RE-POINTED: counted across BOTH surfaces that ask, the draw card's shipped markup and
// About-you's screen table. The risk is still two askers, which no runtime visibility
// check can see if one of them is hidden in the state you happened to test.
const questionText = [...HTML.matchAll(/<div class="bc-q-t"[^>]*>([\s\S]*?)<\/div>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
const labelText = [...HTML.matchAll(/<label class="cyc-l"[^>]*>([\s\S]*?)<\/label>/g)]
  .map((m) => m[1].replace(/<[^>]+>/g, "").trim());
const allAsks = questionText.concat(labelText);
const CONTRA = /contracept|birth control/i;
const cardAsks = allAsks.filter((t) => CONTRA.test(t));
const aboutAsks = sandbox.__T.screens().filter((s) => CONTRA.test(s.q));
ok(allAsks.length > 0, "X-0: CONTROL — draw card questions were found to count (" + allAsks.length + ")");
ok(cardAsks.length + aboutAsks.length === 1,
   "X-1: exactly ONE contraception question across the draw card and About-you (card " + cardAsks.length +
   ", About-you " + aboutAsks.length + ")");
ok(aboutAsks.length === 1 && aboutAsks[0].key === "hormonal_contraception",
   "X-2: and it is About-you's, the one that writes hormonal_contraception");

console.log("\nTHE LEGACY CONTROLS ARE GONE");
ok(!/id="cyc-hcgroup"/.test(HTML), "X-3: no cyc-hcgroup element in the markup");
ok(!/getElementById\("cyc-hcgroup"\)/.test(HTML), "X-4: and no code reads it any more");
ok(!/id="cyc-decline"/.test(HTML), "X-5: the duplicate 'I don't remember' link is gone");
ok(/id="cyc-forget"/.test(HTML), "X-6: the 'Don't remember' chip is present instead");
ok(/cycSel\.declined = !cycSel\.declined/.test(HTML),
   "X-7: the chip still sets cycSel.declined, so collectCycle keeps emitting cycle_context_declined");
ok(/out\.cycle_context_declined = true/.test(HTML), "X-8: and that payload branch still exists");

console.log("\nTHE HEADING FOLLOWS THE LENS");
for (const [status, wantHidden] of [
  ["regular", false], ["irregular", false], ["perimenopausal", false],
  ["postmenopausal", false], ["pregnant", false], [null, false],
  [undefined, true], ["decline", true], ["unknown", false],
]) {
  reset(); lensEls["cyc-heading"]._hidden = true;
  sandbox.__T.lens(status);
  const headingHidden = lensEls["cyc-heading"]._hidden;
  const lensHidden = !shown("cyc-lens");
  ok(headingHidden === wantHidden,
     "H-" + String(status) + ": heading " + (wantHidden ? "hidden" : "shown") + " (got " + (headingHidden ? "hidden" : "shown") + ")");
  ok(headingHidden === lensHidden,
     "H-" + String(status) + ": heading tracks the lens exactly");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
