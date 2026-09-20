#!/usr/bin/env node
// DAILY_CARD_SUBTITLE_V1 -- the wording under "Today with Sana".
//
// "Three small invitations" was abstract and did not say what the card was for. It is now
// "Three small things you could do today".
//
// TWO SITES, and the second is the one that is easy to miss: dcUpdateProgress rewrites
// .dc-status on every toggle, so a change made only in the render is undone the first time she
// ticks something off. Both are pinned here.
//
// THE APP BLOCK IS THE LAST BARE <script>, NOT THE FIRST. A Sentry block was added ahead of the
// app on 2026-09-20, so the first-open/last-close span used by the older test files swallows an
// intervening </script> and does not parse. Measured: 6 of the 27 scripts fail at HEAD for that
// reason, before any change of mine.
//
//   node scripts/test-daily-card-subtitle.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const HTML = readFileSync(process.env.DASH || "dashboard.html", "utf8");
const lines = HTML.split("\n");
const opens = lines.map((l, i) => (l.trim() === "<script>" ? i : -1)).filter((i) => i >= 0);
const closes = lines.map((l, i) => (l.trim() === "</script>" ? i : -1)).filter((i) => i >= 0);
const s = opens[opens.length - 1];
const e = closes.filter((c) => c > s)[0];
if (s == null || e == null) { console.log("  FAIL could not locate the app script block"); process.exit(1); }
// __dcState is `let __dcState = null` at the top of the app block, which is LEXICAL: setting it
// on the vm context does not reach it. One test-only line is appended to the EXTRACTED source --
// the repo file is untouched -- so the state under test can be installed. Without it every
// dcUpdateProgress assertion passes or fails on an early return instead of on the wording, which
// is what the progress-line control below exists to catch.
const SRC = lines.slice(s + 1, e).join("\n")
  + "\n;globalThis.__setDcState = (v) => { __dcState = v; };\n";

const NEW = "Three small things you could do today";
const OLD = "Three small invitations";
const DONE = "All done for today";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);

console.log("DAILY_CARD_SUBTITLE_V1");

// ── 1. the render writes the new subtitle ────────────────────────────────────
// Asserted against the SOURCE, because renderDailyCard builds one innerHTML string.
ok(SRC.includes('<div class="dc-status">' + NEW + '</div>'),
   "the render writes the new subtitle into .dc-status");
eq((SRC.match(new RegExp(OLD, "g")) || []).length, 0, "the old string appears nowhere in the app block");
// CONTROL: the matcher would have found it. Same string, same run, against the shipped file.
eq((HTML.match(/invitations third/g) || []).length, 1,
   "CONTROL: the card-order comment still says 'invitations third', so the search can fire");

// ── 2. dcUpdateProgress swaps correctly, exercised for real ──────────────────
function runProgress({ done, total }) {
  const st = { textContent: null };
  const prog = { textContent: null };
  const host = {
    classList: { toggle(){}, add(){}, remove(){} },
    querySelector: (sel) => (sel === ".dc-status" ? st : sel === ".dc-prog" ? prog : null),
  };
  // Permissive everywhere EXCEPT the daily card: only a real error should surface, so an
  // unknown id or selector yields another element rather than null.
  const mkAny = () => new Proxy({
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
  const ctx = {
    console: { log(){}, warn(){}, error(){} },
    document: { getElementById: (id) => (id === "daily-card" ? host : mkAny()),
                querySelector: () => mkAny(), querySelectorAll: () => [], addEventListener(){},
                createElement: () => mkAny(),
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
  // __dcState is what dcUpdateProgress reads; set it to the state under test.
  ctx.__setDcState({ done: new Set(Array.from({ length: done }, (_, i) => "a" + i)),
                     three: Array.from({ length: total }, (_, i) => ({ id: "a" + i })) });
  ctx.dcUpdateProgress();
  return { st, prog };
}

{
  const r = runProgress({ done: 1, total: 3 });
  eq(r.st.textContent, NEW, "incomplete: dcUpdateProgress writes the new subtitle");
  eq(r.prog.textContent, "1 of 3 today", "CONTROL: the progress line was written, so the path ran");
}
{
  const r = runProgress({ done: 3, total: 3 });
  eq(r.st.textContent, DONE, "complete: dcUpdateProgress swaps in the completion string");
  eq(r.prog.textContent, "3 of 3 today", "CONTROL: the progress line was written, so the path ran");
}
{
  const r = runProgress({ done: 0, total: 0 });
  eq(r.st.textContent, NEW, "empty state falls to the subtitle, not the completion string");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
