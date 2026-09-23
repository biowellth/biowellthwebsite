#!/usr/bin/env node
// EMPTY_PROSE_V1 -- the five hardenings against a Call B prose field that worker v134's
// PROSE_GUARD_V1 can leave empty ("" for a string, an element removed from an array, an array at
// length 0).
//
// WHY A BROWSER TEST. Four of the five are about what a card LOOKS like when a field is blank --
// an empty element, a control that opens onto nothing, a section that should have hidden -- and
// the fifth is about whether a function further down the body still runs. A source scan can see
// none of that. This serves the real dashboard.html and calls its real renderers.
//
// SHAPE. Every fix gets three runs:
//   CONTROL   the populated payload, proving the text renders and the fix is dormant,
//   BLANKED   the same payload with exactly what the guard can leave, proving the new behaviour,
//   MUTANT    the shipped file with that one fix reverted, VALID JS, proving the blanked
//             assertion discriminates instead of passing for an unrelated reason.
//
// Plus one whole-page check: on the POPULATED payload all four surfaces are byte-identical to the
// build before these commits. A hardening that changes a populated render is a redesign.
//
// Every fixture is SYNTHETIC. No stored row, no real marker result, no lab value, no real user id.
//
//   node scripts/test-empty-prose.mjs          (SHOT=1 also writes screenshots to /tmp)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const FILE = process.env.DASH || "dashboard.html";
const BEFORE_REF = process.env.BEFORE_REF || "8d9c2e0";   // the commit these five fixes land on
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8900 + Math.floor(Math.random() * 400);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };

if (!existsSync(CHROME)) { console.log("  FAIL EP-0: Chrome is not at " + CHROME); fail++; done(1); }

const STUB = `<script>
window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message)));
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

// ── the fixture ─────────────────────────────────────────────────────────────
const mk = (id, name, sys) => ({ marker_id: id, display_name: name, value: 12, unit: "ng/mL",
  canonical_unit: "ng/mL", normalized_value: 12, status: "watch", band: "suboptimal_low",
  position: "low", flag_status: "user_facing", system_id: sys });
const prio = (rank, sys, mid, name) => ({
  priority_id: "p" + rank, rank, headline: "HEADLINE_" + rank + " synthetic sentence.",
  system_id: sys, severity: "moderate", provider_followup_flag: true, provider_followup_urgency: "routine",
  primary_markers: [mk(mid, name, sys)],
  why_this_matters: "WHY synthetic sentence for rank " + rank + ".",
  the_connection: "CONNECTION synthetic sentence.",
  action_layer: { primary_lever: "LEVER synthetic sentence.", supporting_levers: ["SUPPORT one.", "SUPPORT two."],
                  retest_in_months: 3, retest_markers: [mid] },
  trajectory_promise: "PROMISE synthetic sentence.",
});
const base = () => ({
  report_id: "00000000-0000-4000-8000-00000000000a", user_id: "00000000-0000-4000-8000-000000000001",
  panel_date: "2026-08-05", generated_at: "2026-08-06T00:00:00Z",
  vitality: { composite: 74, band: { key: "steady", label: "Steady" }, display: { show_composite: true },
              pills: [{ pill: "heart", score: 70, cover_factor: 0.95 }] },
  longitudinal: null,
  narrative_headline: { verdict: "VERDICT synthetic sentence.", lead: "LEAD synthetic sentence one. Lead two.",
    closing: "CLOSING synthetic sentence.", confounder_note: "NOTE synthetic sentence." },
  systems: [
    { system_id: "iron_status", display_name: "Iron", status: "watch", summary_line: "SUMMARY synthetic sentence.", markers: [mk("ferritin","Ferritin","iron_status")] },
    { system_id: "liver", display_name: "Liver", status: "watch", summary_line: "SUMMARY synthetic two.", markers: [mk("alt","ALT","liver")] },
  ],
  priorities: [prio(1,"iron_status","ferritin","Ferritin"), prio(2,"liver","alt","ALT")],
  foundations: { framing_mode: "pattern", lead: "FLEAD synthetic sentence.",
    levers: [
      { lever: "sleep", display_name: "Sleep", action: "ACTION synthetic sentence.", connection: "CONN synthetic sentence.",
        appears_in_priority_ids: ["p1","p2"], measured_signal: "SIGNAL synthetic sentence." },
      { lever: "movement", display_name: "Movement", action: "ACTION two.", connection: "CONN two.",
        appears_in_priority_ids: [], measured_signal: null },
    ], closing: "FCLOSING synthetic sentence." },
  quietly_working: [
    { finding: "FINDING one synthetic.", markers: ["hdl"], implication: "IMPL one synthetic." },
    { finding: "FINDING two synthetic.", markers: ["alb"], implication: "IMPL two synthetic." },
  ],
  cluster_patterns: [{ pattern_id: "x", pattern_name: "PATTERN name.", priority_ids: ["p1"],
    explanation: "EXPL synthetic.", sequencing_advice: "SEQ synthetic." }],
  provider_discussion_points: [{ point: "Is my ferritin result worth looking into further?", supporting_markers: ["ferritin"], urgency: "routine" }],
  coverage_gap: null,
});
// EXACTLY what PROSE_GUARD_V1 can leave: "" for a string, elements removed, arrays at length 0.
// Never a null and never a deleted key -- the guard writes an empty string, and a fixture that
// deleted the key would be testing a shape the worker cannot produce.
const blanked = () => {
  const p = base();
  p.narrative_headline = { verdict: "", lead: "", closing: "", confounder_note: "" };
  p.systems.forEach(s => s.summary_line = "");
  p.priorities.forEach(x => { x.headline = ""; x.why_this_matters = ""; x.the_connection = "";
    x.trajectory_promise = ""; x.action_layer.primary_lever = ""; x.action_layer.supporting_levers = []; });
  p.foundations.lead = ""; p.foundations.closing = "";
  p.foundations.levers.forEach(l => { l.action = ""; l.connection = ""; l.measured_signal = ""; });
  p.quietly_working.forEach(q => { q.finding = ""; q.implication = ""; });
  p.cluster_patterns = []; p.provider_discussion_points = [];
  return p;
};
// ONE finding survives. Fix 2 hands the section's closing-line duty to the first RENDERED card,
// which only means something when the surviving card is not the first in the payload.
const secondOnly = () => { const p = blanked(); p.quietly_working[1].finding = "SURVIVOR synthetic."; return p; };

// ── the mutants: each reverts ONE fix, and each is valid JS ──────────────────
const MUTANTS = {
  fix1: [[`  if(qwSaid.length){
    const more = qw.length>1 ? (" "+(qw.length-1)+" more system"+(qw.length-1===1?" is":"s are")+" quietly steady too.") : "";
    qwHtml = '<ul class="report-bullets"><li>'+reportProse(qwSaid[0].finding)+more+'</li></ul>';
  } else if(!qw.length && !pr.length`,
              `  if(qw.length){
    const more = qw.length>1 ? (" "+(qw.length-1)+" more system"+(qw.length-1===1?" is":"s are")+" quietly steady too.") : "";
    qwHtml = '<ul class="report-bullets"><li>'+reportProse(qw[0].finding || "MUTANT STAND IN SENTENCE.")+more+'</li></ul>';
  } else if(!pr.length`]],
  fix2: [[`  const q = dropSuppressedQW(Array.isArray(p.quietly_working)?p.quietly_working:[], p)
    .filter(x => x && typeof x.finding === "string" && x.finding.trim() !== "");`,
           `  const q = dropSuppressedQW(Array.isArray(p.quietly_working)?p.quietly_working:[], p);`]],
  fix3: [[`'<span class="prio-title">'+esc(priorityTitle(x, i))+'</span></div>'+`,
           `'<span class="prio-title">'+esc(x.headline||"")+'</span></div>'+`]],
  fix4: [[`    .filter(lv => lv && (foundPipe(lv.action || "") || foundPipe(lv.connection || "")));`,
           `    .filter(lv => !!lv);`]],
  fix5: [[`  sanaMountChat();
  // THE NO-LEAD RETURN IS GONE.`,
           `  // THE NO-LEAD RETURN IS GONE.`],
          [`  const CLOSING = "This is a small preview.`,
           `  const nhMut = p && p.narrative_headline;
  if(!(nhMut && typeof nhMut.lead === "string" && nhMut.lead.trim())) return;
  const CLOSING = "This is a small preview.`]],
};

// ── plumbing ────────────────────────────────────────────────────────────────
const work = readFileSync(FILE, "utf8");
let before = null;
try { before = execSync("git show " + BEFORE_REF + ":dashboard.html", { maxBuffer: 1 << 28 }).toString(); }
catch (e) { console.log("  FAIL EP-0b: could not read " + BEFORE_REF + ":dashboard.html -- " + e.message); fail++; }

function mutate(name) {
  let s = work;
  for (const [from, to] of MUTANTS[name]) {
    if (s.indexOf(from) === -1) return null;      // anchor gone -> caller reports it, never a silent pass
    s = s.replace(from, to);
  }
  return s;
}

let serveHtml = work, currentDriver = "";
const server = createServer((req, res) => {
  if (req.url.startsWith("/page")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(serveHtml.replace(CDN, STUB).replace("</body>", currentDriver + "</body>")); return;
  }
  res.writeHead(404); res.end("no");
});
await new Promise(r => server.listen(PORT, r));

const driver = (payload) => `<script>
(async () => {
  await new Promise(r => setTimeout(r, 350));
  window.__rdSeries = {}; window.__allReports = [{ id: "r1", collected_on: "2026-08-05" }];
  window.__doneReportIds = new Set(["r1"]);
  const P = ${JSON.stringify(payload)};
  const res = { threw: false, errs: [] };
  try { window.showView("dashboard"); await window.renderDashboard(P, "r1"); }
  catch (err) { res.threw = true; res.message = err.message; }
  const N = (s) => document.querySelectorAll(s).length;
  const LENS = (s) => [...document.querySelectorAll(s)].map(e => e.textContent.trim().length);
  const HID = (id) => { const e = document.getElementById(id); return e ? e.classList.contains("hidden") : "NO ELEMENT"; };
  const parse = (h) => { const d = document.createElement("div"); d.innerHTML = h; return d; };

  res.quietCards = N("#quiet .quiet");
  res.quietTitleLens = LENS("#quiet .quiet-title");
  res.quietCardLens = LENS("#quiet .quiet");
  res.quietFoot = N("#quiet .quiet-foot");
  res.quietWrapHidden = HID("quiet-wrap");
  res.prioTitleLens = LENS("#prios .prio-title");
  res.levers = N("#found-levers .lever");
  res.leverNames = [...document.querySelectorAll("#found-levers .lever-name")].map(e => e.textContent.trim());
  res.leverToggles = N("#found-levers .lever-toggle");
  res.leverDetailKids = [...document.querySelectorAll("#found-levers .lever-detail")].map(d => [...d.children].map(c => c.className));
  res.foundWrapHidden = HID("foundations-wrap");
  res.sanaMounted = (typeof SANA_MOUNTED !== "undefined") ? SANA_MOUNTED : "undefined";
  res.sanaThread = !!document.getElementById("sana-thread");
  res.chips = N("#comp-chips .comp-chip");

  try {
    const rep = parse(window.reportDocHtml(P));
    res.reportBullets = rep.querySelectorAll(".report-bullets li").length;
    res.reportBulletLens = [...rep.querySelectorAll(".report-bullets li")].map(e => e.textContent.trim().length);
    res.reportBulletText = [...rep.querySelectorAll(".report-bullets li")].map(e => e.textContent.trim().slice(0, 40));
    res.reportHeads = [...rep.querySelectorAll(".report-item-h span")].map(e => e.textContent.trim());
    res.reportHtml = window.reportDocHtml(P);
  } catch (e) { res.reportThrew = e.message; }
  try { res.doctorHtml = window.doctorDocHtml(P); } catch (e) { res.doctorThrew = e.message; }
  try {
    window.buildDeck(P, "r1", false);
    const deck = document.getElementById("rd-deck");
    res.deckHtml = deck ? deck.innerHTML : "";
    res.deckQcards = deck ? deck.querySelectorAll(".qcard").length : 0;
    res.deckQcardLens = deck ? [...deck.querySelectorAll(".qcard p")].map(e => e.textContent.trim().length) : [];
    res.deckB3Head = deck ? [...deck.querySelectorAll("h1.display.h-md")].map(e => e.textContent.trim()) : [];
    res.deckPh = deck ? [...deck.querySelectorAll(".prio-card .ph")].map(e => e.textContent.trim()) : [];
  } catch (e) { res.deckThrew = e.message; }
  const dash = document.getElementById("view-dashboard");
  res.dashHtml = dash ? dash.innerHTML : "";
  res.errs = window.__errs;
  window.__result = res; window.__done = true;
})();
<\/script>`;

const profile = "/tmp/empty-prose-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1),
  "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL EP-0c: Chrome never opened a debugging port"); fail++; server.close(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);

async function run(html, payload) {
  serveHtml = html; currentDriver = driver(payload);
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 40; i++) { await sleep(250);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) return JSON.parse(v.result.value); }
  return null;
}
const md5 = (s) => createHash("md5").update(String(s)).digest("hex");

// ── the runs ────────────────────────────────────────────────────────────────
const CTL = await run(work, base());
const BLK = await run(work, blanked());
const SEC = await run(work, secondOnly());
if (!CTL || !BLK || !SEC) { console.log("  FAIL EP-1: a run never finished; the harness itself is broken"); fail++; done(1); }
ok(!CTL.threw && !BLK.threw, "EP-1: renderDashboard threw on neither payload");
eq(CTL.errs.length + BLK.errs.length, 0, "EP-1b: and no uncaught window error on either");

console.log("\nFIX 1 -- the health report stops inventing a reassurance");
ok(CTL.reportBullets >= 1 && CTL.reportBulletLens[0] > 0,
   "EP-2 CONTROL: with findings populated the snapshot bullet renders text  (" + CTL.reportBulletLens[0] + " chars)");
eq(BLK.reportBullets, 0, "EP-3: with every finding emptied there is NO snapshot bullet at all");
ok(SEC.reportBullets === 1 && SEC.reportBulletText[0].indexOf("SURVIVOR") === 0,
   "EP-4: with one finding surviving, THAT one is the bullet  (" + JSON.stringify(SEC.reportBulletText[0]) + ")");

console.log("\nFIX 2 -- a going-right card with no title is not rendered");
eq(CTL.quietCards, 2, "EP-5 CONTROL: both cards render when populated");
ok(CTL.quietTitleLens.every(n => n > 0), "EP-5b CONTROL: and each carries a title  (" + JSON.stringify(CTL.quietTitleLens) + ")");
eq(BLK.quietCards, 0, "EP-6: with every finding emptied, zero cards render");
eq(BLK.quietWrapHidden, true, "EP-6b: and the section hides, as it already does for zero entries");
eq(SEC.quietCards, 1, "EP-7: the one surviving entry renders one card");
eq(SEC.quietFoot, 1, "EP-7b: and IT carries the section's closing line, so the duty followed the render");

console.log("\nFIX 3 -- a priority still has a title when the headline was guarded away");
ok(CTL.prioTitleLens.every(n => n > 0), "EP-8 CONTROL: populated titles render  (" + JSON.stringify(CTL.prioTitleLens) + ")");
ok(BLK.prioTitleLens.length === 2 && BLK.prioTitleLens.every(n => n > 0),
   "EP-9: blanked, every card still has a non-empty title  (" + JSON.stringify(BLK.prioTitleLens) + ")");
ok(CTL.reportHeads.some(t => t.indexOf("HEADLINE_") === 0),
   "EP-10 CONTROL: the report card head is the model's headline when populated");
ok(BLK.reportHeads.some(t => t === "Ferritin") && BLK.reportHeads.some(t => t === "ALT"),
   "EP-11: blanked, the report head is the primary marker's name  (" + JSON.stringify(BLK.reportHeads.slice(0, 4)) + ")");
ok(BLK.deckB3Head.length === 1 && BLK.deckB3Head[0].length > 0,
   "EP-12: and the deck's beat 3 headline is not empty either  (" + JSON.stringify(BLK.deckB3Head) + ")");
ok(BLK.deckPh.every(t => t.length > 0), "EP-12b: nor any deck priority row  (" + JSON.stringify(BLK.deckPh) + ")");

console.log("\nFIX 4 -- a lever with nothing to say is skipped, and relates alone earns no toggle");
eq(CTL.levers, 2, "EP-13 CONTROL: both levers render when populated");
eq(CTL.leverToggles, 2, "EP-13b CONTROL: and both carry a disclosure");
eq(BLK.levers, 0, "EP-14: blanked, no lever renders");
eq(BLK.foundWrapHidden, true, "EP-14b: and with no lead either, the section hides");
ok(!CTL.leverDetailKids.some(k => k.length === 1 && k[0] === "lever-relates"),
   "EP-15: no disclosure anywhere opens onto a cross-reference alone");

console.log("\nFIX 5 -- the Sana chat no longer rides on a narrative line");
eq(CTL.sanaMounted, true, "EP-16 CONTROL: the chat mounts on a populated payload");
eq(CTL.sanaThread, true, "EP-16b CONTROL: and sana-thread exists");
eq(BLK.sanaMounted, true, "EP-17: it mounts on a fully blanked payload too");
eq(BLK.sanaThread, true, "EP-17b: and sana-thread exists there as well");
ok(BLK.chips >= 3, "EP-18: the chips that read no model prose still render  (" + BLK.chips + ")");

// ── the mutants ─────────────────────────────────────────────────────────────
console.log("\nMUTANTS -- each reverts ONE fix; the matching assertion above must go red");
const M = {};
for (const name of Object.keys(MUTANTS)) {
  const src = mutate(name);
  ok(src !== null, "EP-19." + name + ": the anchor was LOCATED, so the mutant is a real change");
  if (src === null) continue;
  ok(src.length !== work.length || src !== work, "EP-19b." + name + ": and it differs from the shipped file");
  M[name] = await run(src, name === "fix1" ? blanked() : blanked());
  ok(!!M[name], "EP-19c." + name + ": the mutant page finished");
}
if (M.fix1) ok(M.fix1.reportBullets === 1 && M.fix1.reportBulletText[0].indexOf("MUTANT STAND IN") === 0,
  "EP-20: fix1 reverted -> the stand-in sentence is back, so EP-3 can fail  (" + M.fix1.reportBullets + " bullet)");
if (M.fix2) ok(M.fix2.quietCards === 2 && M.fix2.quietTitleLens.every(n => n === 0),
  "EP-21: fix2 reverted -> two title-less cards render, so EP-6 can fail  (" + JSON.stringify(M.fix2.quietTitleLens) + ")");
if (M.fix3) ok(M.fix3.prioTitleLens.length === 2 && M.fix3.prioTitleLens.every(n => n === 0),
  "EP-22: fix3 reverted -> the dashboard titles are empty again, so EP-9 can fail  (" + JSON.stringify(M.fix3.prioTitleLens) + ")");
if (M.fix4) ok(M.fix4.levers === 2 && M.fix4.leverToggles < 2,
  "EP-23: fix4 reverted -> bare-name levers render again, so EP-14 can fail  (" + M.fix4.levers + " levers, " + M.fix4.leverToggles + " toggles)");
if (M.fix5) ok(M.fix5.sanaMounted !== true && M.fix5.sanaThread === false,
  "EP-24: fix5 reverted -> the chat is not mounted, so EP-17 can fail  (mounted " + JSON.stringify(M.fix5.sanaMounted) + ")");

// ── the whole-page check ────────────────────────────────────────────────────
console.log("\nWHOLE PAGE -- a populated payload must render byte-identically to the build before these fixes");
if (before === null) { ok(false, "EP-25: the BEFORE build was not available"); }
else {
  const B = await run(before, base());
  ok(!!B && !B.threw, "EP-25 CONTROL: the BEFORE build rendered the same payload without throwing");
  if (B) {
    // THE DOCTOR SUMMARY LEFT THIS LIST ON 2026-09-23, deliberately, and it is not a weakening.
    // This block asks whether the EMPTY-PROSE fixes changed a populated render. Three commits
    // later that document was reordered on purpose ("What I take and what I have noticed" moved
    // above "Questions for today") and gained a question floor, so a byte comparison against
    // BEFORE_REF now measures TWO change sets and can only ever be red. The guarantee did not go
    // away, it moved: test-doctor-summary.mjs DS-28 pins its questions section byte-identical
    // against that document's OWN baseline, and WANT_HEADINGS pins the new section order. A
    // surface removed from a comparison has to name what covers it instead, or this is how a
    // test quietly stops asserting anything.
    const surfaces = [["dashboard", "dashHtml"], ["health report", "reportHtml"],
                      ["reveal deck", "deckHtml"]];
    for (const [label, key] of surfaces) {
      const a = md5(B[key] || ""), b = md5(CTL[key] || "");
      ok((B[key] || "").length > 0, "EP-26." + label + " CONTROL: the BEFORE surface is non-empty  (" + (B[key] || "").length + " chars)");
      ok(a === b, "EP-27." + label + ": byte-identical before and after  (" + a.slice(0, 12) + " vs " + b.slice(0, 12) + ")");
    }
    // And the BLANKED payload must NOT be identical, or EP-27 is comparing a renderer that
    // ignores the payload rather than one these fixes left alone.
    const BB = await run(before, blanked());
    if (BB) ok(md5(BB.dashHtml || "") !== md5(BLK.dashHtml || ""),
      "EP-28 CONTROL: on the BLANKED payload the two builds DIFFER, so EP-27 is a real match");
  }
}

if (process.env.SHOT) {
  serveHtml = work; currentDriver = driver(blanked());
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  await sleep(2500);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, sessionId);
  writeFileSync("/tmp/empty-prose-blanked.png", Buffer.from(shot.data, "base64"));
  console.log("       screenshot /tmp/empty-prose-blanked.png");
}

ws.close(); chrome.kill(); server.close();
done(fail ? 1 : 0);
