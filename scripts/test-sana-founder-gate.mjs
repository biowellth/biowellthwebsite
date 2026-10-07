#!/usr/bin/env node
// SANA_FOUNDER_ALLOWLIST_V1 — the chat is for founder accounts only until the Sana safety bar is met.
//
// What must hold, against shipped source:
//   - a non-founder sees the gate copy where the chat would be, gets no input, and sanaSend makes
//     no request to /agent/chat;
//   - a founder gets the chat, and the same probe DOES reach /agent/chat (the control, so a zero
//     above means the gate and not a broken harness);
//   - the allowlist is hashes, never raw ids, because this repository is public;
//   - the decision fails closed and is made at boot from the session user.
//
// The harness is test-sana-thread's: the real inline script booted in node:vm with a stubbed DOM and
// a real SSE stream. Synthetic ids only.
//
//   node scripts/test-sana-founder-gate.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m))
                        : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

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

sandbox.TextEncoder = TextEncoder;
let chatCalls = 0;
const realFetch = sandbox.fetch;
sandbox.fetch = async (url, opts) => { if (String(url).includes("/agent/chat")) chatCalls++; return realFetch(url, opts); };

const SRC = extractApp(HTML, FILE);
const vm = await import("node:vm");
vm.createContext(sandbox);
try {
  new vm.Script(SRC + `
;globalThis.__probe = {
   resolve: (id, list) => sanaResolveFounder(id, list),
   founderNow: () => SANA_FOUNDER,
   hashes: () => SANA_FOUNDER_SHA256.slice(),
   gateCopy: () => SANA_GATE_COPY,
   mount: (founder) => {
     SANA_FOUNDER = founder; SANA_MOUNTED = false; SANA_MOUNTED_ID = null; SANA_MOUNT_ID = "sana-mount";
     const m = document.getElementById("sana-mount"); m.dataset = {}; m.innerHTML = "";
     sanaMountChat();                    // THE REAL FUNCTION
     return m;
   },
   send: async (founder) => {
     SANA_FOUNDER = founder;
     SANA_CONSENT_STATE = true;          // consent proven separately, in test-consent-gate
     SANA_LINKED = true;                 // linking proven separately
     SANA_BUSY = false;
     document.getElementById("sana-input").value = "hello";
     await sanaSend();                   // THE REAL FUNCTION
   },
};`, { filename: "dashboard-inline.js" }).runInContext(sandbox, { timeout: 20000 });
} catch (err) {
  console.log("  FAIL boot threw: " + err.message);
  fail++;
}
await new Promise((r) => setTimeout(r, 100));   // let the boot IIFE resolve the session user
const P = sandbox.__probe;
const sha = (s) => createHash("sha256").update(s).digest("hex");

console.log("STATIC — hashes, never ids, and the decision is made at boot");
{
  const hashes = P.hashes();
  eq(hashes.length, 2, "FG-1: two founder hashes (test account and fixture invite)");
  ok(hashes.every((h) => /^[0-9a-f]{64}$/.test(h)), "FG-2: every entry is a 64-hex sha256");
  eq((HTML.match(/\b(1e6eb2cc|2a0c40a2)-[0-9a-f]{4}-/gi) || []).length, 0,
     "FG-3: no full founder uuid in this public file");
  ok(/SANA_FOUNDER = await sanaResolveFounder\(USER && USER\.id\);/.test(HTML),
     "FG-4: boot decides SANA_FOUNDER from the session user");
  ok(/if\(SANA_CHAT_ENABLED && dobOnFile && SANA_FOUNDER\)\{/.test(HTML),
     "FG-5: the no-panel route sends a non-founder to upload, not to an empty companion view");
  ok(/let SANA_FOUNDER = false;/.test(HTML), "FG-6: SANA_FOUNDER starts false (fail closed)");
}

console.log("RESOLVE — the real sanaResolveFounder");
{
  const A = "00000000-0000-4000-8000-00000000f001", B = "00000000-0000-4000-8000-00000000aaaa";
  eq(await P.resolve(A, [sha(A)]), true, "FG-7: an id whose hash is listed resolves true");
  eq(await P.resolve(B, [sha(A)]), false, "FG-8: an id whose hash is not listed resolves false");
  eq(await P.resolve(null, [sha(A)]), false, "FG-9: no session user resolves false");
  eq(await P.resolve(A.slice(0, 8), [sha(A)]), false, "FG-10: a prefix of a listed id resolves false");
  eq(await P.resolve(A), false, "FG-11: a synthetic id is not on the shipped list");
  eq(P.founderNow(), false, "FG-12: after boot with a non-founder session, SANA_FOUNDER is false");
}

console.log("MOUNT — the real sanaMountChat");
{
  const m = P.mount(false);
  eq(m.textContent, P.gateCopy(), "FG-13: a non-founder sees the gate copy where the chat would be");
  eq(P.gateCopy(), "Ask about your results. Coming in early access.", "FG-14: the gate copy is the agreed sentence");
  ok(!m.innerHTML.includes('id="sana-input"'), "FG-15: a non-founder gets no chat input");
  const f = P.mount(true);
  ok(f.innerHTML.includes('id="sana-input"') && f.innerHTML.includes('id="sana-send"'),
     "FG-16 CONTROL: a founder gets the chat input and send button");
  ok(!f.textContent.includes(P.gateCopy()), "FG-17: a founder does not see the gate copy");
}

console.log("SEND — the real sanaSend");
{
  chatCalls = 0;
  await P.send(false);
  eq(chatCalls, 0, "FG-18: a non-founder send makes no request to /agent/chat");
  chatCalls = 0;
  await P.send(true);
  eq(chatCalls, 1, "FG-19 CONTROL: a founder send reaches /agent/chat, so FG-18 can fail");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
