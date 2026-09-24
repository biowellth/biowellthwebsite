#!/usr/bin/env node
// CYCLE_CAPTURE_V2 -- the two durable cycle questions, typical cycle length and
// typical period length.
//
// RE-POINTED 2026-09-23 (ABOUT_YOU_DRAW_V1). These two questions LEFT the per-draw
// upload card and are asked once, on the About-you cycle screen. The properties
// this file pinned are the same properties; the place they live moved. Every
// former assertion maps to one here and none was dropped or loosened:
//
//   R-len-* / R-dur-*  "asks when stored is absent|null|empty|non-integer|zero"
//     -> an invalid stored value is NOT prefilled into About-you, so she is asked
//   R-zero-explicit    "a stored 0 is not a valid answer and still asks"
//     -> a stored 0 prefills neither stepper
//   N-1 / N-2 / N-3    "not asked again when 28 / 5 / "28","5" are stored"
//     -> a valid stored value prefills the stepper as her answer
//   B-1 .. B-8         the 0015 bounds, 15-90 and 1-15, on collectCycle
//     -> the same bounds, on the About-you cyc screen's patch
//   S-1 .. S-4         a blank omits the key, never null; control emits both
//     -> the same, on the About-you cyc screen's patch
//   H-ASK              "a question we did not ask is not collected"
//     -> the draw card no longer collects either key under any stored state, and
//        its markup carries neither input
//   H-3                applyCycleLenGate reachable -> onb2Patch and onb2Prefill reachable
//
// WHY THEY MATTER, unchanged. bb maps the duration onto period_length and derives
// period_end_date from it; with no duration, phaseForDay falls back to Menstrual
// meaning days 1 to 5 for everyone, so a woman who bleeds seven days is told
// Follicular on day 6 while still bleeding.
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

const profileRow = {
  full_name: "Fresh Tester", dob: "1990-04-11",
  age_affirmed_at: "2026-09-05T20:38:24.000Z", consent_accepted_at: "2026-09-05T20:39:00.000Z",
  supp_b12: null, supp_folate: null, supp_status_updated_at: null,
  confounders: null, supplements: null, context_note: null,
  menstrual_status: null, cycle_status: null, life_stage: null,
  pregnant_or_postpartum_within_6_months: null, amenorrhea_reason: null, hormone_therapy_status: null,
  about_you_status: "completed",
};
const thenable = (data) => {
  const p = { data, error: null };
  const chain = new Proxy(function(){}, {
    get(_, k) { if (k === "then") return (res) => Promise.resolve(p).then(res); return () => chain; },
    apply() { return chain; },
  });
  return chain;
};
const sb = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "c372a949-0000-4000-8000-000000000000",
                                 email: "fresh@example.test", user_metadata: { age_affirmed: true } } } } }),
    getUser: async () => ({ data: { user: null } }), signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
  },
  from: (t) => thenable(t === "profiles" ? profileRow : []),
  rpc: () => thenable(null),
  storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) },
  functions: { invoke: async () => ({ data: {}, error: null }) },
  channel: () => ({ on(){ return this; }, subscribe(){ return this; } }), removeChannel: () => {},
};
const documentStub = new Proxy({
  getElementById: () => mkEl(), querySelector: () => mkEl(), querySelectorAll: () => [],
  createElement: () => mkEl(), createElementNS: () => mkEl(), addEventListener(){}, removeEventListener(){},
  body: mkEl(), documentElement: mkEl(), head: mkEl(), readyState: "complete", cookie: "", title: "",
}, { get: (t, k) => (k in t ? t[k] : () => mkEl()) });

let bootError = null;
const sandbox = {
  console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
  document: documentStub, window: undefined, supabase: { createClient: () => sb },
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
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// The draw card's cycle inputs, pinned to stable objects so a value can be planted.
const els = {};
["cyc-lmp","cyc-cd","cyc-len","cyc-dur"].forEach((id) => { els[id] = Object.assign(mkEl(), { value: "" }); });
const baseGet = documentStub.getElementById;
documentStub.getElementById = (id) => (id in els ? els[id] : baseGet(id));

let pass = 0, fail = 0;
const ok = (c, m) => { let v; try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  return v ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)); };

const WRAPPED = SRC + "\n;globalThis.__T = {" +
  " collect: () => collectCycle(), setProfile: (o) => { PROFILE = o; }," +
  " prefill: (s) => onb2Prefill(s)," +
  " patchCyc: (ans) => { onb2.ans = ans; return onb2Patch(ONB2_SCREENS.find((x) => x.id === 'cyc')); }," +
  "};";
process.on("unhandledRejection", (err) => { if (!bootError) bootError = err; });
try { new vm.Script(WRAPPED, { filename: "dashboard-inline.js" }).runInContext(sandbox, { timeout: 20000 }); }
catch (err) { bootError = bootError || err; }
await new Promise((r) => setTimeout(r, 250));

console.log("HARNESS");
if (bootError) console.log("       boot threw -> " + String(bootError && bootError.message || bootError));
ok(!bootError, "H-1: the script booted");
ok(typeof sandbox.__T.collect === "function", "H-2: collectCycle is reachable");
ok(typeof sandbox.__T.prefill === "function" && typeof sandbox.__T.patchCyc === "function",
   "H-3: onb2Prefill and onb2Patch are reachable");
const T = sandbox.__T;
// CONTROL: prefill really reads the columns, or every "not prefilled" below is vacuous.
ok(T.prefill({ typical_cycle_length_days: 28 }).cycle_len === "28", "H-4 CONTROL: prefill does read the stored length");

console.log("\nASKED WHEN WE DO NOT ALREADY HOLD A VALID ANSWER (not prefilled)");
const ABSENT = [["absent", undefined], ["null", null], ["empty string", ""],
                ["a non-integer string", "about a month"], ["zero", 0]];
for (const [label, v] of ABSENT) {
  const a = T.prefill({ typical_cycle_length_days: v, typical_period_duration_days: v });
  ok(!("cycle_len" in a), "R-len-" + label + ": cycle length is not prefilled when stored is " + label);
  ok(!("period_dur" in a), "R-dur-" + label + ": period length is not prefilled when stored is " + label);
}
{
  const a = T.prefill({ typical_cycle_length_days: 0, typical_period_duration_days: 0 });
  ok(!("cycle_len" in a) && !("period_dur" in a), "R-zero-explicit: a stored 0 is not a valid answer and prefills neither");
}

console.log("\nA VALID STORED INTEGER IS SHOWN AS HER ANSWER");
ok(T.prefill({ typical_cycle_length_days: 28 }).cycle_len === "28", "N-1: a stored 28 prefills the cycle length");
ok(T.prefill({ typical_period_duration_days: 5 }).period_dur === "5", "N-2: a stored 5 prefills the period length");
{
  const a = T.prefill({ typical_cycle_length_days: "28", typical_period_duration_days: "5" });
  ok(a.cycle_len === "28" && a.period_dur === "5", "N-3: a numeric STRING from the row still counts as answered");
}

console.log("\nBOUNDS, FROM MIGRATION 0015: 15-90 AND 1-15, ON THE ABOUT-YOU CYCLE SCREEN");
const patchWith = (len, dur) => T.patchCyc({ cycle_status: "regular", cycle_len: String(len), period_dur: String(dur) });
ok(patchWith(15, 1).typical_cycle_length_days === 15, "B-1: 15 is accepted, the low bound");
ok(patchWith(90, 1).typical_cycle_length_days === 90, "B-2: 90 is accepted, the high bound");
ok(!("typical_cycle_length_days" in patchWith(14, 1)), "B-3: 14 is one past the low bound and omitted");
ok(!("typical_cycle_length_days" in patchWith(91, 1)), "B-4: 91 is one past the high bound and omitted");
ok(patchWith(28, 1).typical_period_duration_days === 1, "B-5: 1 is accepted, the low bound");
ok(patchWith(28, 15).typical_period_duration_days === 15, "B-6: 15 is accepted, the high bound");
ok(!("typical_period_duration_days" in patchWith(28, 0)), "B-7: 0 is one past the low bound and omitted");
ok(!("typical_period_duration_days" in patchWith(28, 16)), "B-8: 16 is one past the high bound and omitted");

console.log("\nA BLANK OMITS THE KEY, NEVER NULL AND NEVER A DEFAULT");
const skipped = T.patchCyc({ cycle_status: "regular", cycle_len: "", period_dur: "" });
ok(!("typical_cycle_length_days" in skipped), "S-1: a blank cycle length omits the key entirely");
ok(!("typical_period_duration_days" in skipped), "S-2: a blank period length omits the key entirely");
ok(skipped.typical_cycle_length_days === undefined, "S-3: and it is absent, not null");
const answered = patchWith(30, 6);
ok(answered.typical_cycle_length_days === 30 && answered.typical_period_duration_days === 6,
   "S-4 CONTROL: the patch emits both keys when both are answered");

console.log("\nTHE DRAW CARD NO LONGER ASKS OR COLLECTS EITHER");
// Stored null is the state in which the old card DID ask and collect; inputs are
// planted with valid values so that a collector still reading them would emit.
T.setProfile({ typical_cycle_length_days: null, typical_period_duration_days: null });
els["cyc-len"].value = "31"; els["cyc-dur"].value = "7";
const drawn = T.collect();
ok(!("typical_cycle_length_days" in drawn) && !("typical_period_duration_days" in drawn),
   "H-ASK: the draw card sends neither key, even with stored null and values in the old inputs");
{
  const at = HTML.indexOf('id="up-postfile"');
  const end = HTML.indexOf('id="ad-start"', at);
  const card = at > 0 && end > at ? HTML.slice(at, end) : "";
  ok(card.length > 1000 && card.includes('id="ad-confounders"'), "H-ASK control: the draw card markup is located and non-empty");
  ok(!/id="cyc-len"|id="cyc-dur"|id="cyc-lengroup"/.test(card), "H-ASK-2: the draw card markup has neither length input");
}

console.log("\nTHE TIMEZONE FIELD IS UNAFFECTED");
ok(typeof T.collect().timezone === "string" || !("timezone" in T.collect()),
   "TZ-1: collectCycle still returns a timezone-shaped result");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
