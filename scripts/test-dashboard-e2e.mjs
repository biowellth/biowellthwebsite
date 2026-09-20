#!/usr/bin/env node
// DASHBOARD_E2E_V1 -- runs the REAL dashboard.html in a real browser and calls renderDashboard on a
// payload, which is the only check that can catch the class of bug that took the dashboard down.
//
// WHY THIS EXISTS. PRIO_ART_V1 shipped with its declarations inside the priorities map callback.
// prioArtSVG resolved, being called from inside that callback, and PRIO_ART_DRAWN was read after it
// closed, throwing ReferenceError and aborting renderDashboard with the cards already painted and
// every section below them missing. Three separate checks were green at the time:
//   - the unit test extracted prioArtSVG and ran it in an isolated scope, where the flag is never read
//   - one assertion regex-matched the source text, which proves a string exists and nothing more
//   - the visual harness pasted prioArtSVG output into hand-built markup, never calling renderDashboard
// None of them could see a scope error. This one runs the real call path, so it can.
//
// WHAT IT DOES. Serves the repo over http, swapping ONLY the Supabase CDN script for a stub with a
// synthetic session, so the page boots offline. Then it calls renderDashboard on a three-priority
// payload and asserts no exception plus every section non-empty, reads computed styles for the card
// claims the unit test can no longer make from source text, and runs an EMPTY payload as a
// known-positive control: if the harness were doing nothing, the empty case would look identical.
//
//   node scripts/test-dashboard-e2e.mjs            (SHOT=1 also writes screenshots to /tmp)
//   DASH=path/to/dashboard.html node scripts/test-dashboard-e2e.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const FILE = process.env.DASH || "dashboard.html";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8100 + Math.floor(Math.random() * 400);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };

if (!existsSync(CHROME)) {
  console.log("  FAIL E2E-0: Chrome is not at " + CHROME + ", so the end-to-end path cannot run");
  fail++; done(1);
}

// The stub replaces the Supabase library and nothing else. A synthetic user id, never a real one.
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

const mk = (id, name, sys, v) => ({ marker_id: id, display_name: name, value: v, unit: "ng/mL",
  canonical_unit: "ng/mL", normalized_value: v, status: "watch", band: "suboptimal_low", system_id: sys });
const prio = (rank, head, sys, mid, name, pos) => ({ rank, headline: head, system_id: sys, severity: "moderate",
  primary_markers: [{ marker_id: mid, display_name: name, position: pos, band: "suboptimal_low", flag_status: "watch", value: 12 }],
  why_this_matters: "why", the_connection: "connection", action_layer: { primary_lever: "lever" },
  trajectory_promise: "promise" });
const PAYLOAD = {
  panel_date: "2026-08-05",
  vitality: { composite: 74, band: { key: "steady", label: "Steady" }, display: { show_composite: true } },
  longitudinal: null,
  systems: [
    { system_id: "iron_status", display_name: "Iron", status: "watch", markers: [mk("ferritin", "Ferritin", "iron_status", 12)] },
    { system_id: "liver", display_name: "Liver", status: "watch", markers: [mk("alt", "ALT", "liver", 34)] },
    // A system with no artwork. Every non-safety system in CANONICAL_TITLE has a drawing, so an
    // unmapped one has to be a system id the set has never heard of.
    { system_id: "mystery_system", display_name: "Mystery", status: "watch", markers: [mk("unknown_marker", "Unknown", "mystery_system", 9)] },
  ],
  priorities: [
    prio(1, "Your iron stores are running low", "iron_status", "ferritin", "Ferritin", "low"),
    prio(2, "Your liver is under some load", "liver", "alt", "ALT", "high"),
    prio(3, "An unmapped system draws nothing", "mystery_system", "unknown_marker", "Unknown", "high"),
  ],
  quietly_working: [{ finding: "A quiet win", implication: "still true" }],
  foundations: { lead: "Lead line", levers: [{ display_name: "Sleep", connection: "c" }], closing: "Closing" },
  coverage_gap: { by_system: { vitamins: ["vitamin_d"] }, direction_only: [] },
};
const EMPTY = { panel_date: "2026-08-05", vitality: { composite: null, band: {}, display: { show_composite: false } },
  longitudinal: null, systems: [], priorities: [], quietly_working: [], foundations: null, coverage_gap: null };

const driver = (payload) => `<script>
(async () => {
  await new Promise(r => setTimeout(r, 350));
  window.__rdSeries = {}; window.__allReports = [{ id: "r1", collected_on: "2026-08-05" }];
  window.__doneReportIds = new Set(["r1"]);
  const P = ${JSON.stringify(payload)};
  const res = { threw: false };
  try { await window.renderDashboard(P, "r1"); window.showView("dashboard"); }
  catch (err) { res.threw = true; res.name = err.name; res.message = err.message;
                res.stack = String(err.stack || "").split("\\n").slice(0, 3).join(" | "); }
  const filled = (id) => { const el = document.getElementById(id); return !!(el && el.innerHTML.trim().length); };
  res.sections = { prios: filled("prios"), quiet: filled("quiet"), foundations: filled("found-levers"),
                   themeGrid: filled("theme-grid"), rail: filled("rail-systems"), railBrowse: filled("rail-browse") };
  const card = document.querySelector("#prios .prio");
  const art = document.querySelector("#prios .prio-art");
  res.cards = document.querySelectorAll("#prios .prio").length;
  res.arts = document.querySelectorAll("#prios .prio-art").length;
  res.borderLeft = card ? getComputedStyle(card).borderLeftWidth : null;
  res.artSize = art ? Math.round(art.getBoundingClientRect().width) : null;
  res.artStroke = art ? (art.querySelector("path") || {}).getAttribute?.("stroke") : null;
  res.paAnim = !!document.querySelector("#prios.pa-anim");
  res.lastCardHasArt = !!(document.querySelectorAll("#prios .prio")[2] || {}).querySelector?.(".prio-art");
  // THEME_ART_V1. Per card: its theme key, how many motifs it holds, and whether the card's own
  // text is what the browser hits at the text's coordinates. elementFromPoint is the only way to
  // prove the motif is BEHIND rather than merely painted first.
  res.themes = [...document.querySelectorAll("#theme-grid .theme-card")].map((c) => {
    // SCROLL IT INTO VIEW FIRST. elementFromPoint only hit-tests inside the viewport, and the theme
    // grid is the last section on a long page, so without this every hit came back null and the
    // assertion failed for a reason that had nothing to do with the motif.
    c.scrollIntoView({ block: "center" });
    const name = c.querySelector(".theme-name");
    const r = name ? name.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)) : null;
    const motif = c.querySelector(".theme-art");
    return {
      key: c.getAttribute("data-theme") || (name ? name.textContent : "?"),
      motifs: c.querySelectorAll(".theme-art").length,
      // A POPULATED CARD IS A <button>, and Chrome hit-tests a button atomically, returning the
      // button rather than the span inside it. So the claim that means something is that the hit is
      // inside this card and is NOT the motif: the text layer wins, the decoration never does.
      textOnTop: !!(hit && c.contains(hit) && !hit.closest(".theme-art")),
      hitTag: hit ? hit.tagName.toLowerCase() + (hit.className && typeof hit.className === "string" ? "." + hit.className.split(" ")[0] : "") : null,
      motifIsSvg: !!(motif && motif.tagName.toLowerCase() === "svg"),
      motifStroke: motif ? getComputedStyle(motif.querySelector("path")).stroke : null,
      motifWidth: motif ? Math.round(motif.getBoundingClientRect().width) : null,
      motifPointer: motif ? getComputedStyle(motif).pointerEvents : null,
    };
  });
  res.errs = window.__errs;
  window.__result = res; window.__done = true;
})();
<\/script>`;

// ── Serve the repo, swapping only the CDN script and appending the driver for the page under test.
const html = readFileSync(FILE, "utf8");
if (html.indexOf(CDN) === -1) { console.log("  FAIL E2E-0: the Supabase CDN tag was not found in " + FILE); fail++; done(1); }
let currentDriver = "";
const server = createServer((req, res) => {
  if (req.url.startsWith("/page")) {
    const body = html.replace(CDN, STUB).replace("</body>", currentDriver + "</body>");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(body); return;
  }
  res.writeHead(404); res.end("no");
});
await new Promise(r => server.listen(PORT, r));

const profile = "/tmp/dash-e2e-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1),
  "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) { }
}
if (!wsUrl) { console.log("  FAIL E2E-0: Chrome never opened a debugging port"); fail++; chrome.kill(); server.close(); done(1); }

const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);

async function run(payload, width, shotName) {
  currentDriver = driver(payload);
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: shotName ? 2 : 1, mobile: width < 500 }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?w=" + width + "&t=" + Date.now() }, sessionId);
  let out = null;
  for (let i = 0; i < 30 && !out; i++) {
    await sleep(250);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) out = JSON.parse(v.result.value);
  }
  if (shotName && process.env.SHOT) {
    // Let the staggered draw-in finish. Without this the shot catches the second card mid-animation
    // and its circle looks empty, which reads as a missing drawing rather than a running one.
    await sleep(2200);
    // Back to the top first: the theme hit-test scrolls the page, and a full-page capture taken
    // mid-scroll paints the sticky header a second time, halfway down the shot.
    await send("Runtime.evaluate", { expression: "window.scrollTo(0,0)" }, sessionId);
    await sleep(250);
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
    writeFileSync("/tmp/" + shotName + ".png", Buffer.from(shot.data, "base64"));
    console.log("       screenshot /tmp/" + shotName + ".png");
  }
  return out;
}

console.log("RENDER THE REAL DASHBOARD -- three priorities, desktop");
const wide = await run(PAYLOAD, 1280, "e2e-1280");
if (!wide) { console.log("  FAIL E2E-1: the page never finished; the harness itself is broken"); fail++; }
else {
  ok(!wide.threw, "E2E-1: renderDashboard threw nothing" + (wide.threw ? "  -> " + wide.name + ": " + wide.message : ""));
  if (wide.threw) console.log("       " + wide.stack);
  for (const [k, v] of Object.entries(wide.sections)) ok(v === true, "E2E-2." + k + ": the " + k + " section rendered");
  eq(wide.errs.length, 0, "E2E-3: no uncaught window error either");
  eq(wide.cards, 3, "E2E-4: all three priority cards rendered");
  eq(wide.arts, 2, "E2E-5: two drawings, because the unmapped system gets none");
  ok(wide.cards === 3 && wide.lastCardHasArt === false,
     "E2E-6: and it is specifically the THIRD card that has none, which needs three cards to mean anything");
  eq(wide.borderLeft, "1px", "E2E-7: the card's left border is the plain 1px box border, not the old 4px coral stripe");
  eq(wide.artSize, 76, "E2E-8: the circle measures 76px on the desktop layout");
  ok(String(wide.artStroke || "").indexOf("var(--") === 0, "E2E-9: the stroke is a token, read off the rendered path  (" + wide.artStroke + ")");
  ok(wide.paAnim === true, "E2E-10: the draw-in class is applied to the priorities host");
}

console.log("THEME CARD MOTIFS -- rendered, not read from source");
if (!wide) { console.log("  FAIL E2E-T0: no desktop run to inspect"); fail++; }
else {
  const themed = wide.themes.filter(t => t.motifs > 0);
  const bare = wide.themes.filter(t => t.motifs === 0);
  eq(wide.themes.length, 6, "E2E-T1: six theme cards rendered");
  ok(themed.length > 0, "E2E-T2: at least one card carries a motif  (" + themed.map(t => t.key).join(", ") + ")");
  for (const t of wide.themes) ok(t.motifs <= 1, "E2E-T3." + t.key + ": at most one motif, never a stack  (" + t.motifs + ")");
  for (const t of themed) {
    ok(t.motifIsSvg, "E2E-T4." + t.key + ": the motif is an svg element");
    ok(String(t.motifStroke).indexOf("rgba(71, 55, 43") === 0,
       "E2E-T5." + t.key + ": stroked with brown at low alpha, read off computed style  (" + t.motifStroke + ")");
    eq(t.motifWidth, 180, "E2E-T6." + t.key + ": about 180px wide on the desktop layout");
    eq(t.motifPointer, "none", "E2E-T7." + t.key + ": and it cannot take a click");
  }
  for (const t of wide.themes)
    ok(t.textOnTop, "E2E-T8." + t.key + ": the text layer is what the browser hits, never the motif  (" + t.hitTag + ")");
  // The motif set is deliberately partial, so a theme with no mapping must render bare rather than
  // borrowing a neighbour's shape. This asserts the shape of the evidence, not a specific count.
  ok(bare.every(t => t.motifs === 0), "E2E-T9: any theme without a mapping renders no motif at all  (" +
     (bare.length ? bare.map(t => t.key).join(", ") : "none unmapped today") + ")");
}

console.log("THE PHONE LAYOUT");
const narrow = await run(PAYLOAD, 390, "e2e-390");
if (!narrow) { console.log("  FAIL E2E-11: the page never finished at 390"); fail++; }
else {
  ok(!narrow.threw, "E2E-11: renderDashboard threw nothing at 390 either");
  eq(narrow.artSize, 56, "E2E-12: the circle shrinks to 56px under 480");
  ok(narrow.sections.themeGrid === true, "E2E-13: and the last section still renders");
  const nThemed = narrow.themes.filter(t => t.motifs > 0);
  ok(nThemed.length > 0, "E2E-T10: the motifs survive the phone layout");
  ok(nThemed.every(t => t.motifWidth === 120), "E2E-T11: scaled to 120px under 480  (" +
     [...new Set(nThemed.map(t => t.motifWidth))].join(", ") + ")");
  ok(narrow.themes.every(t => t.textOnTop), "E2E-T12: and the text is still on top at 390");
}

console.log("KNOWN-POSITIVE CONTROL -- an empty payload must NOT look like a pass");
const empty = await run(EMPTY, 1280, null);
if (!empty) { console.log("  FAIL E2E-14: the control page never finished"); fail++; }
else {
  ok(empty.sections.prios === false, "E2E-14: with no priorities the prios section is empty");
  ok(empty.cards === 0, "E2E-15: and no cards at all");
  ok(empty.arts === 0, "E2E-16: so no drawings");
  ok(wide && wide.sections.prios === true && empty.sections.prios === false,
     "E2E-17: the two runs DISAGREE, which is what proves the harness is reading the real page");
  // The theme grid still renders its six cards on an empty payload, which is what makes it a good
  // control for the motifs: same cards, same motifs, and the COUNTS are what differ.
  ok(empty.themes.length === 6, "E2E-18: the theme grid renders even with nothing to count");
  ok(empty.themes.every(t => t.textOnTop), "E2E-19: and its text is on top there too");
}

ws.close(); chrome.kill(); server.close();
await sleep(200);
done(fail ? 1 : 0);
