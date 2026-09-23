#!/usr/bin/env node
// DOCTOR_SUMMARY_TEST_V1 -- runs the REAL dashboard.html in a real browser and calls the page's own
// openDoctor() on a SYNTHETIC payload. Every value here is invented; no real panel, name or id.
//
// WHY A BROWSER AND NOT A SOURCE SCAN. Four of the seven claims below cannot be made from source
// text at all: whether the range cell holds a number depends on a JSON file fetched at runtime,
// whether an unticked question prints depends on a :has() rule resolving under print media, and
// whether the footer reaches paper depends on a computed style in a media the page is not in.
// A regex over dashboard.html would have reported all four green while the page was wrong.
//
// EVERY ABSENCE CLAIM CARRIES A CONTROL that can fire in the same run:
//   "not ranged" has a marker that IS in ranges-slim and must show a number.
//   the dropped points have a clean point that must survive.
//   the hidden question has a ticked sibling that must stay visible.
//   the mutant run re-checks the guard with the guard removed and must go RED.
//
//   node scripts/test-doctor-summary.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn, execSync } from "node:child_process";
import { extractApp } from "./lib/extract-app.mjs";
import { createHash } from "node:crypto";

const FILE = process.env.DASH || "dashboard.html";
const RANGES = "ranges-slim.json";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 8900 + Math.floor(Math.random() * 400);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };

if (!existsSync(CHROME)) { console.log("  FAIL DS-0: Chrome is not at " + CHROME); fail++; done(1); }
if (!existsSync(RANGES)) { console.log("  FAIL DS-0: " + RANGES + " is not in the repo, so the range column cannot be checked"); fail++; done(1); }

// ── The synthetic payload. Invented markers, invented numbers. ───────────────────────────────
// ferritin IS in ranges-slim (control: its cell must hold a digit).
// zz_not_a_real_marker is NOT (assertion: its cell must be "not ranged" and hold no digit).
// lead is a SAFETY CLASS marker (assertion: never a range, never a green word).
const mk = (id, name, sys, v, unit, status, band, canonical) =>
  ({ marker_id: id, display_name: name, system_id: sys, value: v, unit,
     canonical_unit: canonical === undefined ? unit : canonical,
     normalized_value: v, status, band, is_cycle_gated: false });
const PAYLOAD = {
  panel_date: "2026-04-01",
  lab_name: "Synthetic Diagnostics",
  vitality: { composite: 70, band: { key: "steady", label: "Steady" }, display: { show_composite: true },
              deferred: ["sex_hormones"], deferred_reasons: { sex_hormones: "cycle_day_unknown" } },
  longitudinal: null,
  internal_metadata: { cycle_day_at_interpretation: null },
  systems: [
    { system_id: "iron_status", display_name: "Iron", status: "watch", markers: [
      mk("ferritin", "Ferritin", "iron_status", 11, "ng/mL", "flag", "deficient"),
      mk("zz_not_a_real_marker", "Invented Marker", "iron_status", 42, "mg/dL", "watch", "suboptimal_low"),
    ]},
    { system_id: "heavy_metals", display_name: "Heavy Metals", status: "normal", markers: [
      mk("lead", "Lead", "heavy_metals", 1, "ug/dL", "optimal", "optimal"),
    ]},
    { system_id: "sex_hormones", display_name: "Sex hormones", status: "not_scored", markers: [
      Object.assign(mk("progesterone", "Progesterone", "sex_hormones", 1, "ng/mL", "cycle_gated", null), { is_cycle_gated: true }),
    ]},
    // homocysteine is a PRIORITY marker and carries the micro-sign mismatch FIX 4 folds:
    // the lab printed "\u00b5mol/L", the library's canonical spelling is "umol/L".
    { system_id: "vitamins", display_name: "Vitamins", status: "watch", markers: [
      mk("homocysteine", "Homocysteine", "vitamins", 12, "\u00b5mol/L", "watch", "suboptimal_high", "umol/L"),
    ]},
    // tsh is measured and is NOT a priority, so a question naming it must be dropped.
    { system_id: "thyroid", display_name: "Thyroid", status: "normal", markers: [
      mk("tsh", "TSH", "thyroid", 2, "mIU/L", "normal", "optimal"),
    ]},
  ],
  priorities: [
    { rank: 1, priority_id: "p1", system_id: "iron_status", severity: "moderate",
      headline: "Iron stores are running low", why_this_matters: "Your stores sit under the functional floor. A second sentence that must not appear.",
      the_connection: "c", provider_followup_urgency: "prompt",
      primary_markers: [{ marker_id: "ferritin", display_name: "Ferritin", band: "deficient", position: "low", flag_status: "user_facing" },
                        { marker_id: "zz_not_a_real_marker", display_name: "Invented Marker", band: "suboptimal_low", position: "low", flag_status: "user_facing" }],
      action_layer: { primary_lever: "lever", retest_markers: ["ferritin"], retest_in_months: 3 } },
    { rank: 2, priority_id: "p2", system_id: "heavy_metals", severity: "low",
      headline: "One metal was measured", why_this_matters: "This was measured and read.",
      the_connection: "c", provider_followup_urgency: "routine",
      primary_markers: [{ marker_id: "lead", display_name: "Lead", band: "optimal", position: "optimal", flag_status: "none" }],
      action_layer: { primary_lever: "lever" } },
    { rank: 3, priority_id: "p3", system_id: "vitamins", severity: "moderate",
      headline: "One B vitamin marker is running high", why_this_matters: "This is the row FIX 4 is measured on.",
      the_connection: "c", provider_followup_urgency: "routine",
      primary_markers: [{ marker_id: "homocysteine", display_name: "Homocysteine", band: "suboptimal_high", position: "high", flag_status: "user_facing" }],
      action_layer: { primary_lever: "lever" } },
  ],
  // FIVE planted points the guard MUST drop, and ONE it must keep. The keeper names only
  // ferritin, which IS one of her priorities, so it survives the marker rule too.
  provider_discussion_points: [
    { point: "Is my ferritin worth looking into further, given how I have been feeling?", supporting_markers: ["ferritin"], urgency: "prompt" },
    { point: "This is commonly seen and so should be dropped by the guard.", supporting_markers: ["ferritin"], urgency: "routine" },
    { point: "Can you order something for my ferritin?", supporting_markers: ["ferritin"], urgency: "routine" },
    { point: "Should I request another look at my ferritin?", supporting_markers: ["ferritin"], urgency: "routine" },
    { point: "Is my ferritin \u2013 in your view \u2013 worth a closer look?", supporting_markers: ["ferritin"], urgency: "routine" },
    { point: "Is my TSH worth looking into further?", supporting_markers: ["tsh"], urgency: "routine" },
  ],
  quietly_working: [], coverage_gap: null,
};
// RE-POINTED 2026-09-23 with the section swap. "What I take and what I have noticed" now sits
// DIRECTLY ABOVE "Questions for today"; the pin follows the order rather than being relaxed, so a
// future accidental swap still goes red.
const WANT_HEADINGS = ["Reason for this visit", "Findings to discuss",
                       "What I take and what I have noticed", "Questions for today",
                       "Read with these in mind"];

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

const driverFor = (payload) => `<script>
(async () => {
  await new Promise(r => setTimeout(r, 900));
  const res = { threw: false };
  try {
    window.__rdPayload = ${JSON.stringify(payload)};
    window.__rdReport = "rpt"; window.__rdReportConf = {};
    if (window.loadProfile) { try { await window.loadProfile(); } catch (e) {} }
    window.openDoctor();
  } catch (err) { res.threw = true; res.name = err.name; res.message = err.message;
                  res.stack = String(err.stack || "").split("\\n").slice(0, 3).join(" | "); }
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  res.rangesLoaded = (typeof RANGES_LOOKUP !== "undefined") && !!RANGES_LOOKUP;
  res.hasButton = !!q("#btn-doctor");
  res.buttonLabel = q("#btn-doctor") ? q("#btn-doctor").innerText.trim() : null;
  res.viewOpen = !!(q("#doctor-view") && !q("#doctor-view").classList.contains("hidden"));
  res.docChars = q("#doctor-doc") ? q("#doctor-doc").innerHTML.length : 0;
  res.title = q("#doctor-doc .report-doc-title") ? q("#doctor-doc .report-doc-title").innerText.trim() : null;
  res.headings = qa("#doctor-doc .report-sec-h").map(e => e.innerText.trim());
  // Range cells, keyed by the marker name in column 1 of the same row.
  res.cells = qa("#doctor-doc .doc-tbl tbody tr:not(.doc-tbl-note)").map(tr => {
    const td = tr.querySelectorAll("td");
    return { marker: td[0].innerText.trim(), value: td[1].innerText.trim(), unit: td[2].innerText.trim(),
             range: td[3].innerText.trim(), status: td[4].innerText.trim(), prev: td[5].innerText.trim() };
  });
  res.questions = qa("#doctor-doc .doc-q .doc-q-txt").map(e => e.innerText.trim());
  // The MODEL's survivors, separately from what renders. Since DOCTOR_QUESTION_FLOOR_V1 the two
  // differ, and a pin on the rendered count alone can no longer say whether the guard worked.
  res.modelKept = (typeof DOCTOR_LAST_KEPT !== "undefined") ? DOCTOR_LAST_KEPT : null;
  res.modelDropped = (typeof DOCTOR_LAST_DROPPED !== "undefined") ? DOCTOR_LAST_DROPPED : null;
  res.qEmpty = (() => {
    const secs = qa("#doctor-doc .report-sec");
    const qs = secs.find(x => { const h = x.querySelector(".report-sec-h");
      return h && h.innerText.trim() === "Questions for today"; });
    return qs ? qs.querySelectorAll(".doc-empty").length : "NO SECTION";
  })();
  res.qSectionHtml = (() => {
    const secs = qa("#doctor-doc .report-sec");
    const qs = secs.find(x => { const h = x.querySelector(".report-sec-h");
      return h && h.innerText.trim() === "Questions for today"; });
    return qs ? qs.outerHTML : "";
  })();
  res.noteRows = qa("#doctor-doc .doc-tbl-note").map(e => e.innerText.trim());
  res.notRead = qa("#doctor-doc .doc-line").map(e => e.innerText.trim());
  res.rules = qa("#doctor-doc .doc-rule").length;
  res.editable = qa("#doctor-doc .doc-rule[contenteditable='true']").length;
  res.chips = qa("#doctor-doc .report-chip, #doctor-doc .report-tag, #doctor-doc .report-retest-badge").length;
  res.errs = window.__errs;
  window.__result = res; window.__done = true;
})();
<\/script>`;

const html = readFileSync(FILE, "utf8");
if (html.indexOf(CDN) === -1) { console.log("  FAIL DS-0: the Supabase CDN tag was not found in " + FILE); fail++; done(1); }

// THE MUTANT. Valid JavaScript: the guard's first statement is followed by an unconditional
// `return null`, so every point survives. The code still parses, which is the point -- a mutant
// that fails to parse proves nothing about the assertions.
const GUARD_LINE = '  if(typeof text !== "string" || text.trim() === "") return "empty";';
const MUTANT_LINE = GUARD_LINE + ' return null;';
if (html.indexOf(GUARD_LINE) === -1) { console.log("  FAIL DS-0: the guard anchor line was not found, so the mutant cannot be built"); fail++; done(1); }
const mutantHtml = html.replace(GUARD_LINE, MUTANT_LINE);
try { new Function(extractApp(mutantHtml, "the mutant")); }
catch (e) { console.log("  FAIL DS-0: the mutant is not valid JavaScript (" + e.message + ")"); fail++; done(1); }

let SERVE = "";
const server = createServer((req, res) => {
  if (req.url.startsWith("/ranges-slim.json")) {
    res.writeHead(200, { "content-type": "application/json" }); res.end(readFileSync(RANGES)); return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(SERVE);
});
await new Promise(r => server.listen(PORT, r));

const profile = "/private/tmp/doctor-summary-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1),
  "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL DS-0: Chrome never opened a debugging port"); fail++; chrome.kill(); server.close(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
const ev = async (expr) => {
  const v = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
  return v.result ? v.result.value : null;
};
async function run(pageHtml, payload) {
  SERVE = pageHtml.replace(CDN, STUB).replace("</body>", driverFor(payload || PAYLOAD) + "</body>");
  await send("Emulation.setEmulatedMedia", { media: "screen" }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const v = await ev("window.__done ? JSON.stringify(window.__result) : ''");
    if (v) return JSON.parse(v);
  }
  return null;
}

console.log("DOCTOR SUMMARY -- the real page, a synthetic payload");
const r = await run(html, PAYLOAD);
if (!r) { console.log("  FAIL DS-1: the page never finished; the harness itself is broken"); fail++; }
else {
  ok(!r.threw, "DS-1: openDoctor threw nothing" + (r.threw ? "  -> " + r.name + ": " + r.message : ""));
  if (r.threw) console.log("       " + r.stack);
  ok(r.errs.length === 0, "DS-1b: no page errors  (" + JSON.stringify(r.errs) + ")");
  ok(r.rangesLoaded, "DS-1c: ranges-slim.json loaded, so the range column is a real measurement");

  // 1. the button exists
  ok(r.hasButton, "DS-2: the #btn-doctor button exists");
  eq(r.buttonLabel, "Prepare a summary for your doctor", "DS-2b: its label reads as briefed");
  ok(r.viewOpen, "DS-2c: clicking it opens #doctor-view");
  ok(r.docChars > 500, "DS-2d: the document rendered non-empty markup  (" + r.docChars + " chars)");
  eq(r.title, "Summary for your doctor", "DS-2e: the document title");

  // 2. every section heading renders in order
  eq(JSON.stringify(r.headings), JSON.stringify(WANT_HEADINGS), "DS-3: all five section headings, in order");

  // 3. the range column never prints a number for a marker absent from ranges-slim
  const absent = r.cells.find(c => c.marker === "Invented Marker");
  const present = r.cells.find(c => c.marker === "Ferritin");
  const metal = r.cells.find(c => c.marker === "Lead");
  ok(!!absent && !!present && !!metal, "DS-4a: all three planted markers reached the table  (" + r.cells.length + " rows)");
  if (absent) {
    eq(absent.range, "not ranged", "DS-4b: a marker absent from ranges-slim prints 'not ranged'");
    ok(!/\d/.test(absent.range), "DS-4c: and its range cell holds NO digit  (" + JSON.stringify(absent.range) + ")");
  }
  // CONTROL for DS-4c. Without this, DS-4c passes on a page whose range column is broken for
  // every marker, which is exactly the failure a "no digit" assertion cannot see on its own.
  if (present) ok(/\d/.test(present.range), "DS-4d CONTROL: a marker that IS in ranges-slim prints a number");
  if (metal) {
    eq(metal.range, "not ranged", "DS-4e: a safety-class marker never gets a range");
    ok(metal.status !== "Looks good", "DS-4f: and never reads as a healthy result  (" + JSON.stringify(metal.status) + ")");
  }
  ok(r.cells.every(c => c.prev === "-"), "DS-4g: with no prior panel every Previous cell is a dash");
  ok(r.chips === 0, "DS-4h: no chips, tags or badges on this document");

  // FIX 2. The note row is GONE. This assertion replaces DS-4i, which pinned the row's
  // content; a removed row needs an assertion that it is absent, against a control proving
  // the table it sat in still rendered.
  eq(r.noteRows.length, 0, "DS-4i: no why_this_matters note row renders");
  ok(r.cells.length > 0, "DS-4j CONTROL: the table still rendered rows, so DS-4i means something");

  // FIX 4. One row, one spelling of the unit. homocysteine is planted with the lab's
  // "\u00b5mol/L" and the library's "umol/L", which is the exact mismatch the founder found.
  const hcy = r.cells.find(c => c.marker === "Homocysteine");
  ok(!!hcy, "DS-11a: the homocysteine row reached the table");
  if (hcy) {
    ok(hcy.range.endsWith(hcy.unit),
       "DS-11b: the range cell ends with the SAME unit string the value column prints" +
       "  (unit " + JSON.stringify(hcy.unit) + ", range " + JSON.stringify(hcy.range) + ")");
    ok(/\d/.test(hcy.range), "DS-11c CONTROL: that range cell holds a number, so DS-11b is not comparing two blanks");
  }
  // CONTROL for the fold's NARROWNESS. lead is planted with matching units, so it must be
  // untouched; a fold that rewrote every cell would still pass DS-11b on its own.
  const leadRow = r.cells.find(c => c.marker === "Lead");
  if (leadRow) ok(leadRow.range === "not ranged",
    "DS-11d CONTROL: a safety-class row is still 'not ranged', so the fold did not rewrite every cell");

  // 4. the guard drops every planted point and keeps the one clean question.
  const joined = r.questions.join(" || ");
  ok(!/\bcommonly\b/i.test(joined), "DS-5a: the planted 'commonly' point was dropped");
  ok(!/\border\b/i.test(joined), "DS-5b: the planted 'order' point was dropped");
  // FIX 1, the widened word list.
  ok(!/\brequest\b/i.test(joined), "DS-5e: the planted 'request' point was dropped");
  // FIX 1, the en dash.
  ok(joined.indexOf("\u2013") === -1, "DS-5f: the planted en-dash point was dropped");
  // FIX 1, a marker she has no priority for. tsh IS measured on this panel and is NOT one of
  // her priorities, so the point naming it goes.
  ok(!/\bTSH\b/i.test(joined), "DS-5g: the planted point naming a non-priority marker was dropped");
  // CONTROL: a clean point must survive, or every assertion above would pass on an empty list.
  // RE-POINTED with the floor. ONE model point survives, which is what DS-5a..DS-5g are about;
  // the section renders THREE because the floor tops it up. Pinning the rendered count here would
  // now be pinning the floor, and the guard's own result would stop being asserted at all.
  eq(r.modelKept, 1, "DS-5c CONTROL: exactly the one clean MODEL point survived the guard");
  eq(r.questions.length, 3, "DS-5c2: and the section renders three, the floor having topped it up");
  ok(joined.indexOf("worth looking into further") !== -1, "DS-5d CONTROL: and it is the clean one");
  ok(/\bferritin\b/i.test(joined),
     "DS-5h CONTROL: the surviving question DOES name a marker, so DS-5g is not passing because every marker name is dropped");

  // 5. section 5 renders three editable lines plus the reason line
  eq(r.rules, 4, "DS-6: four editable rules  (reason, medications, supplements, noticed)");
  eq(r.editable, 4, "DS-6b: and every one of them is contenteditable");

  // 6. FIX 3. The section is "Read with these in mind" and carries ONLY what changes how a
  // result reads. Every system-level "not read" line is gone; DS-7a used to pin one.
  ok(r.notRead.some(l => l === "Hormone results are held until phase-specific ranges have been reviewed."),
     "DS-7b: a cycle-gated marker adds the hormone line");
  ok(!r.notRead.some(l => /not scored|Sex hormones\./i.test(l)),
     "DS-7a: no system-level 'not read' line survives  (" + JSON.stringify(r.notRead) + ")");
  // FIX 3. This payload carries NO glucose, insulin or triglyceride marker, so no fasting
  // line may render even though fasting is not recorded.
  ok(!r.notRead.some(l => /Fasting was/.test(l)),
     "DS-7c: a payload with no fasting-sensitive markers renders no fasting line");
  ok(r.notRead.length > 0, "DS-7d CONTROL: the section rendered at least one line, so DS-7a and DS-7c mean something");
}

// ── Print-media assertions. These cannot be made from source text. ─────────────────────────────
await send("Emulation.setEmulatedMedia", { media: "print" }, sessionId);
await sleep(200);
// 5 (continued). unticked questions are absent from print markup.
const printQ = await ev(`(() => {
  const rows = [...document.querySelectorAll("#doctor-doc .doc-q")];
  if (!rows.length) return JSON.stringify({ error: "no question rows to test" });
  const box = rows[0].querySelector(".doc-q-box");
  const tickedDisplay = getComputedStyle(rows[0]).display;
  box.checked = false;
  const untickedDisplay = getComputedStyle(rows[0]).display;
  box.checked = true;
  return JSON.stringify({ tickedDisplay, untickedDisplay });
})()`);
{
  const p = JSON.parse(printQ);
  ok(!p.error, "DS-8a: there is a question row to untick  (" + printQ + ")");
  if (!p.error) {
    ok(p.untickedDisplay === "none", "DS-8b: an UNTICKED question does not print  (display " + p.untickedDisplay + ")");
    // CONTROL: if both were none, DS-8b would pass on a document that prints no questions at all.
    ok(p.tickedDisplay !== "none", "DS-8c CONTROL: a TICKED question does print  (display " + p.tickedDisplay + ")");
  }
}
// 6. the footer is visible in print for BOTH documents.
const foot = await ev(`(() => {
  const out = {};
  const dv = document.getElementById("doctor-view"), rv = document.getElementById("report-view");
  out.doctorOpen = !dv.classList.contains("hidden");
  out.doctorFooter = getComputedStyle(dv.querySelector(".report-print-footer")).display;
  out.doctorFooterText = dv.querySelector(".report-print-footer").textContent.trim().slice(0, 40);
  out.closedFooter = getComputedStyle(rv.querySelector(".report-print-footer")).display;
  dv.classList.add("hidden"); rv.classList.remove("hidden");
  out.reportFooter = getComputedStyle(rv.querySelector(".report-print-footer")).display;
  rv.classList.add("hidden"); dv.classList.remove("hidden");
  return JSON.stringify(out);
})()`);
{
  const f = JSON.parse(foot);
  ok(f.doctorFooter === "block", "DS-9a: the doctor summary's footer PRINTS  (display " + f.doctorFooter + ")");
  ok(f.reportFooter === "block", "DS-9b: the health report's footer PRINTS too  (display " + f.reportFooter + ")");
  // CONTROL: a closed document's footer must stay hidden, or DS-9a/b prove only that the rule is unscoped.
  ok(f.closedFooter === "none", "DS-9c CONTROL: a CLOSED document's footer stays hidden  (display " + f.closedFooter + ")");
  ok(f.doctorFooterText.indexOf("Functional ranges") === 0, "DS-9d: and it is the summary's own sentence");
}

// ── FIX 3, the other half. A payload that DOES carry a fasting-sensitive marker must render
// the fasting line. Without this run DS-7c is an absence with nothing behind it: it would pass
// just as happily on a build where the fasting line can never render at all.
console.log("\nFASTING FIXTURE -- same page, a payload carrying fasting-sensitive markers");
const FASTING_PAYLOAD = JSON.parse(JSON.stringify(PAYLOAD));
FASTING_PAYLOAD.systems.push({
  system_id: "metabolic", display_name: "Metabolic", status: "watch",
  markers: [
    { marker_id: "fasting_glucose", display_name: "Fasting Glucose", system_id: "metabolic",
      value: 95, unit: "mg/dL", canonical_unit: "mg/dL", normalized_value: 95,
      status: "normal", band: "optimal", is_cycle_gated: false },
  ],
});
const fx = await run(html, FASTING_PAYLOAD);
if (!fx) { console.log("  FAIL DS-12: the fasting fixture never finished"); fail++; }
else {
  ok(!fx.threw, "DS-12: openDoctor threw nothing on the fasting fixture");
  const line = fx.notRead.find(l => /^Fasting was /.test(l));
  ok(!!line, "DS-12a CONTROL: with a fasting-sensitive marker present, the fasting line DOES render");
  if (line) {
    eq(line, "Fasting was not recorded for this draw, so glucose, insulin and triglyceride results are read with that in mind.",
       "DS-12b: and it reads exactly as briefed");
    ok(!/lipid/i.test(line), "DS-12c: it never says lipids, because ApoA1 and ApoB do not depend on fasting");
  }
  ok(fx.headings[fx.headings.length - 1] === "Read with these in mind",
     "DS-12d: the section heading reads 'Read with these in mind'");
}

// ── The mutant. The guard is removed; DS-5a/DS-5b must go RED. ─────────────────────────────────
console.log("\nMUTANT -- doctorPointBlocked always returns null");
const m = await run(mutantHtml, PAYLOAD);
if (!m) { console.log("  FAIL DS-10: the mutant page never finished"); fail++; }
else {
  const mj = m.questions.join(" || ");
  const caught = /\bcommonly\b/i.test(mj) || /\border\b/i.test(mj);
  ok(caught, "DS-10: removing the guard lets a banned point through, so DS-5a/DS-5b can fail  (" +
     m.questions.length + " points rendered, was 1)");
  ok(m.questions.length === PAYLOAD.provider_discussion_points.length,
     "DS-10b: and EVERY planted point renders once the guard is gone  (got " + m.questions.length +
     " of " + PAYLOAD.provider_discussion_points.length + ")");
}
console.log("\nDIAGNOSIS SHAPES -- each dropped, each with a kept control");
{
  // RE-RENDER THE CLEAN PAGE FIRST. Every probe here runs against whatever run() last served, and
  // that is not always this build: in the commit that shipped these rules alone, the previous
  // run() was the GUARD-REMOVED mutant, so all six shape checks read null and went red against a
  // correct file. The probe has to say which page it is asking.
  await run(html, PAYLOAD);
  const shapes = `(() => {
    const P = window.__rdPayload;
    const vocab = doctorBuildMarkerVocab(P);
    const ids = new Set(["ferritin"]);
    const b = (t) => doctorPointBlocked(t, ids, vocab);
    return JSON.stringify({
      couldIHave:   b("Could I have something going on with my ferritin?"),
      doIHave:      b("Do I have a problem with my ferritin?"),
      isThisSign:   b("Is this a sign of something with my ferritin?"),
      couldBeSign:  b("Could this be a sign that my ferritin matters?"),
      signOf:       b("Are these a sign of anything for my ferritin?"),
      signsOf:      b("Are these signs of anything for my ferritin?"),
      keptCouldMy:  b("Could my ferritin be part of the same picture?"),
      keptDoMy:     b("Do my ferritin results fit together?"),
      keptDesign:   b("Does the design of this panel cover my ferritin?"),
      keptSignal:   b("Is my ferritin reading a signal worth watching?"),
    });
  })()`;
  const d = JSON.parse(await ev(shapes));
  eq(d.couldIHave,  "shape_could_i_have",         "DS-21: could i have is dropped");
  eq(d.doIHave,     "shape_do_i_have",            "DS-22: do i have is dropped");
  eq(d.isThisSign,  "shape_is_this_a_sign_of",    "DS-23: is this a sign of is dropped, with its own code");
  eq(d.couldBeSign, "shape_could_this_be_a_sign", "DS-24: could this be a sign is dropped");
  eq(d.signOf,      "shape_sign_of",              "DS-25: a bare sign of is dropped");
  eq(d.signsOf,     "shape_sign_of",              "DS-25b: and its plural");
  eq(d.keptCouldMy, null, "DS-26 CONTROL: could my is KEPT");
  eq(d.keptDoMy,    null, "DS-26b CONTROL: do my is KEPT");
  eq(d.keptDesign,  null, "DS-26c CONTROL: design of is KEPT, so the boundary is real");
  eq(d.keptSignal,  null, "DS-26d CONTROL: a bare signal is KEPT");
}

console.log("\nMUTANTS -- one per fix, each valid JavaScript, each turning its own pin red");
{
  const MUT = {
    fix1: [["  for(const sh of DOCTOR_BANNED_SHAPES) if(sh.re.test(text)) return sh.code;\n", ""]],
  };
  for (const name of Object.keys(MUT)) {
    let src = html, located = true;
    for (const [from, to] of MUT[name]) {
      if (src.indexOf(from) === -1) { located = false; break; }
      src = src.replace(from, to);
    }
    ok(located, "DS-29." + name + ": the mutant anchor was LOCATED, so it is a real change");
    if (!located) continue;
    try { new Function(extractApp(src, "mutant " + name)); }
    catch (e) { ok(false, "DS-29b." + name + ": the mutant is valid JavaScript (" + e.message + ")"); continue; }
    ok(true, "DS-29b." + name + ": the mutant parses, so its result means something");
    const mr = await run(src, name === "fix1" ? PAYLOAD : withPoints(0));
    if (!mr) { ok(false, "DS-30." + name + ": the mutant page never finished"); continue; }
    if (name === "fix1") {
      const g = JSON.parse(await ev(`(() => {
        const vocab = doctorBuildMarkerVocab(window.__rdPayload);
        return JSON.stringify(doctorPointBlocked("Could I have something with my ferritin?", new Set(["ferritin"]), vocab));
      })()`));
      eq(g, null, "DS-30.fix1: without the shapes loop a diagnosis question passes, so DS-21 can fail");
    }
    if (name === "fix2") {
      eq(mr.questions.length, 0, "DS-30.fix2: without the floor the section renders nothing, so DS-12.0 can fail");
      eq(mr.qEmpty, 1, "DS-30b.fix2: and the empty state comes back");
    }
    if (name === "fix3") {
      ok(JSON.stringify(mr.headings) !== JSON.stringify(WANT_HEADINGS),
         "DS-30.fix3: the old order fails the heading pin, so DS-3 can fail  (" + JSON.stringify(mr.headings) + ")");
    }
  }
}
// ═══════════════════════════════════════════════════════════════════════════════════════════
// DOCTOR_QUESTION_FLOOR_V1 + the diagnosis shapes + the section swap.
//
// WHY THE FLOOR IS TESTED BY COUNT AND BY GUARD. She prints this page. The guard is deliberately
// hard, so the section it protects is likeliest to be empty on exactly the panels where the model
// wrote carelessly, and "Add your own questions below" hands the hardest part of the visit back to
// her. Every floor question must therefore both APPEAR and SURVIVE the same bar as a model one.
// ═══════════════════════════════════════════════════════════════════════════════════════════
const CLEAN_POINTS = [
  { point: "Is my ferritin result worth looking into further?", supporting_markers: ["ferritin"], urgency: "routine" },
  { point: "What is my ferritin result saying about my energy?", supporting_markers: ["ferritin"], urgency: "routine" },
  { point: "Could my ferritin result be worth a second look?", supporting_markers: ["ferritin"], urgency: "routine" },
];
const withPoints = (n) => Object.assign({}, PAYLOAD, { provider_discussion_points: CLEAN_POINTS.slice(0, n) });
const noPriorities = () => Object.assign({}, PAYLOAD, { priorities: [], provider_discussion_points: [] });

console.log("\nTHE QUESTION FLOOR -- 0, 1, 2 and 3 surviving model questions");
const FLOOR = {};
for (const n of [0, 1, 2, 3]) {
  const fr = await run(html, withPoints(n));
  FLOOR[n] = fr;
  if (!fr) { ok(false, "DS-11." + n + ": the page never finished"); continue; }
  eq(fr.modelKept, n, "DS-11." + n + " CONTROL: exactly " + n + " model question(s) survived the guard");
  eq(fr.questions.length, 3, "DS-12." + n + ": the section renders THREE questions");
  eq(fr.qEmpty, 0, "DS-13." + n + ": and no empty state, because something rendered");
  ok(fr.questions.every(q => q.trim().length > 0),
     "DS-14." + n + ": every rendered question carries text");
  ok(fr.questions.every(q => /\?$/.test(q.trim())),
     "DS-15." + n + ": and every one ends in a question mark");
}
// The model's own survivors come FIRST, so a generated question never displaces a written one.
if (FLOOR[1] && FLOOR[1].questions.length === 3) {
  eq(FLOOR[1].questions[0], CLEAN_POINTS[0].point,
     "DS-16: the surviving model question keeps position 1, ahead of the floor");
}
// CONTROL: the floor is what made the difference, not the payload. n=3 renders three MODEL
// questions and no floor text; n=0 renders three and none of them is a model point.
if (FLOOR[3] && FLOOR[0]) {
  const modelTexts = new Set(CLEAN_POINTS.map(p => p.point));
  eq(FLOOR[3].questions.filter(q => modelTexts.has(q)).length, 3,
     "DS-17 CONTROL: with three model questions the floor adds nothing");
  eq(FLOOR[0].questions.filter(q => modelTexts.has(q)).length, 0,
     "DS-17b CONTROL: with none, every rendered question came from the floor");
}

console.log("\nZERO PRIORITIES -- the two fixed questions, named exactly");
const ZP = await run(html, noPriorities());
if (!ZP) { ok(false, "DS-18: the zero-priority page never finished"); }
else {
  eq(ZP.questions.length, 2, "DS-18: exactly two questions render");
  eq(ZP.questions[0], "Is there anything in these results you would want to keep an eye on?",
     "DS-18a: the first is the fixed wording");
  eq(ZP.questions[1], "Could anything in these results be connected to how I have been feeling lately?",
     "DS-18b: and the second");
  eq(ZP.qEmpty, 0, "DS-18c: the questions section shows no empty state");
  // CONTROL: doctorFindings has its OWN .doc-empty and an unscoped count reports it as this one.
  ok(ZP.rangesLoaded, "DS-18d CONTROL: ranges-slim really loaded, so the guard ran against the full vocabulary");
}

console.log("\nEVERY FLOOR QUESTION PASSES THE GUARD, against the full vocabulary");
{
  // RE-RENDER FIRST. The probe below reads window.__rdPayload, which is whatever the LAST run()
  // left behind -- and that was the ZERO-PRIORITY payload, so the "marker-named" candidates were
  // silently the two unnamed ones and DS-20 passed on the wrong list. DS-20c is the control that
  // caught it, and this line is the fix: put a payload WITH priorities in front of the probe.
  await run(html, withPoints(0));
  const probe = `(() => {
    const P = window.__rdPayload;
    const vocab = doctorBuildMarkerVocab(P);
    const top = (Array.isArray(P.priorities) ? P.priorities : []).filter(Boolean).slice()
      .sort((a,b)=>((typeof a.rank==="number")?a.rank:99)-((typeof b.rank==="number")?b.rank:99)).slice(0,5);
    const ids = new Set();
    top.forEach(x => (x.primary_markers||[]).forEach(m => m && m.marker_id && ids.add(String(m.marker_id))));
    const names = doctorFloorMarkers(top);
    const withNames = doctorFloorQuestions(names).map(q => doctorPointBlocked(q, ids, vocab));
    const zero = doctorFloorQuestions([]).map(q => doctorPointBlocked(q, new Set(), vocab));
    return JSON.stringify({ withNames, zero, vocabNames: vocab.names.length, names,
      knownPositive: doctorPointBlocked("Please order a repeat panel.", ids, vocab) });
  })()`;
  const g = JSON.parse(await ev(probe));
  ok(g.vocabNames > 500, "DS-19 CONTROL: the guard is running against the real vocabulary  (" + g.vocabNames + " names)");
  ok(g.knownPositive !== null, "DS-19b CONTROL: and it still refuses a point that must go  (" + JSON.stringify(g.knownPositive) + ")");
  ok(g.withNames.every(x => x === null),
     "DS-20: every marker-named floor question passes doctorPointBlocked  (" + JSON.stringify(g.withNames) + ")");
  ok(g.zero.every(x => x === null),
     "DS-20b: and both zero-priority questions do too  (" + JSON.stringify(g.zero) + ")");
  ok(g.names.length >= 1, "DS-20c CONTROL: the floor found at least one marker name to use");
}

console.log("\nBYTE-IDENTICAL -- three surviving questions render exactly as before these fixes");
{
  const md5 = (x) => createHash("md5").update(String(x)).digest("hex");
  // AN EXPLICIT REF, not HEAD. "before" means the build these three commits land ON, and HEAD
  // stops meaning that the moment a second one lands: with the floor already in HEAD both sides
  // rendered the same three questions and DS-28b, the control, went red on a correct file.
  const BEFORE_REF = process.env.BEFORE_REF || "d611060";
  let before = null;
  try { before = execSync("git show " + BEFORE_REF + ":dashboard.html", { maxBuffer: 1 << 28 }).toString(); }
  catch (e) { ok(false, "DS-27: could not read " + BEFORE_REF + ":dashboard.html -- " + e.message); }
  if (before) {
    const B = await run(before, withPoints(3));
    ok(!!B && !B.threw, "DS-27 CONTROL: the BEFORE build rendered the same payload without throwing");
    if (B && FLOOR[3]) {
      ok(B.qSectionHtml.length > 0, "DS-27b CONTROL: the BEFORE questions section is non-empty  (" + B.qSectionHtml.length + " chars)");
      eq(md5(FLOOR[3].qSectionHtml), md5(B.qSectionHtml),
         "DS-28: the questions section is byte-identical when three model questions survive");
      // And the BEFORE build must DIFFER on a payload the floor touches, or DS-28 is comparing a
      // renderer that ignores these fixes rather than one they left alone.
      const B0 = await run(before, withPoints(0));
      if (B0) ok(md5(B0.qSectionHtml) !== md5(FLOOR[0].qSectionHtml),
        "DS-28b CONTROL: with ZERO model questions the two builds differ, so DS-28 is a real match");
    }
  }
}

console.log("\nMUTANTS -- one per fix, each valid JavaScript, each turning its own pin red");
{
  const MUT = {
    fix2: [["  if(ordered.length < 3){\n", "  if(false){\n"]],
  };
  for (const name of Object.keys(MUT)) {
    let src = html, located = true;
    for (const [from, to] of MUT[name]) {
      if (src.indexOf(from) === -1) { located = false; break; }
      src = src.replace(from, to);
    }
    ok(located, "DS-29." + name + ": the mutant anchor was LOCATED, so it is a real change");
    if (!located) continue;
    try { new Function(extractApp(src, "mutant " + name)); }
    catch (e) { ok(false, "DS-29b." + name + ": the mutant is valid JavaScript (" + e.message + ")"); continue; }
    ok(true, "DS-29b." + name + ": the mutant parses, so its result means something");
    const mr = await run(src, name === "fix1" ? PAYLOAD : withPoints(0));
    if (!mr) { ok(false, "DS-30." + name + ": the mutant page never finished"); continue; }
    if (name === "fix1") {
      const g = JSON.parse(await ev(`(() => {
        const vocab = doctorBuildMarkerVocab(window.__rdPayload);
        return JSON.stringify(doctorPointBlocked("Could I have something with my ferritin?", new Set(["ferritin"]), vocab));
      })()`));
      eq(g, null, "DS-30.fix1: without the shapes loop a diagnosis question passes, so DS-21 can fail");
    }
    if (name === "fix2") {
      eq(mr.questions.length, 0, "DS-30.fix2: without the floor the section renders nothing, so DS-12.0 can fail");
      eq(mr.qEmpty, 1, "DS-30b.fix2: and the empty state comes back");
    }
    if (name === "fix3") {
      ok(JSON.stringify(mr.headings) !== JSON.stringify(WANT_HEADINGS),
         "DS-30.fix3: the old order fails the heading pin, so DS-3 can fail  (" + JSON.stringify(mr.headings) + ")");
    }
  }
}
console.log("\nMUTANTS -- one per fix, each valid JavaScript, each turning its own pin red");
{
  const MUT = {
    fix3: [["    doctorContext() + doctorQuestions(p) + doctorReadWith(p);",
            "    doctorQuestions(p) + doctorContext() + doctorReadWith(p);"]],
  };
  for (const name of Object.keys(MUT)) {
    let src = html, located = true;
    for (const [from, to] of MUT[name]) {
      if (src.indexOf(from) === -1) { located = false; break; }
      src = src.replace(from, to);
    }
    ok(located, "DS-29." + name + ": the mutant anchor was LOCATED, so it is a real change");
    if (!located) continue;
    try { new Function(extractApp(src, "mutant " + name)); }
    catch (e) { ok(false, "DS-29b." + name + ": the mutant is valid JavaScript (" + e.message + ")"); continue; }
    ok(true, "DS-29b." + name + ": the mutant parses, so its result means something");
    const mr = await run(src, name === "fix1" ? PAYLOAD : withPoints(0));
    if (!mr) { ok(false, "DS-30." + name + ": the mutant page never finished"); continue; }
    if (name === "fix1") {
      const g = JSON.parse(await ev(`(() => {
        const vocab = doctorBuildMarkerVocab(window.__rdPayload);
        return JSON.stringify(doctorPointBlocked("Could I have something with my ferritin?", new Set(["ferritin"]), vocab));
      })()`));
      eq(g, null, "DS-30.fix1: without the shapes loop a diagnosis question passes, so DS-21 can fail");
    }
    if (name === "fix2") {
      eq(mr.questions.length, 0, "DS-30.fix2: without the floor the section renders nothing, so DS-12.0 can fail");
      eq(mr.qEmpty, 1, "DS-30b.fix2: and the empty state comes back");
    }
    if (name === "fix3") {
      ok(JSON.stringify(mr.headings) !== JSON.stringify(WANT_HEADINGS),
         "DS-30.fix3: the old order fails the heading pin, so DS-3 can fail  (" + JSON.stringify(mr.headings) + ")");
    }
  }
}

console.log("\nRANGE_ID_V1 -- an alias of a priority marker resolves, one of a non-priority marker does not");
{
  // ranges-slim.json now carries the marker_id on every alias and display-name entry. Before it
  // did, a name taken from that map resolved to undefined and the guard read it as a marker she
  // has no priority for -- so an ALIAS of a marker she genuinely has a priority for was dropped.
  //
  // THE FIXTURE USES A REAL ALIAS, not the display name and not the id. "Ferritin" and "ferritin"
  // both reach nameToId from the payload's own systems[].markers[] walk and always resolved; only
  // a name this panel never mentions had nothing to resolve against, which is the case under test.
  await run(html, PAYLOAD);
  const probe = `(() => {
    const P = window.__rdPayload;
    const vocab = doctorBuildMarkerVocab(P);
    const ids = new Set(["ferritin"]);            // ferritin IS one of hers; tsh is not
    const b = (t) => doctorPointBlocked(t, ids, vocab);
    const R = (typeof RANGES_LOOKUP !== "undefined") ? RANGES_LOOKUP : null;
    const withId = R ? Object.values(R.by_alias_lc || {}).filter(v => v && typeof v.id === "string").length : 0;
    const total  = R ? Object.keys(R.by_alias_lc || {}).length : 0;
    return JSON.stringify({
      aliasOfPriority:    b("Is my serum ferritin result worth looking into further?"),
      aliasOfNonPriority: b("Is my thyrotropin result worth looking into further?"),
      displayNameKept:    b("Is my ferritin result worth looking into further?"),
      aliasResolves:      vocab.nameToId.get("serum ferritin") || null,
      nonPriorityResolves: vocab.nameToId.get("thyrotropin") || null,
      aliasesWithId: withId, aliasesTotal: total,
      knownPositive: b("Please order a repeat panel."),
    });
  })()`;
  const g = JSON.parse(await ev(probe));
  ok(g.aliasesTotal > 500, "DS-31 CONTROL: ranges-slim really loaded  (" + g.aliasesTotal + " aliases)");
  eq(g.aliasesWithId, g.aliasesTotal, "DS-31b CONTROL: every alias entry carries an id");
  ok(g.knownPositive !== null, "DS-31c CONTROL: the guard still refuses a point that must go  (" + JSON.stringify(g.knownPositive) + ")");
  eq(g.aliasResolves, "ferritin", "DS-32: an alias of a priority marker resolves to its marker_id");
  eq(g.aliasOfPriority, null, "DS-33: so a question using that alias is KEPT");
  eq(g.displayNameKept, null, "DS-33b CONTROL: the display-name form was already kept, so DS-33 is the alias case");
  eq(g.nonPriorityResolves, "tsh", "DS-34: an alias of a NON-priority marker also resolves");
  eq(g.aliasOfNonPriority, "marker_not_in_priorities",
     "DS-35: and a question using it is still DROPPED, so resolving names did not widen the gate");
}

console.log("\nMUTANT -- the id lookup removed");
{
  const ID_LINE = '      if(entry && typeof entry.id === "string" && entry.id && !nameToId.has(t)) nameToId.set(t, entry.id);\n';
  ok(html.indexOf(ID_LINE) !== -1, "DS-36: the id-lookup line was LOCATED, so the mutant is a real change");
  if (html.indexOf(ID_LINE) !== -1) {
    const mut = html.replace(ID_LINE, "");
    try { new Function(extractApp(mut, "the id mutant")); ok(true, "DS-36b: the mutant parses"); }
    catch (e) { ok(false, "DS-36b: the mutant is valid JavaScript (" + e.message + ")"); }
    const mr = await run(mut, PAYLOAD);
    if (!mr) { ok(false, "DS-37: the mutant page never finished"); }
    else {
      const g2 = JSON.parse(await ev(`(() => {
        const vocab = doctorBuildMarkerVocab(window.__rdPayload);
        const ids = new Set(["ferritin"]);
        return JSON.stringify({
          alias: doctorPointBlocked("Is my serum ferritin result worth looking into further?", ids, vocab),
          resolves: vocab.nameToId.get("serum ferritin") || null,
        });
      })()`));
      eq(g2.resolves, null, "DS-37: without the lookup the alias resolves to nothing");
      eq(g2.alias, "marker_not_in_priorities",
         "DS-38: and the alias question is dropped again, so DS-33 can fail");
    }
  }
}

let SPAN_PAYLOAD = null;

console.log("\nNAME_SPAN_V1 -- a shorter marker name inside a longer matched one is part of it");
{
  // THE FIXTURE IS THE REAL PAIR, taken from a live panel rather than invented. "Transferrin" is
  // the first 11 characters of "Transferrin Saturation", so in a sentence naming both of her iron
  // markers the shorter name matched at [26,37] entirely inside the longer one's [26,48] and
  // resolved to the transferrin marker she has no priority for. The page generated a question
  // about two of her own results and then refused it.
  //
  // Values are invented; only the ids and names come from the library.
  const mk = (id, dn) => ({ marker_id: id, display_name: dn, value: 12, unit: "ng/mL",
    status: "watch", band: "suboptimal_low", position: "low", flag_status: "user_facing" });
  SPAN_PAYLOAD = Object.assign({}, PAYLOAD, {
    provider_discussion_points: [],
    systems: [{ system_id: "iron_status", display_name: "Iron", status: "watch",
      markers: [mk("iron_serum", "Iron (Serum)"), mk("transferrin_saturation", "Transferrin Saturation")] }],
    priorities: [
      { priority_id: "p1", rank: 1, headline: "Synthetic finding one.", system_id: "iron_status",
        severity: "moderate", why_this_matters: "Invented sentence.",
        action_layer: { primary_lever: "Invented lever." },
        primary_markers: [mk("iron_serum", "Iron (Serum)")] },
      { priority_id: "p2", rank: 2, headline: "Synthetic finding two.", system_id: "iron_status",
        severity: "moderate", why_this_matters: "Invented sentence.",
        action_layer: { primary_lever: "Invented lever." },
        primary_markers: [mk("transferrin_saturation", "Transferrin Saturation")] },
    ],
  });
  const sr = await run(html, SPAN_PAYLOAD);
  ok(!!sr && !sr.threw, "DS-39 CONTROL: the span fixture rendered without throwing");

  const probe = `(() => {
    const P = window.__rdPayload;
    const vocab = doctorBuildMarkerVocab(P);
    const ids = new Set(["iron_serum", "transferrin_saturation"]);
    const b = (t) => doctorPointBlocked(t, ids, vocab);
    const lower = "could my iron (serum) and transferrin saturation results be connected?";
    return JSON.stringify({
      pair:        b("Could my Iron (Serum) and Transferrin Saturation results be connected?"),
      shortAlone:  b("Is my Transferrin result worth looking into further?"),
      bothWays:    b("Could my Transferrin Saturation and my Transferrin results be connected?"),
      longSpan:    doctorNameSpans(lower, "transferrin saturation"),
      shortSpan:   doctorNameSpans(lower, "transferrin"),
      shortId:     vocab.nameToId.get("transferrin") || null,
      longId:      vocab.nameToId.get("transferrin saturation") || null,
      knownPositive: b("Please order a repeat panel."),
    });
  })()`;
  const g = JSON.parse(await ev(probe));
  ok(g.knownPositive !== null, "DS-39b CONTROL: the guard still refuses a point that must go  (" + JSON.stringify(g.knownPositive) + ")");
  eq(g.longId, "transferrin_saturation", "DS-40 CONTROL: the long name resolves to one of hers");
  eq(g.shortId, "transferrin", "DS-40b CONTROL: the short name resolves to a marker she has NO priority for");
  // The containment is asserted, not assumed: same start, shorter end, both inside one sentence.
  ok(g.longSpan.length === 1 && g.shortSpan.length === 1 &&
     g.shortSpan[0][0] >= g.longSpan[0][0] && g.shortSpan[0][1] <= g.longSpan[0][1],
     "DS-41 CONTROL: the short name's span lies INSIDE the long one's  (" +
     JSON.stringify(g.shortSpan) + " within " + JSON.stringify(g.longSpan) + ")");
  eq(g.pair, null, "DS-42: a question naming both of her iron markers is KEPT");
  eq(g.shortAlone, "marker_not_in_priorities",
     "DS-43: the shorter non-priority name standing alone is still DROPPED");
  eq(g.bothWays, "marker_not_in_priorities",
     "DS-44: and appearing BOTH inside the longer name and separately is still DROPPED");

  // The floor candidate that this bug was refusing now survives and reaches the page.
  eq(sr.questions.length, 3, "DS-45: the floor fills to three on this fixture");
  const floorProbe = `(() => {
    const P = window.__rdPayload;
    const vocab = doctorBuildMarkerVocab(P);
    const top = (P.priorities || []).filter(Boolean).slice()
      .sort((a,b)=>((typeof a.rank==="number")?a.rank:99)-((typeof b.rank==="number")?b.rank:99)).slice(0,5);
    const ids = new Set();
    top.forEach(x => (x.primary_markers||[]).forEach(m => m && m.marker_id && ids.add(String(m.marker_id))));
    const cands = doctorFloorQuestions(doctorFloorMarkers(top));
    return JSON.stringify({ n: cands.length, why: cands.map(q => doctorPointBlocked(q, ids, vocab)) });
  })()`;
  const f = JSON.parse(await ev(floorProbe));
  eq(f.n, 4, "DS-45b CONTROL: all four floor candidates were generated, so DS-46 covers the pattern one");
  ok(f.why.every(x => x === null),
     "DS-46: every floor candidate passes the guard, the pattern one included  (" + JSON.stringify(f.why) + ")");
}

console.log("\nMUTANT -- the span skip removed");
{
  const SPAN_LINE = '      const fresh = spans.filter(function(sp){ return !inside(sp); });\n';
  ok(html.indexOf(SPAN_LINE) !== -1, "DS-47: the span-skip line was LOCATED, so the mutant is a real change");
  if (html.indexOf(SPAN_LINE) !== -1) {
    // Valid JavaScript: every span counts again, which is exactly the pre-fix behaviour.
    const mut = html.replace(SPAN_LINE, '      const fresh = spans;\n');
    try { new Function(extractApp(mut, "the span mutant")); ok(true, "DS-47b: the mutant parses"); }
    catch (e) { ok(false, "DS-47b: the mutant is valid JavaScript (" + e.message + ")"); }
    const mr = await run(mut, SPAN_PAYLOAD);
    if (!mr) { ok(false, "DS-48: the mutant page never finished"); }
    else {
      const g2 = JSON.parse(await ev(`(() => {
        const vocab = doctorBuildMarkerVocab(window.__rdPayload);
        const ids = new Set(["iron_serum", "transferrin_saturation"]);
        return JSON.stringify(doctorPointBlocked(
          "Could my Iron (Serum) and Transferrin Saturation results be connected?", ids, vocab));
      })()`));
      eq(g2, "marker_not_in_priorities",
         "DS-48: without the span skip the pair question is dropped again, so DS-42 can fail");
    }
  }
}

chrome.kill(); server.close();
done(fail ? 1 : 0);
