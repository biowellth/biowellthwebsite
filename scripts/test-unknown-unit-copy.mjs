#!/usr/bin/env node
// UNKNOWN_UNIT_COPY_V1 -- the ruled copy on a marker row whose status is unknown_unit.
//
// RULED 2026-09-21, verbatim:
//   Not scored. Your lab reported this in a unit we can't read yet.
// "Not scored." is the label; the sentence is the explanation. It says nothing about whether
// her result is good or bad, and must not be styled amber or red.
//
// WHY THE NEIGHBOURS ARE ASSERTED TOO. unknown_unit, not_scored and no_value all render a grey
// s-none dot and all three sit in REPORT_NOT_SCORED_STATUS, so a change aimed at one is one
// careless predicate away from catching the other two. They mean different things -- we could
// not read the unit / we have no scored range for this marker / no value was captured -- so
// each is pinned here, and the two out-of-scope ones are pinned as UNCHANGED.
//
// EVERY ABSENCE ASSERTION HAS A CONTROL BESIDE IT. "no amber class on this row" is satisfied by
// a row that failed to render at all, so a flagged row is rendered in the same run and asserted
// to carry the amber/coral classes the unknown_unit row must not.
//
//   node scripts/test-unknown-unit-copy.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const SRC = extractApp(readFileSync(FILE, "utf8"), FILE);

// The ruled copy, as one string. Written once so an assertion cannot drift from the ruling.
const RULED = "Not scored. Your lab reported this in a unit we can't read yet.";
const RULED_HTML = '<div class="mk-note">' + RULED + "</div>";

let pass = 0, fail = 0;
const ok = (c, m) => {
  let v;
  try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  if (v) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); }
};

// ── a DOM permissive enough that only REAL errors surface ────────────────────
function mkAny() {
  return new Proxy({
    style: {}, classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    dataset: {}, children: [], value: "", textContent: "", innerHTML: "",
    checked: false, disabled: false, onclick: null, onchange: null,
    appendChild(){}, removeChild(){}, remove(){}, setAttribute(){}, removeAttribute(){},
    getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    querySelector(){ return mkAny(); }, querySelectorAll(){ return []; },
    closest(){ return null; }, focus(){}, blur(){}, scrollIntoView(){}, click(){},
    insertAdjacentHTML(){}, cloneNode(){ return mkAny(); },
    getBoundingClientRect(){ return { top:0,left:0,width:0,height:0,bottom:0,right:0 }; },
  }, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; } });
}

function boot() {
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    document: { getElementById: () => mkAny(), querySelector: () => mkAny(),
                querySelectorAll: () => [], addEventListener(){}, createElement: () => mkAny(),
                body: mkAny(), documentElement: mkAny() },
    window: { addEventListener(){}, matchMedia: () => ({ matches:false, addEventListener(){} }) },
    location: { search:"", hash:"", pathname:"/dashboard", replace(){}, assign(){} },
    history: { pushState(){}, replaceState(){} },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    fetch: async () => ({ ok:true, json: async () => ({}) }),
    IntersectionObserver: class { observe(){} disconnect(){} },
    ResizeObserver: class { observe(){} disconnect(){} },
    navigator: { userAgent:"node", language:"en-GB" },
    Intl, Date, JSON, Math, Object, Array, String, Number, Boolean, Promise, Set, Map, RegExp, Error,
    supabase: { createClient: () => ({
      auth: { getSession: async () => ({ data:{ session:null } }), onAuthStateChange(){},
              getUser: async () => ({ data:{ user:null } }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data:null }),
              single: async () => ({ data:null }), limit: () => ({ maybeSingle: async () => ({ data:null }) }) }) }) }),
      functions: { invoke: async () => ({ data:null, error:null }) },
      storage: { from: () => ({}) },
    }) },
  };
  ctx.globalThis = ctx; ctx.self = ctx; Object.assign(ctx.window, ctx);
  vm.createContext(ctx);
  new vm.Script(SRC).runInContext(ctx);
  return ctx;
}

const ctx = boot();

// A marker carrying a real value and unit, so the row has something to show besides the note.
const row = (status) => ctx.markerRowHTML({
  marker_id: "ferritin", display_name: "Ferritin",
  status, value: 46.5, unit: "ug/mg", band: null,
});
// Just the collapsed row + its note, never the expanded detail — the detail carries authored
// marker prose that would make a substring search mean something else.
const rowOnly = (h) => h.split('<div class="sm-mk-detail">')[0];

console.log("UNKNOWN_UNIT_COPY_V1");

// ── 1. reachability, before any verdict is trusted ───────────────────────────
console.log("REACHABILITY — the assertions below must be reaching the real renderer");
ok(typeof ctx.markerRowHTML === "function", "R-1: markerRowHTML is in the app block (got " + typeof ctx.markerRowHTML + ")");
ok(typeof ctx.sysStatus === "function", "R-2: sysStatus is in the app block (got " + typeof ctx.sysStatus + ")");
const UU = row("unknown_unit"), NS = row("not_scored"), NV = row("no_value"), FLAG = row("low");
ok(UU.includes('data-mid="ferritin"'), "R-3: the unknown_unit call rendered a real marker row");
ok(ctx.sysStatus("unknown_unit").cls === "s-none", "R-4: unknown_unit buckets to s-none (got " + ctx.sysStatus("unknown_unit").cls + ")");
// The mutants edit the isUnknownUnit branch. Prove a row REACHES that branch: the unknown_unit
// row differs from the same marker rendered under a status that does not take it.
ok(UU !== NV, "R-5: the unknown_unit branch changes the output — the mutated path is reached");

// ── 2. the ruled copy, verbatim ──────────────────────────────────────────────
console.log("\nTHE RULED COPY");
ok(rowOnly(UU).includes(RULED), "UU-1: the unknown_unit row shows the ruled sentence");
ok(rowOnly(UU).includes(RULED_HTML), "UU-2: and it is inside .mk-note, the existing grey note class");
ok((rowOnly(UU).match(/Not scored\. Your lab reported this in a unit we can't read yet\./g) || []).length === 1,
   "UU-3: exactly once (got " + (rowOnly(UU).match(/Not scored\. Your lab reported this in a unit we can't read yet\./g) || []).length + ")");
ok(!rowOnly(UU).includes("could not be matched to our reference"), "UU-4: the superseded wording is gone");
ok(rowOnly(UU).includes("46.5 ug/mg"), "UU-5: the value is still shown as reported — not scored is not the same as not shown");

// ── 3. the neighbours are UNCHANGED ──────────────────────────────────────────
console.log("\nOUT OF SCOPE — not_scored and no_value must not have moved");
ok(!rowOnly(NS).includes(RULED), "NS-1: a not_scored row does NOT show the ruled copy");
ok(rowOnly(NS).includes("We do not have a scored reference range for this marker yet"),
   "NS-1-CONTROL: it still shows its OWN copy, so NS-1 is not passing on an empty row");
ok(!rowOnly(NV).includes(RULED), "NV-1: a no_value row does NOT show the ruled copy");
ok(!rowOnly(NV).includes('class="mk-note"'), "NV-2: a no_value row still carries no note at all");
ok(rowOnly(NV).includes('data-mid="ferritin"'),
   "NV-2-CONTROL: the no_value row DID render, so NV-1 and NV-2 are not passing on an empty string");

// ── 4. never amber, never red ────────────────────────────────────────────────
console.log("\nNEVER AMBER, NEVER RED — we did not read this result, so we say nothing about it");
const WARN = ["s-watch", "s-flag", "mk-note-amber", "mk-note-coral"];
for (const c of WARN) {
  ok(!rowOnly(UU).includes(c), "CLS-" + c + ": the unknown_unit row carries no " + c);
}
ok(rowOnly(UU).includes('<span class="mdot s-none">'), "CLS-1: it carries the neutral s-none dot instead");
// CONTROL: the same assertion shape on a row that SHOULD be coloured. If this goes green the
// four above are vacuous — a renderer that emitted nothing would satisfy them.
ok(rowOnly(FLAG).includes("s-flag"),
   "CLS-CONTROL: a low-status row DOES carry s-flag, so the four absences above can fail");
ok(!rowOnly(FLAG).includes(RULED), "CLS-2: and a flagged row shows no unscored copy");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
