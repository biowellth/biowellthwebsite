#!/usr/bin/env node
// DRAW_DATE_UTC_TEST_V1 -- runs the REAL dashboard.html in headless Chrome under forced time zones
// and checks that every caller of fmtDrawDate prints the STORED draw day for a bare "YYYY-MM-DD".
// Synthetic payload only; every value is invented.
//
// The five callers, each read from the rendered page, not from source:
//   DD-a  reportDocHtml head          "Blood draw ..." in #report-doc
//   DD-b  openReport document.title   "BioWellth health report — ... — <date>"
//   DD-c  doctorHead                  "Blood draw ..." in #doctor-doc
//   DD-d  openDoctor document.title   "Summary for your doctor - ... - <date>"
//   DD-e  doctorSafetyChecks line     "... · <date>"
//
// BARE_DATE_UTC_V1 (2026-09-29) added the other bare-date paths, all through fmtCalendarDay:
//   DD-p  panelLabel, the report picker at the top of the dashboard    "1 Apr 2026 · <lab>"
//   DD-q  fmtPanelDate, "since your <Month YYYY> panel"                "April 2026"
//   DD-r  fmtDate, the chart axis and point labels                     "Apr 26"
//   DD-v  the report vault's "Collected <date>" (rvFmtDate, already UTC; pinned so it stays)
// The stored day is the 1st of a month on purpose, so the month-level formatters are exercised too:
// the old parse turned 1 April into March west of UTC.
//
// Zones: America/New_York and Pacific/Pago_Pago (west of UTC, where the old parse printed the day
// before), Asia/Kolkata and Pacific/Kiritimati (east). The stored day must print in all four.
//
// CONTROLS that can fire in the same run:
//   - a full TIMESTAMP still takes the local-time path, so under New_York 02:00Z on 1 April prints
//     31 March. That proves both the zone override is live and the timestamp path was kept.
//   - the MUTANT restores the old one-line parse and must go red west of UTC.
//
//   node scripts/test-draw-date-utc.mjs
import { readFileSync, existsSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9500 + Math.floor(Math.random() * 300);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
const STORED = "2026-04-01";
const WANT = "April 1, 2026";
const WEST = ["America/New_York", "Pacific/Pago_Pago"], EAST = ["Asia/Kolkata", "Pacific/Kiritimati"];

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };
if (!existsSync(CHROME)) { console.log("  FAIL DD-0: Chrome is not at " + CHROME); fail++; done(1); }

const mk = (id, name, sys, band) => ({ marker_id: id, display_name: name, system_id: sys, value: 1, unit: "u",
  canonical_unit: "u", normalized_value: 1, status: "flag", band, is_cycle_gated: false });
const PAYLOAD = {
  panel_date: STORED, lab_name: "Synthetic Diagnostics",
  vitality: { composite: 70, band: { key: "steady", label: "Steady" }, display: { show_composite: true }, deferred: [], deferred_reasons: {} },
  longitudinal: null, internal_metadata: { cycle_day_at_interpretation: null },
  systems: [
    { system_id: "iron_status", display_name: "Iron", status: "flag", markers: [mk("zz_iron", "Invented Iron Store", "iron_status", "deficient")] },
    { system_id: "autoimmune", display_name: "Autoimmune", status: "flag", markers: [mk("zz_antibody", "Invented Antibody", "autoimmune", "positive")] },
  ],
  priorities: [
    { rank: 1, priority_id: "p1", system_id: "iron_status", severity: "moderate", headline: "h", why_this_matters: "w", the_connection: "c",
      provider_followup_urgency: "routine", primary_markers: [{ marker_id: "zz_iron", display_name: "Invented Iron Store", band: "deficient", position: "low", flag_status: "user_facing" }],
      action_layer: { primary_lever: "lever" } },
  ],
  provider_discussion_points: [], quietly_working: [], coverage_gap: null,
};

const STUB = `<script>
window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message)));
const one = { data: { full_name: "Synthetic Tester", dob: "1990-01-01", consent_accepted_at: "2026-01-01T00:00:00Z", age_affirmed_at: "2026-01-01T00:00:00Z", confounders: {} }, error: null };
const chain = () => { const c = {}; for (const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"]) c[k] = () => c;
  c.maybeSingle = async () => one; c.single = async () => one; c.then = (f) => Promise.resolve({ data: [], error: null }).then(f); return c; };
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "00000000-0000-4000-8000-000000000001", email: "harness@example.com" } } } }),
          getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}) },
  from: () => chain(), functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null }), upload: async () => ({ data: null, error: null }) }) },
  rpc: async () => one }) };
<\/script>`;

const driver = `<script>
(async () => {
  await new Promise(r => setTimeout(r, 900));
  const res = { threw: false };
  const blood = (sel) => { const e = document.querySelector(sel); const l = e ? e.innerText.split("\\n").find(x => /^Blood draw /.test(x)) : null; return l ? l.replace(/^Blood draw /, "") : null; };
  try {
    const p = ${JSON.stringify(PAYLOAD)};
    const all = p.priorities; p.__sensitivePriorities = all.filter(prioritySensitive); p.priorities = all.filter(x => !prioritySensitive(x));
    window.__rdPayload = p; window.__rdReport = "rpt"; window.__rdReportConf = {};
    window.openReport();
    res.a = blood("#report-doc .report-doc-meta");
    res.b = document.title.split(" \\u2014 ").pop();
    window.closeReport();
    window.openDoctor();
    res.c = blood("#doctor-doc .report-doc-meta");
    res.d = document.title.split(" - ").pop();
    const sl = document.querySelector("#doctor-doc .doc-safety-line");
    res.e = sl ? sl.innerText.trim().split(" \\u00b7 ").pop() : null;
    res.p = panelLabel({ collected_on: "${STORED}", lab_name: "Synthetic Lab" });
    res.q = fmtPanelDate("${STORED}");
    res.r = fmtDate("${STORED}");
    renderReportVault([{ id: "r1", status: "done", collected_on: "${STORED}", created_at: "2026-04-03T10:00:00Z", file_path: "u/1-synthetic.pdf" }]);
    const vd = document.querySelector("#report-vault .rv-date");
    res.v = vd ? vd.innerText.trim() : null;
    // Timestamp controls: an instant keeps local time in every formatter (02:00Z on 1 April).
    res.tsP = panelLabel({ collected_on: null, created_at: "2026-04-01T02:00:00Z" });
    res.tsQ = fmtPanelDate("2026-04-01T02:00:00Z");
    res.tsR = fmtDate("2026-04-01T02:00:00Z");
    res.noDate = panelLabel({ lab_name: "Synthetic Lab" });
    res.ts = fmtDrawDate("2026-04-01T02:00:00Z");
    res.empty = fmtDrawDate("");
    res.bad = fmtDrawDate("not a date");
  } catch (err) { res.threw = true; res.message = String(err && err.message); }
  res.errs = window.__errs; window.__result = res; window.__done = true;
})();
<\/script>`;

const html = readFileSync(FILE, "utf8");
if (html.indexOf(CDN) === -1) { console.log("  FAIL DD-0: the Supabase CDN tag was not found"); fail++; done(1); }
// THE MUTANT: the one helper, fmtCalendarDay, with its bare-date branch removed, which is the old
// parse (new Date(d) formatted in local time). Every fixed path goes through it, so every one must
// go red west of UTC.
const FN = /function fmtCalendarDay\(d, locale, opts\)\{[\s\S]*?\n\}\n/;
const OLD_FN = 'function fmtCalendarDay(d, locale, opts){\n  if(d == null || d === "") return null;\n  const dt = new Date(d);\n  return isNaN(dt) ? null : dt.toLocaleDateString(locale, opts);\n}\n';
if (!FN.test(html)) { console.log("  FAIL DD-0: fmtCalendarDay was not located, so the mutant cannot be built"); fail++; done(1); }
const mutantHtml = html.replace(FN, OLD_FN);
if (mutantHtml === html) { console.log("  FAIL DD-0: the mutant changed nothing"); fail++; done(1); }
try { new Function(extractApp(mutantHtml, "the mutant")); } catch (e) { console.log("  FAIL DD-0: the mutant does not parse (" + e.message + ")"); fail++; done(1); }

let SERVE = "";
const server = createServer((req, res) => {
  if (req.url.startsWith("/ranges-slim.json")) { res.writeHead(200, { "content-type": "application/json" }); res.end(readFileSync("ranges-slim.json")); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(SERVE);
});
await new Promise(r => server.listen(PORT, r));
const profile = "/private/tmp/draw-date-utc-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1), "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Chrome is closed over the debugging socket and the profile removed only after it has exited.
let closeBrowser = null;
const finish = async (code) => {
  server.close();
  const exited = new Promise(r => { if (chrome.exitCode !== null || chrome.signalCode !== null) r(); else chrome.once("exit", r); });
  try { if (closeBrowser) await Promise.race([closeBrowser(), sleep(2000)]); } catch (e) {}
  await Promise.race([exited, sleep(4000)]);
  if (chrome.exitCode === null && chrome.signalCode === null) { try { chrome.kill("SIGKILL"); } catch (e) {} await Promise.race([exited, sleep(2000)]); }
  for (let i = 0; i < 3; i++) { try { rmSync(profile, { recursive: true, force: true }); } catch (e) {} await sleep(400); }
  done(code);
};
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL DD-0: Chrome never opened a debugging port"); fail++; await finish(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
closeBrowser = () => send("Browser.close");
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
const ev = async (expr) => { const v = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId); return v.result ? v.result.value : null; };
async function run(pageHtml, tz) {
  SERVE = pageHtml.replace(CDN, STUB).replace("</body>", driver + "</body>");
  await send("Emulation.setTimezoneOverride", { timezoneId: tz }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 40; i++) { await sleep(300); const v = await ev("window.__done ? JSON.stringify(window.__result) : ''"); if (v) return JSON.parse(v); }
  return null;
}
const CALLERS = [["a", "report head"], ["b", "report title"], ["c", "doctor head"], ["d", "doctor title"], ["e", "doctor safety line"]];
const OTHER = [["p", "report picker label", "1 Apr 2026 · Synthetic Lab"], ["q", "fmtPanelDate", "April 2026"],
               ["r", "fmtDate (chart)", "Apr 26"], ["v", "report vault", "Collected 1 April 2026"]];
const MUTABLE = ["p", "q", "r"];   // v is rvFmtDate, which never went through the helper

for (const tz of [...WEST, ...EAST]) {
  console.log("\n" + tz);
  const r = await run(html, tz);
  if (!r) { console.log("  FAIL DD-1: the page never finished under " + tz); fail++; continue; }
  ok(!r.threw && r.errs.length === 0, "DD-1 " + tz + ": nothing threw  (" + JSON.stringify([r.message, r.errs]) + ")");
  for (const [k, label] of CALLERS)
    ok(r[k] === WANT, "DD-" + k + " " + tz + ": " + label + " prints the stored day  (got " + JSON.stringify(r[k]) + ")");
  for (const [k, label, want] of OTHER)
    ok(r[k] === want, "DD-" + k + " " + tz + ": " + label + " prints the stored day  (got " + JSON.stringify(r[k]) + ")");
  ok(r.empty === "" && r.bad === "not a date", "DD-f " + tz + ": empty input gives empty, an unparseable one passes through");
  ok(r.noDate === "Panel · Synthetic Lab", "DD-f2 " + tz + ": a panel with no date keeps the 'Panel' fallback  (got " + JSON.stringify(r.noDate) + ")");
  if (tz === "America/New_York") {
    ok(r.ts === "March 31, 2026", "DD-g CONTROL " + tz + ": a full timestamp keeps the LOCAL path (02:00Z is 31 March here)  (got " + JSON.stringify(r.ts) + ")");
    ok(r.tsP === "31 Mar 2026" && r.tsQ === "March 2026" && r.tsR === "Mar 26",
       "DD-g2 CONTROL " + tz + ": the picker, fmtPanelDate and fmtDate keep local time for a timestamp  (got " + JSON.stringify([r.tsP, r.tsQ, r.tsR]) + ")");
  }
  if (tz === "Asia/Kolkata") {
    ok(r.ts === "April 1, 2026", "DD-h CONTROL " + tz + ": the same timestamp reads 1 April east of UTC, so DD-g is the zone, not a constant  (got " + JSON.stringify(r.ts) + ")");
    ok(r.tsP === "1 Apr 2026" && r.tsQ === "April 2026" && r.tsR === "Apr 26",
       "DD-h2 CONTROL " + tz + ": and the same for the other three  (got " + JSON.stringify([r.tsP, r.tsQ, r.tsR]) + ")");
  }
}

console.log("\nMUTANT -- the old one-line parse restored; west of UTC must go RED");
for (const tz of WEST) {
  const m = await run(mutantHtml, tz);
  const wrong = m ? CALLERS.filter(([k]) => m[k] !== WANT).map(([k]) => k) : null;
  ok(!!m && wrong.length === CALLERS.length, "DD-M " + tz + ": every caller prints a different day under the mutant  (wrong: " + JSON.stringify(wrong) + ", sample " + JSON.stringify(m && m.c) + ")");
  const wrong2 = m ? OTHER.filter(([k, , want]) => MUTABLE.includes(k) && m[k] !== want).map(([k]) => k) : null;
  ok(!!m && wrong2.length === MUTABLE.length, "DD-M2 " + tz + ": the picker, fmtPanelDate and fmtDate go red under the mutant too  (wrong: " + JSON.stringify(wrong2) + ", sample " + JSON.stringify(m && m.p) + ")");
  ok(!!m && m.v === "Collected 1 April 2026", "DD-M3 CONTROL " + tz + ": the vault, which never used the helper, stays right under the mutant  (got " + JSON.stringify(m && m.v) + ")");
}

await finish(fail ? 1 : 0);
