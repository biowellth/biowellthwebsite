#!/usr/bin/env node
// TESTER_GATE_V1 -- the external tester agreement gate in dashboard.html.
//
// WHAT IT CATCHES, four things that all look fine in a diff:
//   1. the flag ceasing to gate, so an unaccepted tester walks straight into the product,
//   2. the acceptance lookup being ignored, so an accepted tester is asked every load,
//   3. the button enabling before all six boxes are ticked, which is exactly the thing
//      counsel's Part 2 requires,
//   4. the decline path losing its redirect target or its sign out.
//
// It boots the real inline script in a vm against a DOM stub whose classList, checked
// and textContent are OBSERVABLE, so an assertion reads what the page actually did.
//
//   node scripts/test-tester-gate.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

const lines = HTML.split("\n");
const s = lines.findIndex((l) => l.trim() === "<script>");
const e = lines.length - 1 - [...lines].reverse().findIndex((l) => l.trim() === "</script>");
if (s < 0 || e <= s) { console.log("  FAIL could not locate the inline script block"); process.exit(1); }
const SRC = lines.slice(s + 1, e).join("\n");

const ACK_KEYS = ["confidentiality","no_sharing","own_data_only","wellness_not_medical","report_problems","access_can_end"];

function mkEl(id){
  const classes = new Set();
  const el = {
    id, value:"", checked:false, disabled:false, textContent:"", innerHTML:"", style:{},
    _attrs:{}, _children:[],
    classList:{ add:(c)=>classes.add(c), remove:(c)=>classes.delete(c),
      contains:(c)=>classes.has(c),
      toggle:(c,f)=>{ if(f===undefined){ classes.has(c)?classes.delete(c):classes.add(c); }
                      else if(f) classes.add(c); else classes.delete(c); return classes.has(c); } },
    setAttribute(k,v){ el._attrs[k]=v; }, getAttribute(k){ return el._attrs[k] ?? null; },
    removeAttribute(k){ delete el._attrs[k]; },
    addEventListener(){}, removeEventListener(){}, focus(){}, click(){},
    querySelector(){ return mkEl("q"); }, querySelectorAll(sel){ return el._children.filter(c=>c._sel===sel); },
    appendChild(){}, insertAdjacentHTML(){}, closest(){ return null; },
    getBoundingClientRect(){ return {top:0,left:0,width:0,height:0}; },
  };
  return el;
}

// Boot the page far enough to define testerGate, then call it directly. Driving the whole
// boot IIFE would drag in the picker, the reveal deck and the poller, none of which this
// is about.
function boot({ src = SRC, acceptanceRows = [], invokeResult, signOut } = {}) {
  const els = new Map();
  const get = (id) => { if(!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };

  // the six checkboxes live under #tester-gate
  const gate = get("tester-gate");
  gate.classList.add("hidden");
  gate._children = ACK_KEYS.map((k)=>{ const c = mkEl("ack-"+k); c._sel = ".tg-ack"; c._attrs["data-key"]=k; return c; });

  const calls = { invoked: [], signedOut: 0, replaced: [], selects: [] };
  const thenable = (data) => {
    const p = { data, error: null };
    const chain = new Proxy(function(){}, {
      get(_, k){ if(k === "then") return (res)=>Promise.resolve(p).then(res); return ()=>chain; },
      apply(){ return chain; },
    });
    return chain;
  };
  const sb = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "1e6eb2cc-0000-4000-8000-000000000000" } } } }),
      getUser: async () => ({ data: { user: null } }),
      signOut: signOut || (async () => { calls.signedOut++; return { error: null }; }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }),
    },
    from: (t) => { calls.selects.push(t); return thenable(t === "tester_acceptances" ? acceptanceRows : []); },
    rpc: () => thenable(null),
    storage: { from: () => ({ upload: async()=>({error:null}), remove: async()=>({error:null}) }) },
    functions: { invoke: async (name, opts) => { calls.invoked.push({ name, opts });
      return invokeResult || { data: { ok: true, accepted_at: "now" }, error: null }; } },
    channel: () => ({ on(){ return this; }, subscribe(){ return this; } }),
    removeChannel: () => {},
  };

  const documentStub = new Proxy({
    getElementById: get, querySelector: () => mkEl("q"), querySelectorAll: () => [],
    createElement: () => mkEl("c"), addEventListener(){}, body: mkEl("body"),
    documentElement: mkEl("html"), head: mkEl("head"), readyState: "complete", cookie: "", title: "",
  }, { get:(t,k)=> (k in t ? t[k] : () => mkEl("x")) });

  const sandbox = {
    console:{ log(){}, warn(){}, error(){}, info(){}, debug(){} },
    document: documentStub,
    supabase: { createClient: () => sb },
    location: new Proxy({ href:"https://biowellth.ai/dashboard", search:"", hash:"", pathname:"/dashboard",
      origin:"https://biowellth.ai", replace:(u)=>calls.replaced.push(u), assign(){}, reload(){} },
      { get:(t,k)=> (k in t ? t[k] : "") }),
    localStorage:{ getItem:()=>null, setItem(){}, removeItem(){}, clear(){} },
    sessionStorage:{ getItem:()=>null, setItem(){}, removeItem(){}, clear(){} },
    navigator:{ userAgent:"node", language:"en-US", clipboard:{ writeText: async()=>{} } },
    matchMedia:()=>({ matches:false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
    fetch: async () => ({ ok:true, status:200, json: async()=>({}), text: async()=>"" }),
    setTimeout, clearTimeout, setInterval:()=>0, clearInterval,
    requestAnimationFrame:(f)=>setTimeout(f,0), cancelAnimationFrame(){},
    URLSearchParams, URL, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean,
    Error, TypeError, ReferenceError, Set, Map, WeakMap, RegExp, Intl, crypto,
    alert(){}, confirm:()=>true, prompt:()=>null,
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return true; },
    scrollTo(){}, getComputedStyle:()=>({ getPropertyValue:()=>"" }),
    innerWidth:1280, innerHeight:900, devicePixelRatio:1,
    atob:(b)=>Buffer.from(b,"base64").toString("binary"),
    btoa:(b)=>Buffer.from(b,"binary").toString("base64"),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Expose what we need and set USER, which the real boot IIFE would have set. The flag
  // override is appended so a test can exercise the enabled path without editing the file.
  const tail = "\n;globalThis.__USER_SET = (u)=>{ USER = u; };"
           + "\n;globalThis.__testerGate = testerGate;"
           + "\n;globalThis.__FLAG = TESTER_GATE_ENABLED;"
           + "\n;globalThis.__VERSION = TESTER_AGREEMENT_VERSION;"
           + "\n;globalThis.__SHA = TESTER_AGREEMENT_SHA256;"
           + "\n;globalThis.__FAILCOPY = TESTER_GATE_FAIL_COPY;"
           + "\n;globalThis.__ACKS = TESTER_ACK_KEYS;";
  let bootError = null;
  try { new vm.Script(src + tail, { filename: "dashboard-inline.js" }).runInContext(sandbox, { timeout: 20000 }); }
  catch (err) { bootError = err; }
  sandbox.__USER_SET({ id: "1e6eb2cc-0000-4000-8000-000000000000" });
  return { sandbox, get, gate, calls, bootError };
}

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));
const hidden = (b) => b.gate.classList.contains("hidden");

// testerGate resolves when the caller may continue and stays PENDING while the gate is
// open, which is the whole point of it. So never await it bare: a mutation that leaves it
// pending would hang the suite, and a harness that hangs reports nothing at all rather
// than reporting a failure.
const settle = (p, ms = 40) =>
  Promise.race([Promise.resolve(p).then(() => "resolved"), new Promise((r) => setTimeout(() => r("pending"), ms))]);

console.log("FLAG");
{
  const b = boot();
  ok(!b.bootError, "GATE-0: the page still boots with the gate in it" + (b.bootError ? " -> " + b.bootError.message : ""));
  ok(b.sandbox.__FLAG === true, "GATE-1: TESTER_GATE_ENABLED ships TRUE (got " + b.sandbox.__FLAG + ")");
  ok(b.sandbox.__VERSION === "v1.1", "GATE-2: the client names agreement v1.1");
  ok(/^[0-9a-f]{64}$/.test(String(b.sandbox.__SHA)), "GATE-3: the client carries a 64 hex sha");
  ok(Array.isArray(b.sandbox.__ACKS) && b.sandbox.__ACKS.length === 6, "GATE-4: six acknowledgment keys");
}
// The flag ships TRUE, so the OFF path is now the one reached by patching the source.
// The vacuity guard flips with it: if the replacement stops matching, every assertion
// about the off path would pass on a source that never turned the flag off.
const SRC_OFF = SRC.replace("const TESTER_GATE_ENABLED = true;", "const TESTER_GATE_ENABLED = false;");
if (SRC_OFF === SRC) { console.log("  FAIL could not turn the flag OFF in the source, the off-path assertions would be vacuous"); process.exit(1); }
{
  const b = boot({ src: SRC_OFF });
  ok(await settle(b.sandbox.__testerGate()) === "resolved", "GATE-5a: with the flag FALSE the gate resolves at once");
  ok(hidden(b), "GATE-5b: and the modal stays hidden");
  ok(!b.calls.selects.includes("tester_acceptances"), "GATE-6: and no acceptance lookup is even attempted");
}

console.log("\nWITH THE FLAG ON");
// The shipped source IS the on path now, so these run against the real file unmodified.
const SRC_ON = SRC;

{
  const b = boot({ src: SRC_ON, acceptanceRows: [] });
  ok(await settle(b.sandbox.__testerGate()) === "pending", "ON-1a: flag true and NO acceptance row HOLDS the boot");
  ok(!hidden(b), "ON-1b: and shows the modal");
  ok(b.calls.selects.includes("tester_acceptances"), "ON-2: it queried tester_acceptances");
  ok(b.gate.getAttribute("aria-hidden") === "false", "ON-3: aria-hidden flips with it");
  ok(b.get("tg-go").disabled === true, "ON-4: the primary starts DISABLED");
}
{
  const b = boot({ src: SRC_ON, acceptanceRows: [{ id: "row" }] });
  ok(await settle(b.sandbox.__testerGate()) === "resolved", "ON-5a: an EXISTING row lets the boot through");
  ok(hidden(b), "ON-5b: and the modal stays hidden");
}

console.log("\nBUTTON ENABLE LOGIC");
{
  const b = boot({ src: SRC_ON, acceptanceRows: [] });
  b.sandbox.__testerGate();
  await new Promise((r) => setTimeout(r, 20));
  const acks = b.gate._children, go = b.get("tg-go");
  for (let i = 0; i < acks.length - 1; i++) { acks[i].checked = true; acks[i].onchange(); }
  ok(go.disabled === true, "BTN-1: five of six ticked leaves it disabled");
  acks[acks.length - 1].checked = true; acks[acks.length - 1].onchange();
  ok(go.disabled === false, "BTN-2: the sixth enables it");
  acks[0].checked = false; acks[0].onchange();
  ok(go.disabled === true, "BTN-3: unticking one disables it again");
}

console.log("\nACCEPT");
{
  const b = boot({ src: SRC_ON, acceptanceRows: [] });
  b.sandbox.__testerGate();
  await new Promise((r) => setTimeout(r, 20));
  b.gate._children.forEach((c) => { c.checked = true; });
  await b.get("tg-go").onclick();
  const call = b.calls.invoked[0];
  ok(call && call.name === "tester-accept", "ACC-1: agreeing invokes tester-accept");
  ok(call && call.opts.body.agreement_version === "v1.1", "ACC-2: it sends the registry version");
  ok(call && /^[0-9a-f]{64}$/.test(call.opts.body.agreement_sha256), "ACC-3: it sends a 64 hex sha");
  ok(call && ACK_KEYS.every((k) => call.opts.body.accepted[k] === true), "ACC-4: all six keys go up as true");
  ok(hidden(b), "ACC-5: the modal closes on success");
}
{
  const b = boot({ src: SRC_ON, acceptanceRows: [], invokeResult: { data: null, error: { message: "boom" } } });
  b.sandbox.__testerGate();
  await new Promise((r) => setTimeout(r, 20));
  b.gate._children.forEach((c) => { c.checked = true; });
  await b.get("tg-go").onclick();
  ok(!hidden(b), "ACC-6: a refusal leaves the modal OPEN");
  ok(b.get("tg-msg").textContent === "We could not record your acceptance. Please try again.",
     "ACC-7: and shows the failure copy (got " + JSON.stringify(b.get("tg-msg").textContent) + ")");
  ok(b.get("tg-go").disabled === false, "ACC-8: the button is usable again so they can retry");
}

console.log("\nDECLINE");
{
  const b = boot({ src: SRC_ON, acceptanceRows: [] });
  b.sandbox.__testerGate();
  await new Promise((r) => setTimeout(r, 20));
  await b.get("tg-later").onclick();
  await new Promise((r) => setTimeout(r, 20));
  ok(b.calls.signedOut === 1, "DEC-1: Not now signs the user out");
  ok(b.calls.replaced[b.calls.replaced.length - 1] === "/login?declined=tester",
     "DEC-2: and redirects to /login?declined=tester (got " + b.calls.replaced[b.calls.replaced.length - 1] + ")");
}
{
  // A failing signOut must NOT strand the user on the gate.
  const b = boot({ src: SRC_ON, acceptanceRows: [], signOut: async () => { throw new Error("network"); } });
  b.sandbox.__testerGate();
  await new Promise((r) => setTimeout(r, 20));
  await b.get("tg-later").onclick();
  await new Promise((r) => setTimeout(r, 20));
  ok(b.calls.replaced[b.calls.replaced.length - 1] === "/login?declined=tester",
     "DEC-3: a failed sign out still redirects");
}
{
  // KNOWN-NEGATIVE CONTROL. Without a decline nothing navigates, or DEC-2 could be
  // passing on a page that redirects unconditionally.
  const b = boot({ src: SRC_ON, acceptanceRows: [] });
  b.sandbox.__testerGate();
  await new Promise((r) => setTimeout(r, 20));
  ok(b.calls.replaced.length === 0, "DEC-4: control, showing the gate navigates nowhere on its own");
}

console.log("\nFAIL CLOSED");
{
  // A lookup that yields nothing usable must SHOW the gate, never admit silently. The
  // dangerous direction here is the quiet one: a read that fails and is treated as
  // "already accepted" lets an unaccepted tester straight into the product.
  const b = boot({ src: SRC_ON, acceptanceRows: null });
  b.sandbox.__testerGate();
  await new Promise((r) => setTimeout(r, 20));
  ok(!hidden(b), "FC-1: a lookup returning nothing usable still shows the gate");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
