#!/usr/bin/env node
// PRIORITY_POSITION_V1 and STRENGTH_CONCERN_V1 -- the real dashboard, in a real browser.
//
// supa docs/followups-2026-09-25.md, items 2 and 3:
//   2. The priority list read 01, 02, 03, 04, 06, 07. The worker drops a priority after ranking and
//      keeps the stored ranks, and the page printed the stored rank. Every number she sees is now the
//      DISPLAY POSITION.
//   3. "What's already strong" offered a kidney strength beside a kidney priority. A strength in a
//      system that any rendered priority's primary markers belong to is now dropped, using the
//      engine's own marker -> system map (p.systems), never an invented one.
//
// Harness: the same one test-dashboard-e2e.mjs uses (the repo served over http, only the Supabase CDN
// script swapped for a stub with a synthetic session). Every behaviour is asserted twice: against the
// page as committed, and against a MUTATED copy with the fix undone, where it must fail. Synthetic
// markers and values only.
//
//   node scripts/test-priority-position-strength.mjs
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const FILE = process.env.DASH || "dashboard.html";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8600 + Math.floor(Math.random() * 300);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };
if (!existsSync(CHROME)) { console.log("  FAIL PS-0: Chrome is not at " + CHROME); fail++; done(1); }

const STUB = `<script>
window.__errs = [];
addEventListener("error", e => window.__errs.push(String(e.message)));
const noRows = { data: null, error: null };
const chain = () => { const c = {}; for (const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"]) c[k] = () => c;
  c.maybeSingle = async () => noRows; c.single = async () => noRows; c.then = (f) => Promise.resolve({ data: [], error: null }).then(f); return c; };
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "00000000-0000-4000-8000-000000000001", email: "harness@example.com" } } } }),
          getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}) },
  from: () => chain(), functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null }), upload: async () => ({ data: null, error: null }) }) },
  rpc: async () => noRows }) };
<\/script>`;

// ── Synthetic payloads ────────────────────────────────────────────────────────────────────────────
const mk = (id, sys, v) => ({ marker_id: id, display_name: id.toUpperCase(), value: v, unit: "u", canonical_unit: "u",
  normalized_value: v, status: "watch", band: "suboptimal_low", system_id: sys });
const SYSTEMS = ["iron_status", "liver", "thyroid", "vitamins", "minerals", "metabolic", "kidney"];
const systems = SYSTEMS.map(s => ({ system_id: s, display_name: s, status: "watch",
  markers: [mk(s + "_a", s, 10), mk(s + "_b", s, 11)] }));
const prio = (rank, sys, head) => ({ priority_id: "p" + rank, rank, headline: head, system_id: sys, severity: "moderate",
  primary_markers: [{ marker_id: sys + "_a", display_name: sys.toUpperCase(), position: "low", band: "suboptimal_low", flag_status: "watch", value: 10 }],
  why_this_matters: "why", the_connection: "connection", action_layer: { primary_lever: "lever" }, trajectory_promise: "promise" });
const base = (priorities, quietly_working, levers) => ({
  panel_date: "2026-08-05",
  vitality: { composite: 74, band: { key: "steady", label: "Steady" }, display: { show_composite: true } },
  longitudinal: null, systems, priorities, quietly_working,
  foundations: { lead: "Lead line", levers: levers || [{ display_name: "Sleep", action: "Sleep action", connection: "c", appears_in_priority_ids: ["p6"] }], closing: "Closing" },
  coverage_gap: null,
});
// A: stored ranks skip 5 (her shape). Six priorities in six systems, none kidney, so B cannot interfere.
const GAP = base(
  [prio(1, "iron_status", "One"), prio(2, "liver", "Two"), prio(3, "thyroid", "Three"), prio(4, "vitamins", "Four"),
   prio(6, "minerals", "Five on screen"), prio(7, "metabolic", "Six on screen")],
  [{ finding: "An unrelated strength", implication: "i", markers: ["kidney_b"] }]);
// A control: contiguous ranks render exactly as before.
const CONTIG = base(
  [prio(1, "iron_status", "One"), prio(2, "liver", "Two"), prio(3, "thyroid", "Three"), prio(4, "vitamins", "Four"),
   prio(5, "minerals", "Five"), prio(6, "metabolic", "Six")],
  [{ finding: "An unrelated strength", implication: "i", markers: ["kidney_b"] }],
  [{ display_name: "Sleep", action: "Sleep action", connection: "c", appears_in_priority_ids: ["p6"] }]);
// B, her shape: a kidney priority, a kidney strength (a DIFFERENT kidney marker) and an iron strength.
const HER = base(
  [prio(1, "kidney", "Kidney concern"), prio(2, "liver", "Liver")],
  [{ finding: "KIDNEY STRENGTH", implication: "i", markers: ["kidney_b"] },
   { finding: "IRON STRENGTH", implication: "i", markers: ["iron_status_b"] }]);
// B control: every strength is in a system no priority names.
const UNREL = base(
  [prio(1, "liver", "Liver")],
  [{ finding: "IRON STRENGTH", implication: "i", markers: ["iron_status_b"] },
   { finding: "THYROID STRENGTH", implication: "i", markers: ["thyroid_b"] }]);
// B edge: every strength collides, so the whole section, heading included, must hide.
const ALLDROP = base(
  [prio(1, "kidney", "Kidney"), prio(2, "liver", "Liver")],
  [{ finding: "KIDNEY STRENGTH", implication: "i", markers: ["kidney_b"] },
   { finding: "LIVER STRENGTH", implication: "i", markers: ["liver_b"] }]);

const driver = (payload) => `<script>
(async () => {
  await new Promise(r => setTimeout(r, 350));
  window.__rdSeries = {}; window.__allReports = [{ id: "r1", collected_on: "2026-08-05" }];
  window.__doneReportIds = new Set(["r1"]);
  const P = ${JSON.stringify(payload)};
  const res = { threw: false };
  try { await window.renderDashboard(P, "r1"); window.showView("dashboard"); }
  catch (err) { res.threw = true; res.message = String(err && err.message); }
  res.ranks = [...document.querySelectorAll("#prios .prio-rank")].map(e => e.textContent.trim());
  res.relates = [...document.querySelectorAll("#found-levers .lever-relates")].map(e => e.textContent.trim());
  const qw = document.getElementById("quiet-wrap");
  res.quietHidden = !!qw && (qw.classList.contains("hidden") || getComputedStyle(qw).display === "none");
  res.quietHeadingVisible = !!qw && !res.quietHidden && [...qw.querySelectorAll(".section-label")].some(e => e.getBoundingClientRect().height > 0);
  res.quietText = document.getElementById("quiet") ? document.getElementById("quiet").textContent : "";
  res.quietCards = document.querySelectorAll("#quiet .quiet").length;
  res.titleFallback = typeof window.priorityTitle === "function" ? window.priorityTitle({ headline: "", primary_markers: [] }, 4) : null;
  res.reportHasP5 = typeof window.priorityCards === "function"
    ? (() => { const Q = JSON.parse(JSON.stringify(P)); Q.priorities.forEach(x => { x.headline = ""; x.primary_markers = []; });
               const h = window.priorityCards(Q); return { p5: h.includes("Priority 5"), p6: h.includes("Priority 6"), p7: h.includes("Priority 7") }; })()
    : null;
  res.errs = window.__errs;
  window.__result = res; window.__done = true;
})();
<\/script>`;

const html = readFileSync(FILE, "utf8");
if (html.indexOf(CDN) === -1) { console.log("  FAIL PS-0: the Supabase CDN tag was not found"); fail++; done(1); }
let currentDriver = "", serveHtml = null;
const server = createServer((req, res) => {
  if (req.url.startsWith("/page")) {
    const body = (serveHtml || html).replace(CDN, STUB).replace("</body>", currentDriver + "</body>");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(body); return;
  }
  res.writeHead(404); res.end("no");
});
await new Promise(r => server.listen(PORT, r));
const profile = "/tmp/ps-e2e-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1), "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300); try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) { } }
if (!wsUrl) { console.log("  FAIL PS-0: Chrome never opened a debugging port"); fail++; chrome.kill(); server.close(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);

async function run(payload, pageHtml = null) {
  serveHtml = pageHtml; currentDriver = driver(payload);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  let out = null;
  for (let i = 0; i < 40 && !out; i++) {
    await sleep(250);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) out = JSON.parse(v.result.value);
  }
  serveHtml = null;
  return out || { threw: true, message: "no result" };
}

// Mutants: each undoes one fix in a copy of the page. They must be VALID pages (a one-expression swap).
const MUT_RANK = html.replace("    const rank = i + 1;", '    const rank = (typeof x.rank === "number" ? x.rank : (i+1));');
const MUT_RELATES = html.replace("if(x && x.priority_id) rankById[x.priority_id] = i + 1;", 'if(x && x.priority_id) rankById[x.priority_id] = (typeof x.rank==="number" ? x.rank : (i+1));');
const MUT_QW = html.replace("const q = dropConcernSystemQW(dropSuppressedQW(Array.isArray(p.quietly_working)?p.quietly_working:[], p), p)",
                            "const q = dropSuppressedQW(Array.isArray(p.quietly_working)?p.quietly_working:[], p)");
ok(MUT_RANK !== html && MUT_RELATES !== html && MUT_QW !== html, "PS-0 CONTROL: all three mutants applied to the page");

console.log("A  PRIORITY_POSITION_V1");
const g = await run(GAP);
ok(!g.threw && (g.errs || []).length === 0, "A0: renderDashboard ran with no exception or page error" + (g.message ? " (" + g.message + ")" : ""));
eq(g.ranks, ["01", "02", "03", "04", "05", "06"], "A1: stored ranks 1,2,3,4,6,7 render as 01 to 06");
ok(g.relates.some(t => /#5\b/.test(t)) && !g.relates.some(t => /#6\b/.test(t)), "A2: a lever tied to the stored-rank-6 priority reads #5, the card she sees (" + JSON.stringify(g.relates) + ")");
eq(g.titleFallback, "Priority 5", "A3: priorityTitle's last resort names the display position");
ok(g.reportHasP5 && g.reportHasP5.p5 && g.reportHasP5.p6 && !g.reportHasP5.p7, "A4: the health report's fallback names run Priority 1..6, never 7");
const c = await run(CONTIG);
eq(c.ranks, ["01", "02", "03", "04", "05", "06"], "A5 CONTROL: contiguous ranks 1..6 render 01 to 06, unchanged");
ok(c.relates.some(t => /#6\b/.test(t)), "A6 CONTROL: with contiguous ranks the stored-rank-6 lever still reads #6");
const gm = await run(GAP, MUT_RANK);
eq(gm.ranks, ["01", "02", "03", "04", "06", "07"], "A7 MUTANT: with the fix undone the page prints the gap, so A1 is not vacuous");
const rm = await run(GAP, MUT_RELATES);
ok(rm.relates.some(t => /#6\b/.test(t)), "A8 MUTANT: with the relates fix undone the lever reads #6 again");

console.log("B  STRENGTH_CONCERN_V1");
const h = await run(HER);
ok(!h.threw && (h.errs || []).length === 0, "B0: renderDashboard ran with no exception or page error");
ok(!h.quietText.includes("KIDNEY STRENGTH"), "B1: her shape, the kidney strength beside a kidney priority is dropped");
ok(h.quietText.includes("IRON STRENGTH") && h.quietCards === 1, "B2: the unrelated iron strength is kept (" + h.quietCards + " card)");
ok(!h.quietHidden && h.quietHeadingVisible, "B3: the section still shows, with its heading, when a strength survives");
const u = await run(UNREL);
ok(u.quietText.includes("IRON STRENGTH") && u.quietText.includes("THYROID STRENGTH") && u.quietCards === 2, "B4 CONTROL: strengths in systems no priority names are all kept");
const a = await run(ALLDROP);
ok(a.quietHidden && !a.quietHeadingVisible, "B5 EDGE: every strength dropped hides the whole section, heading included");
ok(a.quietCards === 0 && !/STRENGTH/.test(a.quietText), "B6 EDGE: and renders no card");
const hm = await run(HER, MUT_QW);
ok(hm.quietText.includes("KIDNEY STRENGTH"), "B7 MUTANT: with the filter undone the kidney strength shows, so B1 is not vacuous");
const am = await run(ALLDROP, MUT_QW);
ok(!am.quietHidden, "B8 MUTANT: with the filter undone the all-collide section shows, so B5 is not vacuous");

// The deck's relates thread is a one-line map; a source check with its own mutant.
const deckLine = "if(x && x.priority_id) b5Rank[x.priority_id] = i + 1;";
ok(html.includes(deckLine), "A9: the reveal deck's relates thread numbers by position too");
ok(!html.replace(deckLine, 'if(x && x.priority_id) b5Rank[x.priority_id] = x.rank;').includes(deckLine), "A9 MUTANT: a rank-based deck line is caught");
// No em dash in any copy this change added.
ok(!/[—–]/.test(html.slice(html.indexOf("function dropConcernSystemQW"), html.indexOf("function dropConcernSystemQW") + 2600).replace(/\/\/[^\n]*/g, "")),
   "C1: the new filter adds no em or en dash outside comments");

ws.close(); chrome.kill(); server.close();
done(fail ? 1 : 0);
