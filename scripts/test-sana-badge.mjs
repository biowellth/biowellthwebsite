#!/usr/bin/env node
// SANA_LIVE_COPY_V1 -- the "Arriving soon" badge in the companion header can never show while Sana
// is live, and shows exactly as before when she is not.
//
// THE PATH THIS EXISTS FOR. sanaMountChat removes the badge on its first mount, which covers every
// woman with a panel. It does not cover a dashboard shown WITHOUT renderDashboard: a first upload
// that fails, for a woman with no date of birth on file, so the no-panel chat never mounted either.
// The failure screen offers "Go to my dashboard", and that showed the static markup with the badge
// still in it. dashboard.html now removes the badge at load whenever SANA_CHAT_ENABLED is true.
//
// WHY A BROWSER TEST. The question is whether a node exists in the rendered page after a real boot
// and a real click, which a source scan cannot answer and the node:vm stub DOM cannot either (its
// querySelector returns a fresh element for any selector).
//
// SHAPE. Each run boots the real dashboard.html with a stubbed Supabase (signed in, no profile, no
// reports, so no date of birth and no panel), renders the real failure screen, clicks the real
// "Go to my dashboard" button, and counts the badge.
//   LIVE      the shipped file, flag true          -> no badge, and the chat never mounted, so the
//                                                     removal came from the load-time rule
//   DARK      the shipped file with the flag false -> the badge shows, as it did before go-live
//   MUTANT    the shipped file without the rule    -> the badge shows with the flag true, proving
//                                                     LIVE discriminates instead of passing by luck
// Every fixture is synthetic. No stored row, no real user id.
//
//   node scripts/test-sana-badge.mjs        (CHROME=/path/to/chrome to override the browser path)
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const FILE = process.env.DASH || "dashboard.html";
// Same default as the other browser suites in this folder. The override exists so the suite can run
// where Chrome lives elsewhere; it changes which binary runs, never what is asserted.
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9300 + Math.floor(Math.random() * 400);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };

if (!existsSync(CHROME)) { console.log("  FAIL SB-0: Chrome is not at " + CHROME); fail++; done(1); }

const work = readFileSync(FILE, "utf8");
const FLAG_ON = "const SANA_CHAT_ENABLED = true;";
const RULE = 'if(SANA_CHAT_ENABLED){\n  try{\n    const liveBadge = document.querySelector("#companion .comp-badge");\n    if(liveBadge && typeof liveBadge.remove === "function") liveBadge.remove();\n  }catch(_e){}\n}';

console.log("STATIC -- the badge markup and both removals are where this suite expects them");
eq(work.split(FLAG_ON).length - 1, 1, "SB-1: the flag is declared once, and on");
eq(work.split('<span class="comp-badge">Arriving soon</span>').length - 1, 1, "SB-2: the badge markup is still shipped, so the flag-off path still has it");
eq(work.split(RULE).length - 1, 1, "SB-3: the load-time rule is present");
ok(work.indexOf('const badge = document.querySelector("#companion .comp-badge");\n  if(badge) badge.remove();') !== -1,
   "SB-4: and sanaMountChat still carries its own removal, unchanged");

const DARK = work.replace(FLAG_ON, "const SANA_CHAT_ENABLED = false;");
const MUTANT = work.replace(RULE, "");

// Signed in, no profile row, no reports: the no-DOB, no-panel woman.
const STUB = `<script>
window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message)));
const noRows = { data: null, error: null };
const chain = () => { const c = {}; for (const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"]) c[k] = () => c;
  c.maybeSingle = async () => noRows; c.single = async () => noRows; c.then = (f) => Promise.resolve({ data: [], error: null }).then(f); return c; };
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "00000000-0000-4000-8000-000000000002", email: "harness@example.com" } } } }),
          getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000002" } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}) },
  from: () => chain(), functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null }), upload: async () => ({ data: null, error: null }) }) },
  rpc: async () => noRows }) };
<\/script>`;

// Boot, then walk the real failure path: the failure screen, then its "Go to my dashboard" button.
const DRIVER = `<script>
(async () => {
  await new Promise(r => setTimeout(r, 900));
  const res = {};
  const N = () => document.querySelectorAll("#companion .comp-badge").length;
  res.afterBoot = N();
  try {
    window.showView("processing");
    window.pcRenderFailure("00000000-0000-4000-8000-0000000000f1", "retryable");
    const go = document.getElementById("pc-todash");
    res.hadButton = !!go;
    if (go) go.click();
  } catch (e) { res.threw = e.message; }
  await new Promise(r => setTimeout(r, 150));
  const dash = document.getElementById("view-dashboard");
  res.dashboardShown = !!dash && !dash.classList.contains("hidden");
  res.badges = N();
  const b = document.querySelector("#companion .comp-badge");
  res.badgeText = b ? b.textContent.trim() : null;
  res.sanaMounted = (typeof SANA_MOUNTED !== "undefined") ? SANA_MOUNTED : "undefined";
  res.errs = window.__errs;
  window.__result = res; window.__done = true;
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

const profile = "/tmp/sana-badge-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + (PORT + 1),
  "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL SB-0c: Chrome never opened a debugging port"); fail++; server.close(); chrome.kill(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);

async function run(html) {
  serveHtml = html;
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 40; i++) { await sleep(250);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) return JSON.parse(v.result.value); }
  return null;
}

const LIVE = await run(work);
const OFF = await run(DARK);
const MUT = await run(MUTANT);
ws.close(); chrome.kill(); server.close();
if (!LIVE || !OFF || !MUT) { console.log("  FAIL SB-5: a run never finished; the harness itself is broken"); fail++; done(1); }

console.log("\nPATH -- the run really walks the no-DOB failed-upload path to the dashboard");
for (const [n, r] of [["LIVE", LIVE], ["DARK", OFF], ["MUTANT", MUT]]) {
  ok(!r.threw && r.hadButton === true && r.dashboardShown === true,
     "SB-6 " + n + ": the failure screen rendered its Go to my dashboard button and the click showed the dashboard  (" + JSON.stringify({ threw: r.threw || null, hadButton: r.hadButton, shown: r.dashboardShown }) + ")");
  eq(r.sanaMounted, false, "SB-7 " + n + ": the chat never mounted on this path, so sanaMountChat cannot be what removed the badge");
  eq(r.errs.length, 0, "SB-8 " + n + ": no uncaught window error  " + JSON.stringify(r.errs));
}

console.log("\nLIVE -- flag true, the badge never shows");
eq(LIVE.afterBoot, 0, "SB-9: no badge once the page has loaded");
eq(LIVE.badges, 0, "SB-10: and none on the dashboard reached from the failed upload");

console.log("\nDARK -- flag false, the badge behaves exactly as before go-live");
eq(OFF.badges, 1, "SB-11: the badge shows on the same path");
eq(OFF.badgeText, "Arriving soon", "SB-12: with its original text");

console.log("\nMUTANT -- the load-time rule removed, flag still true");
eq(MUT.badges, 1, "SB-13: the badge shows again, so SB-10 is caused by the rule and nothing else");

done(fail ? 1 : 0);
