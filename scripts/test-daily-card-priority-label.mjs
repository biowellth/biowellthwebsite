#!/usr/bin/env node
// DAILY_CARD_PRIORITY_LABEL_V1 -- the marker name above each daily card action row.
//
// RULED 2026-09-20: the label is the marker's DISPLAY NAME shortened by taking whichever is
// SHORTER, trimmed, of the text before the first parenthetical and the text inside it. No
// parenthetical renders the whole name. If either part is empty use the other; if both are,
// no label. An id that does not resolve renders NO label -- no fallback, no raw id, no empty
// chip.
//
// The shortening rule is length-based, so BOTH directions have to be pinned: "Iron (Serum)"
// keeps the part before, "Thyroid-Stimulating Hormone (TSH)" keeps the part inside. A mutant
// that always takes one side passes half the table, which is why both are here.
//
// THE APP BLOCK IS THE LAST BARE <script>, NOT THE FIRST. A Sentry block was added ahead of the
// app on 2026-09-20, so the first-open/last-close span used by the older test files swallows an
// intervening </script> and does not parse.
//
//   node scripts/test-daily-card-priority-label.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML = readFileSync(process.env.DASH || "dashboard.html", "utf8");
const lines = HTML.split("\n");
const opens = lines.map((l, i) => (l.trim() === "<script>" ? i : -1)).filter((i) => i >= 0);
const closes = lines.map((l, i) => (l.trim() === "</script>" ? i : -1)).filter((i) => i >= 0);
const s = opens[opens.length - 1];
const e = closes.filter((c) => c > s)[0];
if (s == null || e == null) { console.log("  FAIL could not locate the app script block"); process.exit(1); }
// __dcState is `let __dcState = null`, and GAP_MARKER_NAME is a `const`: both are LEXICAL, so
// neither is reachable from the vm context. One test-only line is appended to the EXTRACTED
// source -- THE REPO FILE IS UNTOUCHED -- to install the state under test. GAP_MARKER_NAME is
// never read directly; it is reached only through dcMarkerLabel, which closes over it.
const SRC = lines.slice(s + 1, e).join("\n")
  + "\n;globalThis.__setDcState = (v) => { __dcState = v; };\n";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);

console.log("DAILY_CARD_PRIORITY_LABEL_V1");

// ── the sandbox ──────────────────────────────────────────────────────────────
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
  const captured = { html: null, actListeners: [] };
  const st = { textContent: null }, prog = { textContent: null };
  const host = {
    _html: "",
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; captured.html = v; },
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    querySelector: (sel) => (sel === ".dc-status" ? st : sel === ".dc-prog" ? prog : null),
    querySelectorAll: (sel) => {
      if (sel !== ".dc-act") return [];
      // one stub per rendered row, each recording the events wired onto it
      const n = (captured.html.match(/class="dc-act[ "]/g) || []).length;
      return Array.from({ length: n }, () => {
        const rec = { events: [] };
        captured.actListeners.push(rec);
        return { addEventListener: (ev) => rec.events.push(ev),
                 classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
                 dataset: {}, getAttribute(){ return null; } };
      });
    },
  };
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    document: { getElementById: (id) => (id === "daily-card" ? host : mkAny()),
                querySelector: () => mkAny(), querySelectorAll: () => [], addEventListener(){},
                createElement: () => mkAny(), body: mkAny(), documentElement: mkAny() },
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
  return { ctx, captured, st, prog };
}

const { ctx } = boot();

// ── 1. reachability, before any verdict is trusted ───────────────────────────
eq(typeof ctx.dcShortenMarkerName, "function", "REACHABILITY: dcShortenMarkerName is in the app block");
eq(typeof ctx.dcMarkerLabel, "function", "REACHABILITY: dcMarkerLabel is in the app block");
eq(typeof ctx.dcRenderCard, "function", "REACHABILITY: dcRenderCard is in the app block");

// ── 2. the ruled shortening rule, every clause ───────────────────────────────
const SH = ctx.dcShortenMarkerName;
eq(SH("Iron (Serum)"), "Iron", "BEFORE is shorter: 'Iron (Serum)' keeps the part before");
eq(SH("Vitamin D (25-OH total)"), "Vitamin D", "BEFORE is shorter: 'Vitamin D (25-OH total)'");
eq(SH("Vitamin B9 (Folate, serum)"), "Vitamin B9", "BEFORE is shorter: the parenthetical is longer");
eq(SH("ALT (SGPT)"), "ALT", "BEFORE is shorter by one character");
eq(SH("High-Sensitivity C-Reactive Protein (hs-CRP)"), "hs-CRP", "INSIDE is shorter: hs-CRP wins");
eq(SH("Thyroid-Stimulating Hormone (TSH)"), "TSH", "INSIDE is shorter: TSH wins");
eq(SH("Absolute Lymphocyte Count (ALC)"), "ALC", "INSIDE is shorter: ALC wins");
eq(SH("Ferritin"), "Ferritin", "NO parenthetical: the whole name renders");
eq(SH("Total Cholesterol"), "Total Cholesterol", "NO parenthetical, two words: the whole name renders");
eq(SH("(ALC)"), "ALC", "BEFORE empty: the inside is used");
eq(SH("Iron ()"), "Iron", "INSIDE empty: the before is used");
eq(SH("()"), "", "BOTH empty: the shortener yields nothing");
eq(SH("   Iron   (  Serum  )   "), "Iron", "TRIMMED: surrounding and inner whitespace is stripped");
eq(SH("  Thyroid-Stimulating Hormone ( TSH ) "), "TSH", "TRIMMED on the inside branch too");
eq(SH("Iron (Serum) (Fasting)"), "Iron", "only the FIRST parenthetical is considered");

// ── 3. dcMarkerLabel against the real GAP_MARKER_NAME ────────────────────────
const ML = ctx.dcMarkerLabel;
eq(ML("ferritin"), "Ferritin", "resolves a real id with no parenthetical");
eq(ML("iron_serum"), "Iron", "resolves a real id, before-branch");
eq(ML("tsh"), "TSH", "resolves a real id, inside-branch");
eq(ML("hs_crp"), "hs-CRP", "resolves a real id, inside-branch");
eq(ML("alt"), "ALT", "resolves a real id, before-branch by one character");
// the four ids measured against 650 non-keeper action_pool rows on 2026-09-21
eq(ML("11_deoxycortisol"), null, "UNRESOLVED id returns null, not a fallback (16 rows)");
eq(ML("folate_lcmsms"), null, "UNRESOLVED id returns null, not a fallback (12 rows)");
eq(ML("globulin"), null, "UNRESOLVED id returns null, not a fallback (6 rows)");
eq(ML("uacr"), null, "UNRESOLVED id returns null, not a fallback (5 rows)");
eq(ML(null), null, "a null marker id returns null");
eq(ML(""), null, "an empty marker id returns null");
eq(ML("constructor"), null, "a prototype key does not resolve to a label");
eq(ML("toString"), null, "a prototype key does not resolve to a label");

// ── 4. the render ────────────────────────────────────────────────────────────
function render(three, done = []) {
  const b = boot();
  b.ctx.__setDcState({
    reportId: "r1", todayYMD: "2026-09-21",
    three, done: new Set(done),
  });
  b.ctx.dcRenderCard();
  return b;
}
const act = (id, mid, text, phase = null, pn = null) =>
  ({ action: { action_id: id, priority_marker_id: mid, base_text: text, phase_notes: pn }, phase });

{
  const b = render([
    act("a1", "iron_serum", "Try adding lentils to one meal today."),
    act("a2", "tsh", "Try a ten minute walk after lunch."),
    act("a3", "uacr", "Try keeping water intake steady today."),
  ]);
  const h = b.captured.html;

  ok(h.includes('<div class="dc-label">Iron</div>'), "row 1 renders the Iron label");
  ok(h.includes('<div class="dc-label">TSH</div>'), "row 2 renders the TSH label");
  eq((h.match(/class="dc-label"/g) || []).length, 2,
     "exactly TWO labels render: the unresolved third row has none");

  // the unresolved row carries NO label of any kind
  // split on a BOUNDARY: <div class="dc-actions"> is the wrapper and shares the prefix,
  // so a bare split puts the wrapper at rows[1] and shifts every row by one.
  const rows = h.split(/<div class="dc-act(?=[ "])/);
  const third = rows[3];
  ok(!third.includes("dc-label"), "unresolved row: no label element at all");
  ok(!third.includes("uacr"), "unresolved row: the raw marker id is NOT rendered");
  ok(third.includes("Try keeping water intake steady today."),
     "CONTROL: the unresolved row DID render, so the two assertions above can fire");

  // nothing else about the row changed
  ok(h.includes("Try adding lentils to one meal today."), "base text of row 1 survives");
  ok(h.includes("Try a ten minute walk after lunch."), "base text of row 2 survives");
  eq((h.match(/class="dc-base"/g) || []).length, 3, "all three rows still carry a .dc-base");
  eq((h.match(/data-aid="/g) || []).length, 3, "all three rows still carry data-aid");
  eq((h.match(/class="dc-tick"/g) || []).length, 3, "all three rows still carry a tick");
  ok(h.includes('data-aid="a1"') && h.includes('data-aid="a2"') && h.includes('data-aid="a3"'),
     "the three action ids are unchanged");
  // ORDER: the id of each row must appear in the order it was given
  ok(h.indexOf('data-aid="a1"') < h.indexOf('data-aid="a2"')
     && h.indexOf('data-aid="a2"') < h.indexOf('data-aid="a3"'), "row ordering is unchanged");

  // the label ADDS to the row, it does not replace the base text
  const r1 = rows[1];
  ok(r1.indexOf('class="dc-label"') < r1.indexOf('class="dc-base"'),
     "the label sits ABOVE the base text");
  ok(r1.includes("Try adding lentils to one meal today."),
     "the label did not replace the base text");

  // the tick is still wired
  eq(b.captured.actListeners.length, 3, "dcRenderCard wired all three rows");
  ok(b.captured.actListeners.every((r) => r.events.includes("click")),
     "every row still has its click handler");
  ok(b.captured.actListeners.every((r) => r.events.includes("keydown")),
     "every row still has its keydown handler");
  eq(b.prog.textContent, "0 of 3 today", "CONTROL: dcUpdateProgress ran, so the render completed");
}

{ // a row that is done, and a row with a phase flavour, both unchanged by the label
  const b = render([
    act("a1", "ferritin", "Base one.", "luteal", { luteal: "A luteal note." }),
    act("a2", "globulin", "Base two."),
  ], ["a1"]);
  const h = b.captured.html;
  ok(h.includes('class="dc-act done"'), "the done row still renders its done class");
  ok(h.includes('<div class="dc-flavor">A luteal note.</div>'), "the phase flavour still renders");
  ok(h.includes('<div class="dc-label">Ferritin</div>'), "a done row still shows its label");
  eq((h.match(/class="dc-label"/g) || []).length, 1, "the unresolved second row still has none");
  const r1 = h.split(/<div class="dc-act(?=[ "])/)[1];
  ok(r1.indexOf('class="dc-base"') < r1.indexOf('class="dc-flavor"'),
     "base still precedes flavour, so the label did not displace either");
}

{ // every row unresolved -> no labels at all, and the card still renders
  const b = render([
    act("a1", "uacr", "One."), act("a2", "globulin", "Two."), act("a3", "folate_lcmsms", "Three."),
  ]);
  const h = b.captured.html;
  eq((h.match(/class="dc-label"/g) || []).length, 0, "no labels when nothing resolves");
  eq((h.match(/class="dc-base"/g) || []).length, 3, "CONTROL: all three rows still rendered");
}

// ── 5. the class exists in the stylesheet ────────────────────────────────────
eq((HTML.match(/^\.dc-label\{/gm) || []).length, 1, "exactly one .dc-label rule is defined");
eq((HTML.match(/^\.dc-flavor\{/gm) || []).length, 1, "CONTROL: .dc-flavor is also defined once");

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
