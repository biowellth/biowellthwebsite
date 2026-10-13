#!/usr/bin/env node
// HERO_ON_BASE_V1 -- the vitality hero sits on the page background, not in a card, and the
// cards below it keep their glass.
//
// WHAT IS PINNED. In a real browser, with the shipped CSS:
//   .reveal-head   computed background transparent (no colour, no image), box-shadow none,
//                  border width 0, backdrop-filter none, border-radius 0, side padding 0
//   .companion     still the glass card: a background image, a 1px border, a box-shadow and a
//                  backdrop blur, which is what the shared glass list gives every card
// MUTANT. The same page with the hero rule put back to its pre-HERO_ON_BASE_V1 declarations
// must FAIL the hero assertions, which proves they read the rule rather than passing by luck.
//
// WHY A BROWSER. Computed style after the cascade is the question (two older .reveal-head rules
// still set a border and a background), and only a browser resolves it.
//
//   node scripts/test-hero-on-base.mjs        (CHROME=/path/to/chrome to override the browser path)
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const FILE = process.env.DASH || "dashboard.html";
// Same default as the other browser suites in this folder. The override changes which binary
// runs, never what is asserted.
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9700 + Math.floor(Math.random() * 200);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };

if (!existsSync(CHROME)) { console.log("  FAIL HB-0: Chrome is not at " + CHROME); fail++; done(1); }

const work = readFileSync(FILE, "utf8");
const NEW_DECL = "background:transparent;border:0;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;color:var(--ink);\n  border-radius:0;padding:46px 0 40px;";
const OLD_DECL = "background:linear-gradient(140deg,rgba(251,250,249,.82),rgba(252,243,238,.62));color:var(--ink);\n  border-radius:32px;padding:46px 52px 40px;";
const OLD_LIST = "#view-dashboard .reveal-head, #view-dashboard .companion,";

console.log("STATIC -- the rule and the glass list are where this suite expects them");
eq(work.split(NEW_DECL).length - 1, 1, "HB-1: the hero rule carries the on-base declarations once");
eq(work.split(OLD_LIST).length - 1, 0, "HB-2: .reveal-head is no longer the first entry of the shared glass list");
ok(work.indexOf("#view-dashboard .companion, #view-dashboard .cy-card,") > -1, "HB-3: the glass list still starts with the companion and the cards");
const MUTANT = work.replace(NEW_DECL, OLD_DECL).replace("#view-dashboard .companion, #view-dashboard .cy-card,", "#view-dashboard .reveal-head, #view-dashboard .companion, #view-dashboard .cy-card,");
ok(MUTANT !== work, "HB-4: the mutant really differs from the shipped file");

// Signed in with no data (the same stub shape as test-sana-badge.mjs, so boot does not redirect to
// login), then the dashboard view is shown directly so its CSS resolves. Supabase is stubbed so the
// page boots without a network.
const STUB = `<script>
window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message)));
const chain = () => { const c = {}; for (const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"]) c[k] = () => c;
  c.maybeSingle = async () => ({ data: null, error: null }); c.single = c.maybeSingle; c.then = (f) => Promise.resolve({ data: [], error: null }).then(f); return c; };
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "00000000-0000-4000-8000-000000000003", email: "harness@example.com" } } } }),
          getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000003" } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}) },
  from: () => chain(), functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) }, rpc: async () => ({ data: null, error: null }) }) };
<\/script>`;
const DRIVER = `<script>
(async () => {
  await new Promise(r => setTimeout(r, 600));
  for (const v of document.querySelectorAll("[id^=view-]")) v.classList.add("hidden");
  const dash = document.getElementById("view-dashboard"); dash.classList.remove("hidden");
  const cs = (sel) => { const e = document.querySelector(sel); if (!e) return null; const c = getComputedStyle(e);
    return { bg: c.backgroundColor, img: c.backgroundImage, shadow: c.boxShadow, bw: c.borderTopWidth, bs: c.borderTopStyle,
             radius: c.borderTopLeftRadius, backdrop: c.backdropFilter || c.webkitBackdropFilter || "none",
             pl: c.paddingLeft, pr: c.paddingRight }; };
  window.__result = { head: cs("#view-dashboard .reveal-head"), comp: cs("#view-dashboard .companion"), errs: window.__errs };
  window.__done = true;
})();
<\/script>`;

let serveHtml = work;
const server = createServer((req, res) => {
  if (req.url.startsWith("/page")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(serveHtml.replace(CDN, STUB).replace("</body>", DRIVER + "</body>")); return;
  }
  res.writeHead(404); res.end("no");
});
await new Promise(r => server.listen(PORT, r));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + (PORT + 1),
  "--user-data-dir=/tmp/hero-on-base-" + process.pid, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL HB-0c: Chrome never opened a debugging port"); fail++; server.close(); chrome.kill(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);

async function run(html, width) {
  serveHtml = html;
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 40; i++) { await sleep(250);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) return JSON.parse(v.result.value); }
  return null;
}

const runs = [];
for (const w of [1440, 375]) runs.push([w, await run(work, w)]);
const MUT = await run(MUTANT, 1440);
ws.close(); chrome.kill(); server.close();
if (runs.some(([, r]) => !r) || !MUT) { console.log("  FAIL HB-5: a run never finished; the harness itself is broken"); fail++; done(1); }

const transparent = (c) => c === "rgba(0, 0, 0, 0)" || c === "transparent";
for (const [w, r] of runs) {
  console.log("\nHERO at " + w + "px -- on the page background, no card");
  ok(transparent(r.head.bg) && r.head.img === "none", "HB-6 " + w + ": .reveal-head background is transparent with no image  (" + r.head.bg + ", " + r.head.img.slice(0, 40) + ")");
  eq(r.head.shadow, "none", "HB-7 " + w + ": .reveal-head box-shadow");
  eq(r.head.bw, "0px", "HB-8 " + w + ": .reveal-head border width");
  eq(r.head.backdrop, "none", "HB-9 " + w + ": .reveal-head backdrop-filter");
  eq(r.head.radius, "0px", "HB-10 " + w + ": .reveal-head border-radius");
  ok(r.head.pl === "0px" && r.head.pr === "0px", "HB-11 " + w + ": .reveal-head has no side padding, so its text meets the Sana card's left edge  (" + r.head.pl + "/" + r.head.pr + ")");
  console.log("COMPANION at " + w + "px -- still the glass card");
  ok(r.comp.img !== "none" || !transparent(r.comp.bg), "HB-12 " + w + ": .companion has a background  (" + r.comp.img.slice(0, 40) + ")");
  ok(r.comp.shadow !== "none", "HB-13 " + w + ": .companion keeps the glass box-shadow");
  ok(r.comp.bw === "1px" && r.comp.bs === "solid", "HB-14 " + w + ": .companion keeps the 1px glass edge");
  ok(/blur\(/.test(r.comp.backdrop), "HB-15 " + w + ": .companion keeps the backdrop blur  (" + r.comp.backdrop + ")");
  eq(r.errs.length, 0, "HB-16 " + w + ": no uncaught window error  " + JSON.stringify(r.errs));
}

console.log("\nMUTANT -- the pre-change hero rule restored");
ok(!(transparent(MUT.head.bg) && MUT.head.img === "none"), "HB-17: the mutant hero has a background again, so HB-6 reads the rule");
ok(MUT.head.shadow !== "none", "HB-18: the mutant hero has a box-shadow again, so HB-7 reads the rule");

done(fail ? 1 : 0);
