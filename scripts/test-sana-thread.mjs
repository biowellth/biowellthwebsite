#!/usr/bin/env node
// SANA_THREAD_V1 — turn identity, layout and chips, against shipped source.
//
// THE DEFECT THIS EXISTS FOR: sanaSend used to write id="sana-live" into every
// new turn and read it back with getElementById, which returns the FIRST match.
// On turn 2 that resolved to TURN 1's reply element, so turn 2's answer
// overwrote turn 1's reply and turn 2's own bubble kept spinning forever. One
// duplicated id, two visible defects, and nothing ever cleared the id.
//
// The suite boots the real inline script in node:vm with a stubbed DOM and a
// mocked stream, the same technique as test-boot-fresh-profile.mjs, then drives
// two sequential sends and asserts turn 1 is byte-identical afterwards.
//
//   node scripts/test-sana-thread.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m))
                        : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

// ── STATIC: source-level properties ──────────────────────────────────────────
console.log("IDENTITY — no shared element id");
eq((HTML.match(/id="sana-live"/g) || []).length, 0, "TID-1: no element carries the shared live id");
eq((HTML.match(/\$\("sana-live"\)/g) || []).length, 0, "TID-2: nothing looks that id up");
ok(/setAttribute\("data-turn"/.test(HTML), "TID-3: turns are tagged with data-turn");

// ── DYNAMIC: boot the real script and drive two sends ────────────────────────

// A minimal HTML parser, enough for the markup this page emits: div, span, p,
// ul, ol, li, strong, with class and data- attributes. Not a browser; just
// enough that class selectors and text content are real.
function parseInto(parent, html) {
  const stack = [parent];
  const re = /<\/?([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:="[^"]*")?)*)\s*\/?>|([^<]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [full, tag, attrs, text] = m;
    if (text !== undefined) {
      const t = text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      if (t.trim()) stack[stack.length - 1]._text = (stack[stack.length - 1]._text || "") + t;
      continue;
    }
    if (full.startsWith("</")) { if (stack.length > 1) stack.pop(); continue; }
    const el = mkEl(tag);
    (attrs || "").replace(/([\w-]+)(?:="([^"]*)")?/g, (_a, k, v) => { el.setAttribute(k, v ?? ""); return ""; });
    stack[stack.length - 1].appendChild(el);
    const VOID = ["br", "hr", "img", "input", "meta", "link"];
    if (!full.endsWith("/>") && !VOID.includes(tag.toLowerCase())) stack.push(el);
  }
}

const mkEl = (tag = "div") => {
  const el = {
    tagName: String(tag).toUpperCase(), children: [], attrs: {}, _cls: "",
    style: new Proxy({}, { get: () => "", set: () => true }),
    dataset: {}, value: "", _text: "", disabled: false, scrollTop: 0, scrollHeight: 100,
    get className() { return el._cls; }, set className(v) { el._cls = String(v); },
    get textContent() { return el._text || el.children.map((c) => c.textContent).join(""); },
    set textContent(v) { el._text = String(v); el.children = []; },
    get innerHTML() { return el.children.map((c) => c.outerHTML).join("") + (el._text || ""); },
    // PARSE, do not store the string. The first version of this stub kept
    // innerHTML as a string and never built children, so every querySelectorAll
    // walked an empty list and every assertion about dots or turn contents
    // passed no matter what the production code did: 0 of 6 mutations caught.
    set innerHTML(v) { el.children = []; el._text = ""; parseInto(el, String(v)); },
    get outerHTML() {
      const cls = el._cls ? ' class="' + el._cls + '"' : "";
      const at = Object.entries(el.attrs).map(([k, v]) => ` ${k}="${v}"`).join("");
      return `<${tag}${cls}${at}>${el.innerHTML}</${tag}>`;
    },
    classList: { add(c) { if (!el._cls.split(" ").includes(c)) el._cls = (el._cls + " " + c).trim(); },
                 remove(c) { el._cls = el._cls.split(" ").filter((x) => x && x !== c).join(" "); },
                 toggle(c, f) { f ? el.classList.add(c) : el.classList.remove(c); },
                 contains(c) { return el._cls.split(" ").includes(c); } },
    setAttribute(k, v) { el.attrs[k] = String(v); if (k === "class") el._cls = String(v); },
    getAttribute(k) { return el.attrs[k] ?? null; },
    removeAttribute(k) { delete el.attrs[k]; },
    appendChild(c) { el._html = undefined; el.children.push(c); c.parentNode = el; return c; },
    remove() { const p = el.parentNode; if (p) p.children = p.children.filter((x) => x !== el); },
    insertAdjacentHTML(_pos, h) { const c = mkEl("div"); c.innerHTML = h; if (/class="([^"]*)"/.test(h)) c.className = RegExp.$1; el.appendChild(c); },
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {},
    scrollIntoView() {}, cloneNode() { return mkEl(tag); },
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    querySelector(sel) { return el.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) {
      const want = sel.replace(/^\./, "").replace(/^\[|\]$/g, "").split("=")[0];
      const out = [];
      const walk = (n) => n.children.forEach((c) => {
        if (sel.startsWith(".") && c.classList.contains(want)) out.push(c);
        else if (sel.startsWith("[") && c.attrs[want] !== undefined) out.push(c);
        walk(c);
      });
      walk(el);
      return out;
    },
  };
  return el;
};

const nodes = {};
const getEl = (id) => (nodes[id] ||= mkEl("div"));
["sana-thread", "sana-input", "sana-send", "sana-mount", "sana-consent", "comp-chips",
 "comp-answer", "comp-read", "companion", "dropzone", "file", "consent-row", "consent-check",
 "dob-gate", "dob-gate-input", "dob-gate-go", "dob-gate-msg", "dob-gate-refuse"].forEach(getEl);

let fetchCalls = 0;
const sandbox = {
  console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
  document: new Proxy({
    getElementById: (id) => (nodes[id] ||= mkEl("div")),
    querySelector: () => mkEl(), querySelectorAll: () => [],
    createElement: (t) => mkEl(t), createElementNS: () => mkEl(),
    addEventListener() {}, removeEventListener() {},
    body: mkEl("body"), documentElement: mkEl("html"), head: mkEl("head"),
    readyState: "complete", cookie: "", title: "",
  }, { get: (t, k) => (k in t ? t[k] : () => mkEl()) }),
  supabase: { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "t",
             user: { id: "u1", user_metadata: {} } } } }),
            getUser: async () => ({ data: { user: null } }), signOut: async () => ({}),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: () => { const c = new Proxy(function () {}, {
        get: (_, k) => (k === "then" ? (r) => Promise.resolve({ data: null, error: null }).then(r) : () => c),
        apply: () => c }); return c; },
    rpc: () => Promise.resolve({ data: null, error: null }),
    storage: { from: () => ({ upload: async () => ({}), remove: async () => ({}) }) },
    functions: { invoke: async () => ({ data: {}, error: null }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  }) },
  location: new Proxy({ href: "https://biowellth.ai/dashboard", search: "", pathname: "/dashboard",
                        replace() {}, assign() {}, reload() {} }, { get: (t, k) => (k in t ? t[k] : "") }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  navigator: { userAgent: "node", language: "en-US", clipboard: { writeText: async () => {} } },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {},
                       addListener() {}, removeListener() {} }),
  // A REAL SSE STREAM. Driving sanaSend end to end is the whole point: a probe
  // that re-implements the turn logic cannot catch a regression in it, which is
  // exactly what the first version of this file did (0 of 4 mutations caught).
  fetch: async (url) => {
    fetchCalls++;
    if (!String(url).includes("/agent/chat")) {
      return { ok: true, status: 200, body: null, json: async () => ({}), text: async () => "" };
    }
    const enc = new TextEncoder();
    // The parser reads obj.type from the JSON BODY, not the SSE event: line.
    // Putting the type only in event: produced a rollback with "cut off", which
    // is the parser behaving correctly and the harness being wrong.
    const frames = [
      'data: {"type":"thread_meta","threadId":"t","isNewThread":true}\n\n',
      'data: {"type":"delta","text":"' + (sandbox.__nextAnswer || "answer") + '"}\n\n',
      'data: {"type":"done"}\n\n',
    ].map((f) => enc.encode(f));
    let i = 0;
    return { ok: true, status: 200,
      body: { getReader: () => ({ read: async () => (i < frames.length
                ? { done: false, value: frames[i++] } : { done: true, value: undefined }) }) },
      json: async () => ({}), text: async () => "" };
  },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
  requestAnimationFrame: (f) => setTimeout(f, 0), cancelAnimationFrame() {},
  URLSearchParams, URL, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean,
  Error, TypeError, ReferenceError, Set, Map, WeakMap, RegExp, Intl, crypto, TextDecoder,
  alert() {}, confirm: () => true, prompt: () => null,
  atob: (b) => Buffer.from(b, "base64").toString("binary"),
  btoa: (b) => Buffer.from(b, "binary").toString("base64"),
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  scrollTo() {}, getComputedStyle: () => ({ getPropertyValue: () => "" }),
  innerWidth: 1280, innerHeight: 900, devicePixelRatio: 1,
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;

const lines = HTML.split("\n");
const s0 = lines.findIndex((l) => l.trim() === "<script>");
const e0 = lines.length - 1 - [...lines].reverse().findIndex((l) => l.trim() === "</script>");
const SRC = lines.slice(s0 + 1, e0).join("\n");

const vm = await import("node:vm");
vm.createContext(sandbox);
try {
  new vm.Script(SRC + `
;globalThis.__probe = {
   sanaRender: typeof sanaRender,
   send: async (text, answer) => {
     SANA_CONSENT_STATE = true;          // consent proven separately, in test-consent-gate
     SANA_LINKED = true;                 // linking proven separately
     SANA_BUSY = false;
     globalThis.__nextAnswer = answer;
     document.getElementById("sana-input").value = text;
     await sanaSend();                   // THE REAL FUNCTION
   },
   // Count BOTH classes. Counting only .sana-dots meant a mutation that emitted
   // .comp-dots scored zero and the assertion passed while dots span forever.
   dots: () => document.getElementById("sana-thread").querySelectorAll(".sana-dots").length
             + document.getElementById("sana-thread").querySelectorAll(".comp-dots").length,
   labels: () => document.getElementById("sana-thread").querySelectorAll(".sana-label").length,
   tagged: () => document.getElementById("sana-thread").querySelectorAll("[data-turn]").length,
   turns: () => document.getElementById("sana-thread").querySelectorAll(".sana-turn"),
   thread: () => document.getElementById("sana-thread"),
};`, { filename: "dashboard-inline.js" }).runInContext(sandbox, { timeout: 20000 });
} catch (err) {
  console.log("  FAIL boot threw: " + err.message);
  fail++;
}

console.log("SEQUENTIAL TURNS — the regression, driven through the real sanaSend");
const P = sandbox.__probe;
if (!P) { ok(false, "TID-4..8: probe unavailable, boot failed"); }
else {
  eq(P.sanaRender, "function", "TID-4: sanaRender is in scope for the thread");

  await P.send("first question", "first answer");
  const turnsAfter1 = P.turns().length;
  const t1 = P.turns()[1];               // [0] you, [1] her
  const snapshot = t1.innerHTML;
  ok(/first answer/.test(snapshot), "TID-5: turn 1 rendered its own answer");

  await P.send("second question", "second answer");

  eq(t1.innerHTML, snapshot, "TID-6: turn 1 is BYTE-IDENTICAL after turn 2 completes");
  const t2 = P.turns()[3];
  ok(/second answer/.test(t2.innerHTML), "TID-7: turn 2 rendered into its own element");
  eq(P.dots(), 0, "TID-8: zero .sana-dots remain once both turns resolve");
  eq(P.turns().length, 4, "TID-9: four turn nodes, two you and two her");
  eq(turnsAfter1, 2, "TID-10: one send produced exactly two nodes");
  // The label must survive the render. Writing into `live` instead of its body
  // node clobbers it, which no before/after comparison of turn 1 can see.
  eq(P.labels(), 2, "TID-11: both Sana turns still carry their label after rendering");
  // Static regex on the source cannot tell which of the two setAttribute calls
  // survived, so assert every turn node carries the attribute at runtime.
  eq(P.tagged(), 4, "TID-12: every turn node carries data-turn");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
