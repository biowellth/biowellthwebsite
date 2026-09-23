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
import { extractApp } from "./lib/extract-app.mjs";
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
  // DENSITY_COLLAPSE_V2 needs MORE THAN ONE of each, because the claims are about a SET of
  // disclosures and a THREE-column row. With one lever and one win the fixture could not tell a
  // three-across row from a one-across one, and "all of them are closed" was a claim about three
  // controls. Three of each gives 3 quiet + 3 lever + 1 why = seven.
  quietly_working: [
    { finding: "A quiet win", implication: "still true" },
    { finding: "A second win", implication: "also still true" },
    { finding: "A third win", implication: "holding steady" }],
  foundations: { lead: "Lead line", levers: [
    { display_name: "Sleep", action: "Sleep action", connection: "c" },
    { display_name: "Iron", action: "Iron action", connection: "c2" },
    { display_name: "Movement", action: "Movement action", connection: "c3" }], closing: "Closing" },
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
  // PRIO_TOGGLE_RIGHT_V1 geometry. Rectangles, read from the laid-out page, because where a
  // control SITS is the one thing a source scan cannot answer.
  const R = (e) => e.getBoundingClientRect();
  res.toggles = [...document.querySelectorAll("#prios .prio")].map(c => {
    const t = c.querySelector(".prio-title"), tg = c.querySelector(".prio-toggle"),
          ch = c.querySelector(".prio-chips"), bd = c.querySelector(".prio-body");
    if(!t || !tg) return null;
    const cs = getComputedStyle(tg);
    return {
      rightOfHeadline: R(tg).left >= R(t).right,
      belowChips: ch ? (R(tg).top >= R(ch).bottom - 1) : null,
      // CENTRED ON THE BODY, not the headline. Signed delta so a regression says which way it went.
      bodyCentreDelta: bd ? +((R(tg).top + R(tg).height / 2) - (R(bd).top + R(bd).height / 2)).toFixed(2) : null,
      flushRight: bd ? Math.round(R(bd).right - R(tg).right) : null,
      h: Math.round(R(tg).height),
      color: cs.color,
      fontSize: cs.fontSize,
      label: tg.querySelector(".prio-toggle-label").textContent.trim()
    };
  }).filter(Boolean);
  // The token is RESOLVED from the page, so the colour pin follows a token change instead of
  // freezing a hex the stylesheet no longer uses.
  {
    const probe = document.createElement("span");
    probe.style.color = "var(--teal)"; document.body.appendChild(probe);
    res.tealResolved = getComputedStyle(probe).color; probe.remove();
  }
  // DENSITY_COLLAPSE_V2. Both sections collapse to headlines with disclosures, so what is at
  // risk is a disclosure shipping OPEN and a paragraph rendering by default. Read off the laid
  // out page, because "closed by default" is a computed style, not a string in the source.
  res.disclosures = [...document.querySelectorAll("#quiet-wrap [aria-expanded], #foundations-wrap [aria-expanded]")]
    .map(b => b.getAttribute("aria-expanded"));
  res.bodiesHidden = [...document.querySelectorAll("#quiet-wrap .quiet-detail, #foundations-wrap .lever-detail, #foundations-wrap .found-why-detail")]
    .map(e => getComputedStyle(e).display);
  // DENSITY_COLLAPSE_V3. The intro is a loose node above the cards again. "Visible above the
  // cards" is a laid-out fact -- two rectangles and a computed style -- so it is read here and
  // not from source text, which cannot tell a node in the markup from a node on the page.
  {
    const intro = document.getElementById("quiet-intro");
    const firstQuiet = document.querySelector("#quiet .quiet");
    res.introLoose = document.querySelectorAll("#quiet-wrap > .quiet-intro").length;
    res.introInDetail = document.querySelectorAll("#quiet-wrap .quiet-detail .quiet-intro").length;
    res.introVisible = !!intro && getComputedStyle(intro).display !== "none"
      && getComputedStyle(intro).visibility === "visible"
      && intro.getBoundingClientRect().height > 0;
    res.introText = intro ? intro.textContent.trim().length : 0;
    res.introAboveCards = !!(intro && firstQuiet)
      && intro.getBoundingClientRect().bottom <= firstQuiet.getBoundingClientRect().top + 1;
    const d = firstQuiet ? firstQuiet.querySelector(".quiet-detail") : null;
    res.firstDetailKids = d ? [...d.children].map(e => e.className) : null;
  }
  res.whyToggle = !!document.querySelector("#found-why .found-why-toggle");
  res.whyLabel = document.querySelector("#found-why .found-why-toggle-label")
    ? document.querySelector("#found-why .found-why-toggle-label").textContent.trim() : null;
  res.leverCols = document.getElementById("found-levers")
    ? getComputedStyle(document.getElementById("found-levers")).gridTemplateColumns.split(" ").length : 0;
  res.leverCount = document.querySelectorAll("#found-levers .lever").length;
  res.errs = window.__errs;
  window.__result = res; window.__done = true;
})();
<\/script>`;

// ── Serve the repo, swapping only the CDN script and appending the driver for the page under test.
const html = readFileSync(FILE, "utf8");
if (html.indexOf(CDN) === -1) { console.log("  FAIL E2E-0: the Supabase CDN tag was not found in " + FILE); fail++; done(1); }
let currentDriver = "";
// Set to a mutated copy of the page for one run, then cleared. The mutant assertions need the
// SAME harness and the SAME payload as the real run, or a difference proves nothing.
let serveHtml = null, MUTANT_HTML = null;
const server = createServer((req, res) => {
  if (req.url.startsWith("/page")) {
    const src = serveHtml || html;
    const body = src.replace(CDN, STUB).replace("</body>", currentDriver + "</body>");
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
    // Back to the top before a full-page capture. Anything that scrolled the page leaves the sticky
    // header painted a second time partway down the shot. The scroll that caused it at 65f0cea was
    // the theme hit-test, which no longer exists, so this is now insurance rather than a fix, and
    // the assertion below proves the page really is at the top when the shutter opens.
    await send("Runtime.evaluate", { expression: "window.scrollTo(0,0)" }, sessionId);
    await sleep(250);
    const atTop = await send("Runtime.evaluate", { expression: "window.scrollY", returnByValue: true }, sessionId);
    console.log("       scrollY at capture: " + atTop.result.value + (atTop.result.value === 0 ? "  (top, so the header paints once)" : "  <-- NOT at the top"));
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

console.log("THE PHONE LAYOUT");
const narrow = await run(PAYLOAD, 390, "e2e-390");
if (!narrow) { console.log("  FAIL E2E-11: the page never finished at 390"); fail++; }
else {
  ok(!narrow.threw, "E2E-11: renderDashboard threw nothing at 390 either");
  eq(narrow.artSize, 56, "E2E-12: the circle shrinks to 56px under 480");
  ok(narrow.sections.themeGrid === true, "E2E-13: and the last section still renders");
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
}

// ── PRIO_TOGGLE_RIGHT_V1 ─────────────────────────────────────────────────────
// The expander moved to the right of the headline at >=481px and stays below the chips at
// <=480px. Both are read off the LAID-OUT page; the markup is identical at both widths, so the
// only thing that can distinguish them is the media query actually applying.
console.log("PRIO TOGGLE -- right of the headline on desktop");
{
  const t = (wide && wide.toggles) || [];
  ok(t.length > 0, "E2E-18: the desktop render produced expanders to measure  (" + t.length + ")");
  ok(t.every(x => x.rightOfHeadline), "E2E-19: every expander sits to the RIGHT of its headline");
  ok(t.every(x => x.belowChips === false), "E2E-20: and none of them is below the chips");
  // E2E-21 PINNED FIRST-LINE ALIGNMENT UNTIL 2026-09-23. The mockup centres the control on the
  // card body -- headline plus chips -- so the rule it pins changed with the CSS rather than the
  // assertion being dropped. The delta is signed, so a regression names its direction.
  ok(t.every(x => Math.abs(x.bodyCentreDelta) <= 2),
     "E2E-21: each is vertically centred on the card body, within 2px  (deltas " +
     JSON.stringify(t.map(x => x.bodyCentreDelta)) + ")");
  ok(wide.tealResolved && t.every(x => x.color === wide.tealResolved),
     "E2E-21b: the colour is the page's own --teal token, not a hex  (" + JSON.stringify(wide.tealResolved) + ")");
  ok(t.every(x => x.fontSize === "14px"),
     "E2E-21c: at 14px, the size .sysr-all ships  (" + JSON.stringify([...new Set(t.map(x => x.fontSize))]) + ")");
  ok(t.every(x => x.flushRight === 0), "E2E-22: and flush to the card body's right edge  (gaps " + JSON.stringify([...new Set(t.map(x=>x.flushRight))]) + ")");
  ok(t.every(x => x.h >= 44), "E2E-23: the touch target is at least 44px  (heights " + JSON.stringify([...new Set(t.map(x=>x.h))]) + ")");
}
console.log("PRIO TOGGLE -- below the chips on a phone");
const phone = await run(PAYLOAD, 390);
if (!phone) { console.log("  FAIL E2E-24: the phone render never finished"); fail++; }
else {
  const t = phone.toggles || [];
  ok(t.length > 0, "E2E-24: the phone render produced expanders to measure  (" + t.length + ")");
  ok(t.every(x => x.belowChips), "E2E-25: every expander drops BELOW the chips under 480px");
  ok(t.every(x => !x.rightOfHeadline), "E2E-26: none of them sits beside the headline there");
  ok(t.every(x => x.flushRight === 0), "E2E-27: and each is right-aligned");
  ok(t.every(x => x.h >= 44), "E2E-28: the touch target is still at least 44px");
  // THE PHONE FALLBACK IS UNCHANGED, and that is an assertion rather than an omission. The
  // restyle lives inside the >=481 block, so under 480 the control keeps the base colour and
  // size. Without these two, moving the declarations out of the media query would pass.
  ok(phone.tealResolved && t.every(x => x.color !== phone.tealResolved),
     "E2E-28b: under 480px the colour is NOT the teal token  (" + JSON.stringify([...new Set(t.map(x => x.color))]) + ")");
  ok(t.every(x => x.fontSize === "13px"),
     "E2E-28c: and the size is still 13px  (" + JSON.stringify([...new Set(t.map(x => x.fontSize))]) + ")");
  // CONTROL. The two widths must DISAGREE, or the media query is doing nothing and every
  // assertion above is describing one layout twice.
  ok(wide.toggles[0].rightOfHeadline !== phone.toggles[0].rightOfHeadline,
     "E2E-29 CONTROL: desktop and phone place it differently, so the breakpoint is real");
}

// ── DENSITY_COLLAPSE_V2 ──────────────────────────────────────────────────────
console.log("COLLAPSE -- every disclosure ships closed");
{
  const d = (wide && wide.disclosures) || [];
  ok(d.length >= 5, "E2E-38: at least five disclosures render across the two sections  (" + d.length + ")");
  ok(d.every(x => x === "false"), "E2E-38b: every one of them ships aria-expanded false  (" + JSON.stringify([...new Set(d)]) + ")");
  const bodies = (wide && wide.bodiesHidden) || [];
  ok(bodies.length >= 5, "E2E-39: and every disclosure has a body to hide  (" + bodies.length + ")");
  ok(bodies.every(x => x === "none"), "E2E-39b: all of them compute display:none by default  (" + JSON.stringify([...new Set(bodies)]) + ")");
  ok(wide.introLoose === 1, "E2E-39c: the going-right intro is ONE loose paragraph in the section  (" + wide.introLoose + ")");
  ok(wide.introInDetail === 0, "E2E-39d: and no copy of it sits inside a disclosure  (" + wide.introInDetail + ")");
  ok(wide.introVisible && wide.introText > 0,
     "E2E-39e: it renders visible, with text, while every card below it is shut  (" + wide.introText + " chars)");
  ok(wide.introAboveCards, "E2E-39f: and its box ends above the first card's box");
  ok(JSON.stringify(wide.firstDetailKids) === JSON.stringify(["quiet-note", "quiet-foot"]),
     "E2E-39g: the first card's disclosure holds its own line then the closing line, nothing else  ("
     + JSON.stringify(wide.firstDetailKids) + ")");
  ok(wide.whyToggle, "E2E-40: the Why these control renders under the lever row");
  eq(wide.whyLabel, "Why these", "E2E-40b: and it names its content");
  eq(wide.leverCols, 3, "E2E-41: the lever row is THREE across at 1280");
  eq(wide.leverCount, 3, "E2E-41b: with three levers in it, so the column count is not describing an empty grid");
}
if (phone) {
  eq(phone.leverCols, 1, "E2E-42: and stacks to one column on a phone");
  ok((phone.disclosures || []).every(x => x === "false"), "E2E-42b: still all closed there");
  // CONTROL. The two widths must DISAGREE on the column count, or the breakpoint does nothing.
  ok(wide.leverCols !== phone.leverCols, "E2E-43 CONTROL: desktop and phone differ, so the 768 breakpoint is real");
}

// ── A SECOND MUTANT: a paragraph rendered by default. Valid JS. ──────────────
// .quiet-detail is what hides the going-right body. Flipping its base rule to display:block is
// the smallest valid change that puts a paragraph back on the page uninvited, which is exactly
// what E2E-39b exists to catch.
console.log("MUTANT -- a collapsed body renders by default");
{
  const BASE = ".quiet-detail{display:none;margin-top:8px}";
  ok(html.indexOf(BASE) !== -1, "E2E-44: the collapsed base rule was LOCATED, so the mutant is a real change");
  const mut = html.replace(BASE, ".quiet-detail{display:block;margin-top:8px}");
  ok(mut.length === html.length + 1, "E2E-44b: the mutant differs by the one word  (" + (mut.length - html.length) + ")");
  let okJs = true;
  try { new Function(extractApp(mut, "the mutant")); } catch (e) { okJs = false; }
  ok(okJs, "E2E-44c: the mutant page's script still parses, so the cut was CSS only");
  serveHtml = mut;
  const m2 = await run(PAYLOAD, 1280);
  serveHtml = null;
  if (!m2) { console.log("  FAIL E2E-45: the mutant page never finished"); fail++; }
  else {
    ok((m2.bodiesHidden || []).some(x => x !== "none"),
       "E2E-45: with the base rule flipped a body renders by default, so E2E-39b can fail  (" +
       JSON.stringify([...new Set(m2.bodiesHidden || [])]) + ")");
  }
}

// ── THE MUTANT. Valid CSS-only change that restores the old position. ────────
// The >=481 grid block is what lifts the expander onto the headline row. Deleting it returns the
// button to its markup position, below the chips, at every width -- which is exactly the layout
// this change replaced. E2E-19 and E2E-20 must go red.
console.log("MUTANT -- the desktop grid is removed");
{
  const GRID = html.match(/@media\(min-width:481px\)\{\n(?:.*\n)*?\}\n/);
  ok(!!GRID, "E2E-30: the >=481 grid block was LOCATED in the shipped page, so the mutant is a real removal");
  if (GRID) {
    const mutant = html.replace(GRID[0], "");
    ok(mutant.length < html.length, "E2E-31: the mutant is shorter, so the removal took effect");
    // It is CSS, so "valid JS" is the app block still parsing: prove the removal did not cut code.
    let okJs = true;
    try { new Function(extractApp(mutant, "the mutant")); } catch (e) { okJs = false; }
    ok(okJs, "E2E-32: the mutant page's script still parses, so the cut was CSS only");
    MUTANT_HTML = mutant;
  }
}
if (MUTANT_HTML) {
  serveHtml = MUTANT_HTML;
  const m = await run(PAYLOAD, 1280);
  serveHtml = null;
  if (!m) { console.log("  FAIL E2E-33: the mutant page never finished"); fail++; }
  else {
    const t = m.toggles || [];
    ok(t.length > 0, "E2E-33: the mutant rendered cards to measure  (" + t.length + ")");
    ok(t.every(x => !x.rightOfHeadline), "E2E-34: without the grid the expander is NOT beside the headline, so E2E-19 can fail");
    ok(t.every(x => x.belowChips), "E2E-35: it falls back below the chips, so E2E-20 can fail");
    ok(m.tealResolved && t.every(x => x.color !== m.tealResolved),
       "E2E-36: and loses the teal, so E2E-21b can fail");
    ok(t.every(x => x.fontSize === "13px"), "E2E-37: and the 14px, so E2E-21c can fail");
  }
}

ws.close(); chrome.kill(); server.close();
await sleep(200);
done(fail ? 1 : 0);
