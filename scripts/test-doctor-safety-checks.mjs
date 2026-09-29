#!/usr/bin/env node
// DOCTOR_SAFETY_CHECKS_TEST_V1 -- runs the REAL dashboard.html in headless Chrome and calls the
// page's own openDoctor() on SYNTHETIC payloads. Every marker, band and date here is invented.
//
// What it pins, for the "For a clinician to review" section of the doctor summary:
//   SC-1  it appears, with one line per out-of-range safety-check marker, when there is one;
//   SC-2  it lists a safety marker that is out of range WITHOUT being a ranked priority, which is
//         the case __sensitivePriorities alone would miss;
//   SC-3  it never lists a non-safety marker, and never an in-range safety marker;
//   SC-4  it carries the closing text verbatim;
//   SC-5  it is ABSENT when no safety-check marker is out of range;
//   SC-6  it survives print media, and at 390px wide nothing in it overflows;
//   SC-7  a mutant with the section unwired goes RED.
//
// EVERY ABSENCE CLAIM HAS A CONTROL THAT CAN FIRE IN THE SAME RUN: the absent fixture differs from
// the present one only in bands, and the non-safety marker planted with a high band is shown to
// reach "Findings to discuss" so its absence here is not an absence everywhere.
//
//   node scripts/test-doctor-safety-checks.mjs
import { readFileSync, existsSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9300 + Math.floor(Math.random() * 400);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
const CLOSE = "These are reported exactly as scored in your results. They are not interpreted here, and this is not a diagnosis. Please review them with a doctor, who can put them in the context of your history and examination.";
const HEADING = "For a clinician to review";

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };
if (!existsSync(CHROME)) { console.log("  FAIL SC-0: Chrome is not at " + CHROME); fail++; done(1); }

const mk = (id, name, sys, band) => ({ marker_id: id, display_name: name, system_id: sys, value: 1, unit: "u",
  canonical_unit: "u", normalized_value: 1, status: band === "optimal" || band === "negative" ? "optimal" : "flag",
  band, is_cycle_gated: false });

// PRESENT fixture.
//   zz_antibody (autoimmune, "low_positive")  out of range, IS a ranked priority
//   zz_metal    (heavy_metals, "high")        out of range, NOT a priority  (SC-2)
//   zz_metal_ok (heavy_metals, "optimal")     in range, must not list        (SC-3)
//   aso filed under "immunity" (a non-safety system), band "positive": a SENSITIVE_MARKER_IDS marker
//                                             that must still list by its id (SC-2b)
//   zz_ferritin (iron_status, "deficient")    non-safety and out of range: must never list here,
//                                             and IS in Findings to discuss (the SC-3 control)
function present() {
  return {
    panel_date: "2026-04-01", lab_name: "Synthetic Diagnostics",
    vitality: { composite: 70, band: { key: "steady", label: "Steady" }, display: { show_composite: true }, deferred: [], deferred_reasons: {} },
    longitudinal: null, internal_metadata: { cycle_day_at_interpretation: null },
    systems: [
      { system_id: "iron_status", display_name: "Iron", status: "flag", markers: [mk("zz_ferritin", "Invented Iron Store", "iron_status", "deficient")] },
      { system_id: "autoimmune", display_name: "Autoimmune", status: "flag", markers: [mk("zz_antibody", "Invented Antibody", "autoimmune", "low_positive")] },
      { system_id: "heavy_metals", display_name: "Heavy Metals", status: "flag", markers: [
        mk("zz_metal", "Invented Metal", "heavy_metals", "high"), mk("zz_metal_ok", "Invented Quiet Metal", "heavy_metals", "optimal")] },
      { system_id: "immunity", display_name: "Immunity", status: "watch", markers: [mk("aso", "Invented ASO Label", "immunity", "positive")] },
    ],
    priorities: [
      { rank: 1, priority_id: "p1", system_id: "iron_status", severity: "moderate", headline: "h", why_this_matters: "w", the_connection: "c",
        provider_followup_urgency: "routine", primary_markers: [{ marker_id: "zz_ferritin", display_name: "Invented Iron Store", band: "deficient", position: "low", flag_status: "user_facing" }],
        action_layer: { primary_lever: "lever" } },
      { rank: 2, priority_id: "p2", system_id: "autoimmune", severity: "moderate", headline: "h", why_this_matters: "w", the_connection: "c",
        provider_followup_urgency: "routine", primary_markers: [{ marker_id: "zz_antibody", display_name: "Invented Antibody", band: "low_positive", position: "high", flag_status: "user_facing" }],
        action_layer: { primary_lever: "lever" } },
    ],
    provider_discussion_points: [], quietly_working: [], coverage_gap: null,
  };
}
// ABSENT fixture: the same payload with every safety-check band clean. Nothing else changes.
function absent() {
  const p = present();
  for (const s of p.systems) for (const m of s.markers) {
    if (s.system_id === "autoimmune" || s.system_id === "immunity") m.band = "negative";
    if (s.system_id === "heavy_metals") m.band = "optimal";
  }
  p.priorities[1].primary_markers[0].band = "negative";
  return p;
}

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

// renderDashboard's partition is applied first, exactly as on the live page, so the section is
// tested against the payload shape openDoctor really receives.
const driverFor = (payload) => `<script>
(async () => {
  await new Promise(r => setTimeout(r, 900));
  const res = { threw: false };
  try {
    const p = ${JSON.stringify(payload)};
    const all = p.priorities; p.__sensitivePriorities = all.filter(prioritySensitive); p.priorities = all.filter(x => !prioritySensitive(x));
    window.__rdPayload = p; window.__rdReport = "rpt"; window.__rdReportConf = {};
    window.openDoctor();
  } catch (err) { res.threw = true; res.message = String(err && err.message); }
  const secs = [...document.querySelectorAll("#doctor-doc .report-sec")];
  const find = (h) => secs.find(x => { const e = x.querySelector(".report-sec-h"); return e && e.innerText.trim() === h; });
  const sc = find("${HEADING}");
  res.headings = [...document.querySelectorAll("#doctor-doc .report-sec-h")].map(e => e.innerText.trim());
  res.present = !!sc;
  res.ids = sc ? [...sc.querySelectorAll(".doc-safety-line")].map(e => e.getAttribute("data-marker-id")) : [];
  res.lines = sc ? [...sc.querySelectorAll(".doc-safety-line")].map(e => e.innerText.trim()) : [];
  res.close = sc && sc.querySelector(".doc-safety-close") ? sc.querySelector(".doc-safety-close").innerText.trim() : null;
  res.text = sc ? sc.innerText : "";
  const fd = find("Findings to discuss");
  res.findingsText = fd ? fd.innerText : "";
  const hm = document.querySelector("#doctor-doc .report-doc-meta"); res.headMeta = hm ? hm.innerText : "";
  res.errs = window.__errs;
  window.__result = res; window.__done = true;
})();
<\/script>`;

const html = readFileSync(FILE, "utf8");
if (html.indexOf(CDN) === -1) { console.log("  FAIL SC-0: the Supabase CDN tag was not found"); fail++; done(1); }
const WIRE = "doctorFindings(p) + doctorSafetyChecks(p) +";
if (html.indexOf(WIRE) === -1) { console.log("  FAIL SC-0: the wiring anchor was not found, so the mutant cannot be built"); fail++; done(1); }
const mutantHtml = html.replace(WIRE, "doctorFindings(p) +");
try { new Function(extractApp(mutantHtml, "the mutant")); } catch (e) { console.log("  FAIL SC-0: the mutant does not parse (" + e.message + ")"); fail++; done(1); }

let SERVE = "";
const server = createServer((req, res) => {
  if (req.url.startsWith("/ranges-slim.json")) { res.writeHead(200, { "content-type": "application/json" }); res.end(readFileSync("ranges-slim.json")); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(SERVE);
});
await new Promise(r => server.listen(PORT, r));
const profile = "/private/tmp/doctor-safety-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1), "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// The profile is removed only after Chrome has EXITED; removing it while Chrome still writes to it
// leaves the directory behind.
// Chrome is asked to close itself over the debugging socket, which ends its helper processes too,
// and the profile is removed only after the browser has exited. A plain kill left helpers writing
// into the profile after it was removed, and the directory came back.
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
if (!wsUrl) { console.log("  FAIL SC-0: Chrome never opened a debugging port"); fail++; await finish(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
closeBrowser = () => send("Browser.close");
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
const ev = async (expr) => { const v = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId); return v.result ? v.result.value : null; };
async function run(pageHtml, payload, width) {
  SERVE = pageHtml.replace(CDN, STUB).replace("</body>", driverFor(payload) + "</body>");
  await send("Emulation.setEmulatedMedia", { media: "screen" }, sessionId);
  await send("Emulation.setTimezoneOverride", { timezoneId: "America/New_York" }, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: width || 1200, height: 900, deviceScaleFactor: 1, mobile: !!width }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 40; i++) { await sleep(300); const v = await ev("window.__done ? JSON.stringify(window.__result) : ''"); if (v) return JSON.parse(v); }
  return null;
}

console.log("PRESENT -- safety-check markers out of range");
const r = await run(html, present());
if (!r) { console.log("  FAIL SC-1: the page never finished"); fail++; }
else {
  ok(!r.threw && r.errs.length === 0, "SC-1a: openDoctor threw nothing and the page logged no error  (" + JSON.stringify([r.message, r.errs]) + ")");
  ok(r.present, "SC-1b: the section '" + HEADING + "' renders");
  eq(JSON.stringify(r.ids.slice().sort()), JSON.stringify(["aso", "zz_antibody", "zz_metal"]), "SC-1c: exactly the three out-of-range safety-check markers, one line each");
  const ab = r.lines.find(l => l.indexOf("Invented Antibody") === 0);
  eq(ab, "Invented Antibody · Autoimmune Markers · low positive · " + new Date("2026-04-01T00:00:00Z").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
     "SC-1d: the line reads name, group, the engine's band, draw date");
  // The stored draw day, never the day before. A bare ISO date parsed as UTC and shown in local
  // time slips back a day west of UTC; this run pins TZ so that case is exercised.
  ok(/\b1\b/.test(ab || "") && /April/.test(ab || "") && !/March|31/.test(ab || ""), "SC-1e: the draw date is the stored day (1 April), not the day before  (" + JSON.stringify(ab) + ")");
  ok(/March 31/.test(r.headMeta), "SC-1f CONTROL: the timezone override is live, the head's existing fmtDrawDate line shows the day before  (" + JSON.stringify(r.headMeta.split("\n").find(l => /Blood draw/.test(l)) || "") + ")");
  ok(r.ids.includes("zz_metal"), "SC-2: a safety marker out of range but NOT a ranked priority is listed");
  ok(r.ids.includes("aso"), "SC-2b: a safety marker filed under a non-safety system is listed by its id");
  ok(!r.ids.includes("zz_ferritin") && r.text.indexOf("Invented Iron Store") === -1, "SC-3a: the out-of-range NON-safety marker is never listed");
  ok(r.findingsText.indexOf("Invented Iron Store") !== -1, "SC-3b CONTROL: that same marker DOES reach Findings to discuss, so SC-3a is not a render failure");
  ok(!r.ids.includes("zz_metal_ok") && r.text.indexOf("Invented Quiet Metal") === -1, "SC-3c: an in-range safety marker is never listed");
  ok(!/\d+(\.\d+)?\s*u\b/.test(r.text) && !/range|normal|reassur|nothing to worry/i.test(r.text.replace(CLOSE, "")),
     "SC-3d: no value, no range and no reassurance in the section");
  eq(r.close, CLOSE, "SC-4: the closing text is verbatim");
  const i1 = r.headings.indexOf("Findings to discuss"), i2 = r.headings.indexOf(HEADING);
  ok(i1 !== -1 && i2 === i1 + 1, "SC-4b: the section sits directly after Findings to discuss  (" + JSON.stringify(r.headings) + ")");

  // SC-6, print. The section must be visible under print media, which is the Save as PDF path.
  await send("Emulation.setEmulatedMedia", { media: "print" }, sessionId);
  await sleep(200);
  const pr = JSON.parse(await ev(`JSON.stringify((() => { const s = document.querySelector("#doctor-doc .doc-safety"); if (!s) return { found: false };
    const hidden = (el) => { for (let e = el; e; e = e.parentElement) if (getComputedStyle(e).display === "none" || getComputedStyle(e).visibility === "hidden") return true; return false; };
    const f = document.querySelector("#doctor-view .report-print-footer");
    return { found: true, hidden: hidden(s), h: s.getBoundingClientRect().height, footer: f ? getComputedStyle(f).display : null }; })())`));
  ok(pr.found && !pr.hidden && pr.h > 0, "SC-6a: under print media the section is displayed  (" + JSON.stringify(pr) + ")");
  ok(pr.footer === "block", "SC-6b CONTROL: the print rules are active, the doctor footer prints  (" + pr.footer + ")");
}

console.log("\n390px -- nothing in the section overflows");
{
  const P = present(); P.systems[2].markers[0].display_name = "An Invented Metal With A Deliberately Long Name To Force Wrapping";
  const n = await run(html, P, 390);
  const o = JSON.parse(await ev(`JSON.stringify((() => { const s = document.querySelector("#doctor-doc .doc-safety"); if (!s) return { found: false };
    const doc = document.getElementById("doctor-doc").getBoundingClientRect(); const out = [];
    for (const e of [s, ...s.querySelectorAll("*")]) { const b = e.getBoundingClientRect(); if (b.right > doc.right + 0.5 || e.scrollWidth > e.clientWidth + 1) out.push(e.className); }
    return { found: true, vw: innerWidth, overflow: out, docW: Math.round(doc.width), pageScroll: document.documentElement.scrollWidth > innerWidth }; })())`));
  ok(n && o.found, "SC-6c: the section renders at 390px");
  eq(o.vw, 390, "SC-6d CONTROL: the viewport really is 390px");
  ok(o.found && o.overflow.length === 0, "SC-6e: no element in the section overflows the document  (" + JSON.stringify(o.overflow) + ")");
}

console.log("\nABSENT -- the same payload with every safety-check band clean");
const a = await run(html, absent());
if (!a) { console.log("  FAIL SC-5: the page never finished"); fail++; }
else {
  ok(!a.threw && a.errs.length === 0, "SC-5a: openDoctor threw nothing");
  ok(!a.present && a.headings.indexOf(HEADING) === -1, "SC-5b: the section is absent  (" + JSON.stringify(a.headings) + ")");
  ok(a.findingsText.indexOf("Invented Iron Store") !== -1, "SC-5c CONTROL: the document still rendered Findings to discuss");
}

console.log("\nMUTANT -- the section unwired from doctorDocHtml; SC-1b must go RED");
const m = await run(mutantHtml, present());
ok(!!m && !m.present, "SC-7: with the section unwired, the present fixture renders no section (so SC-1b can fail)");

await finish(fail ? 1 : 0);
