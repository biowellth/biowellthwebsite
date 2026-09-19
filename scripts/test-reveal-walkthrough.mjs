#!/usr/bin/env node
// FACE_SCAN_PARAM_V1 + the reveal deck's walkthrough beat.
//
// THE DECK HAD NO TEST AT ALL before this file. Measured 2026-09-19: zero occurrences of
// buildDeck across every scripts/test-*.mjs, against a control of 25 mk-band-dot hits in the
// same directory. So this file starts by building the harness the deck never had.
//
// EXECUTES THE SHIPPED CODE. buildDeck is cut out of dashboard.html, compiled with new Function
// and run against a fake DOM. Asserting that a string appears in the file would pass for a beat
// nobody renders and for a parameter nobody reads, which is the failure this file exists against.
//
// The payload is SYNTHETIC throughout: invented headlines, invented markers, no lab values.
//
//   node scripts/test-reveal-walkthrough.mjs      (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const RAW = readFileSync(FILE, "utf8");
const HTML = (RAW.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) || [])
  .map((b) => b.replace(/^<script\b[^>]*>/, "").replace(/<\/script>$/, ""))
  .join("\n");

let pass = 0, fail = 0;
const ok = (label, cond) => {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label); }
};
const eq = (label, got, want) => {
  if (got === want) { pass++; console.log("  ok   " + label + "  (" + JSON.stringify(got) + ")"); }
  else { fail++; console.log("  FAIL " + label + "  got " + JSON.stringify(got) + " want " + JSON.stringify(want)); }
};

console.log("reveal walkthrough");
ok("extraction control: JS found, and less than the whole file",
  HTML.length > 10000 && HTML.length < RAW.length);

// ---------------------------------------------------------------------------------------
// THE STRIPPER RUNS BEFORE THE CUTTER. An apostrophe inside a comment opens a quote the brace
// counter never closes; that is on this codebase's instrument-fault record twice, most recently
// "resolve the marker's system via chipSysByMarker" in the priority mapper. Comments come out
// first, line-based, lifted from the proven form in the sibling suites.
// ---------------------------------------------------------------------------------------
function stripComments(src) {
  const out = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) { out.push(""); continue; }
    let cut = -1;
    for (let i = 1; i < line.length - 1; i++) {
      if (line[i] !== "/" || line[i + 1] !== "/") continue;
      if (line[i - 1] === ":") continue;
      const before = line.slice(0, i);
      if ((before.match(/"/g) || []).length % 2 === 0 &&
          (before.match(/'/g) || []).length % 2 === 0) { cut = i; break; }
    }
    out.push(cut >= 0 ? line.slice(0, cut) : line);
  }
  return out.join("\n");
}
const CODE = stripComments(HTML);
ok("stripper control: a full-line comment is gone from CODE but present in RAW",
  RAW.includes("// FACE_SCAN_PARAM_V1 - consent arrives RESOLVED") &&
  !CODE.includes("// FACE_SCAN_PARAM_V1 - consent arrives RESOLVED"));
ok("stripper control: it does NOT eat a URL's double slash",
  !/https:$/m.test(CODE.split("\n").find((l) => l.includes("https://")) || "https://x"));
ok("stripper control: an apostrophe in a comment does not unbalance what follows",
  (CODE.match(/\{/g) || []).length === (CODE.match(/\}/g) || []).length);

// THE CUTTER. Brace-balanced from an anchor, over the STRIPPED source.
function cut(anchor) {
  const i = CODE.indexOf(anchor);
  if (i < 0) return null;
  let d = 0, started = false;
  for (let k = i; k < CODE.length; k++) {
    const c = CODE[k];
    if (c === "{") { d++; started = true; }
    else if (c === "}") { d--; if (started && d === 0) return CODE.slice(i, k + 1); }
  }
  return null;
}
const BUILD_DECK_SRC = cut("function buildDeck(p, reportId, faceScanConsented){");
ok("cutter control: buildDeck was found and is a plausible size",
  !!BUILD_DECK_SRC && BUILD_DECK_SRC.length > 8000 && BUILD_DECK_SRC.length < 40000);
ok("cutter control: it is brace balanced",
  !!BUILD_DECK_SRC &&
  (BUILD_DECK_SRC.match(/\{/g) || []).length === (BUILD_DECK_SRC.match(/\}/g) || []).length);
ok("cutter impossible control: a function that does not exist is not found",
  cut("function buildDeckNonesuchZzz(") === null);

// ---------------------------------------------------------------------------------------
// THE FAKE DOM. Small on purpose: enough for buildDeck to reach the end of show(0), and no
// more. The one thing it models faithfully is querySelectorAll('.card'), because BEATS is read
// from cards.length AFTER the innerHTML write, so the card count is the number under test.
// ---------------------------------------------------------------------------------------
const CARD_RE = /<section\b[^>]*\bclass="card(?=[\s"-])[^>]*>/g;
function mkNode(id) {
  const cl = new Set();
  const n = {
    id, innerHTML: "", children: [], dataset: {}, scrollTop: 0, style: {}, className: "",
    classList: {
      add: (...c) => c.forEach((x) => cl.add(x)),
      remove: (...c) => c.forEach((x) => cl.delete(x)),
      contains: (c) => cl.has(c),
      toggle: (c, f) => {
        if (f === undefined) { cl.has(c) ? cl.delete(c) : cl.add(c); }
        else if (f) { cl.add(c); } else { cl.delete(c); }
      },
    },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    cloneNode() { const c = mkNode(id); c.parentNode = this.parentNode; return c; },
    querySelectorAll(sel) {
      if (sel !== ".card") return [];
      const out = []; let m; CARD_RE.lastIndex = 0;
      while ((m = CARD_RE.exec(this.innerHTML))) {
        const c = mkNode("card");
        const bk = m[0].match(/data-beat-kind="([^"]*)"/);
        if (bk) c.dataset.beatKind = bk[1];
        out.push(c);
      }
      return out;
    },
  };
  n.parentNode = { replaceChild(nw) { nw.parentNode = n.parentNode; } };
  return n;
}
let REG = {};
const $ = (id) => (REG[id] = REG[id] || mkNode(id));

const BASE = {
  $,
  esc: (x) => String(x == null ? "" : x).replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
  markerName: (m) => (m && m.marker_id) || "marker",
  // The eight externals buildDeck reaches for. Each was DISCOVERED by running the function and
  // reading the ReferenceError, not guessed, and each was checked NOT to be declared inside
  // buildDeck before being stubbed -- a stub that shadows a real inner function would make the
  // harness test a fiction. Control for that check: paintSegs IS declared inside, and reads as
  // such; zzzNonesuch is declared nowhere and reads as such.
  markerCountOf: () => 12,
  reportCoverageCount: () => ({ n: 10 }),
  dropSuppressedQW: (list) => list,
  lowestCoverArea: () => null,
  firstName: () => "Testname",
  isSuppressed: () => false,
  PROFILE: { full_name: "Testname Surname" },
  toneFor: () => "t-neutral",
  stampSeen: () => {},
  document: { createElement: () => mkNode("el"), addEventListener() {}, removeEventListener() {} },
  window: {},
  matchMedia: () => ({ matches: true }),
  requestAnimationFrame: () => {},
  performance: { now: () => 0 },
};
const scope = new Proxy(BASE, { has: (t, k) => k in t, get: (t, k) => t[k] });
const buildDeck = new Function("scope",
  "with(scope){ " + BUILD_DECK_SRC + "\nreturn buildDeck; }")(scope);
ok("compile control: buildDeck compiled and is a function of arity 3",
  typeof buildDeck === "function" && buildDeck.length === 3);

// Run it and hand back what the deck actually received.
// GUARDED. A mutant that makes buildDeck throw -- reading a name that is not in scope, say --
// would otherwise kill the process and take every later assertion with it, and a dead runner is
// not a red. A throw is captured and surfaced as a named failure instead.
function runDeck(p, consented) {
  REG = {};
  BASE.window = {};
  try {
    buildDeck(p, "rpt-synthetic", consented);
  } catch (e) {
    return { html: "", cards: 0, threw: String((e && e.message) || e) };
  }
  const deck = REG["rd-deck"];
  const html = deck ? deck.innerHTML : "";
  return { html, cards: (html.match(CARD_RE) || []).length, threw: null };
}

// SYNTHETIC payload. Invented copy, invented marker ids, no lab values.
const basePayload = () => ({
  vitality: { composite: 71, band: { label: "Steady" }, visibility: 60, display: {} },
  priorities: [
    { headline: "Synthetic finding one", why_this_matters: "Invented sentence for the fixture.",
      action_layer: { primary_lever: "Invented lever." },
      primary_markers: [{ marker_id: "synthmarker", value: 1, unit: "u" }] },
  ],
  quietly_working: [], coverage_gap: { ids: [] }, systems: [],
});
const firstPanel = (extra) => Object.assign(basePayload(), extra || {});
const laterPanel = () => Object.assign(basePayload(),
  { longitudinal: { baseline_panel_date: "2026-01-01", persistent_open: [], resolved: [], newly_crossed: [] } });

{
  const r = runDeck(firstPanel(), false);
  eq("runner control: buildDeck ran without throwing", r.threw, null);
  ok("runner control: the deck rendered a non-trivial amount of markup", r.html.length > 2000);
  ok("runner control: it rendered more than one card", r.cards > 1);
  ok("runner control: the markup is the deck, not something else", r.html.includes("mk-band") || r.html.includes("eyebrow"));
}

// ---------------------------------------------------------------------------------------
// R1. THE PARAMETER. buildDeck consumes a resolved boolean and resolves nothing itself.
// ---------------------------------------------------------------------------------------
eq("R1 buildDeck takes a third parameter", buildDeck.length, 3);
ok("R1 and it is named faceScanConsented",
  /function buildDeck\(p, reportId, faceScanConsented\)\{/.test(CODE));

eq("R1 buildDeck never reads SANA_CONSENT_STATE",
  (BUILD_DECK_SRC.match(/SANA_CONSENT_STATE/g) || []).length, 0);
eq("R1 buildDeck never calls sanaConsentGranted",
  (BUILD_DECK_SRC.match(/sanaConsentGranted/g) || []).length, 0);
eq("R1 buildDeck never reads the scan entry node for consent",
  (BUILD_DECK_SRC.match(/scan-entry|btn-scan/g) || []).length, 0);
ok("R1 absence control: the SAME body does contain other identifiers, so the matcher can fire",
  (BUILD_DECK_SRC.match(/beats\.push\(/g) || []).length > 0 &&
  (BUILD_DECK_SRC.match(/deck\.innerHTML/g) || []).length === 1);
ok("R1 absence control: the same matchers DO fire on the whole file",
  (CODE.match(/SANA_CONSENT_STATE/g) || []).length > 0 &&
  (CODE.match(/sanaConsentGranted/g) || []).length > 0);
ok("R1 impossible control: an identifier that exists nowhere",
  (CODE.match(/sanaConsentGrantedNonesuchZzz/g) || []).length === 0);

ok("R1 the parameter is normalised with a strict === true",
  /const faceScanOK = faceScanConsented === true;/.test(CODE));
ok("R1 normalisation control: it is NOT a truthy coercion",
  !/const faceScanOK = !!faceScanConsented/.test(CODE) &&
  !/const faceScanOK = faceScanConsented \|\|/.test(CODE));

// ---------------------------------------------------------------------------------------
// R1. THE THREE CALL SITES each resolve by awaiting, and each passes the result.
// ---------------------------------------------------------------------------------------
ok("R1 call site 1 of 3, the panel switch, awaits and passes",
  /buildDeck\(payload, current\.id, await sanaConsentGranted\(\)\);/.test(CODE));
ok("R1 call site 2 of 3, the replay button, awaits and passes",
  /buildDeck\(window\.__rdPayload, window\.__rdReport, consented\);/.test(CODE) &&
  /consented = \(await sanaConsentGranted\(\)\) === true;/.test(CODE));
ok("R1 call site 3 of 3, the fresh-report poll, awaits and passes",
  /buildDeck\(data\.payload, reportId, await sanaConsentGranted\(\)\);/.test(CODE));
eq("R1 and there are exactly three call sites, so none was missed",
  (CODE.match(/[^n] buildDeck\(|^\s*buildDeck\(/gm) || []).length, 3);
ok("R1 call-site control: no call site passes only two arguments any more",
  !/buildDeck\([^)]*\)\s*;/.test(CODE.replace(/buildDeck\([^;]*,[^;]*,[^;]*\);/g, "")));

// ---------------------------------------------------------------------------------------
// R1. THE REPLAY HANDLER, executed. async, double-click guarded, and safe on a throw.
// ---------------------------------------------------------------------------------------
ok("R1 the replay handler is async", /\$\("btn-replay"\)\.onclick = async \(\)=>\{/.test(CODE));

const REPLAY_SRC = cut('let replayBuilding = false;\n$("btn-replay").onclick = async ()=>{');
ok("replay cutter control: the handler was found", !!REPLAY_SRC && REPLAY_SRC.length > 200);

function runReplay(consentImpl) {
  const calls = [];
  const views = [];
  const reg = { "btn-replay": mkNode("btn-replay") };
  const sc = new Proxy({
    $: (id) => (reg[id] = reg[id] || mkNode(id)),
    window: { __rdPayload: { synthetic: true }, __rdReport: "rpt-synthetic" },
    buildDeck: (p, r, c) => calls.push(c),
    showView: (v) => views.push(v),
    sanaConsentGranted: consentImpl,
  }, { has: (t, k) => k in t, get: (t, k) => t[k] });
  new Function("scope", "with(scope){ " + REPLAY_SRC + " }")(sc);
  return { fire: () => reg["btn-replay"].onclick(), calls, views };
}

{
  const r = runReplay(async () => true);
  await r.fire();
  eq("R1 replay executed: buildDeck called once with true", JSON.stringify(r.calls), JSON.stringify([true]));
  eq("R1 replay executed: showView('reveal') ran", JSON.stringify(r.views), JSON.stringify(["reveal"]));
}
{
  const r = runReplay(async () => false);
  await r.fire();
  eq("R1 replay passes false through unchanged", JSON.stringify(r.calls), JSON.stringify([false]));
}
{
  // DOUBLE CLICK. Two clicks inside the await window must build once.
  let release; const gate = new Promise((res) => { release = res; });
  const r = runReplay(async () => { await gate; return true; });
  const a = r.fire(), b = r.fire();
  release(true); await a; await b;
  eq("R1 DOUBLE CLICK: two clicks inside the await window build the deck ONCE", r.calls.length, 1);
  eq("R1 and showView ran once, not twice", r.views.length, 1);
}
{
  // and the guard releases, so a later click still works.
  const r = runReplay(async () => true);
  await r.fire(); await r.fire();
  eq("R1 guard control: two SEQUENTIAL clicks build twice, so the flag is released", r.calls.length, 2);
}
{
  // A THROW MUST NOT SILENTLY DO NOTHING.
  const r = runReplay(async () => { throw new Error("synthetic consent failure"); });
  let threw = false;
  try { await r.fire(); } catch (e) { threw = true; }
  ok("R1 THROW: the handler does not reject, so there is no unhandled rejection", !threw);
  eq("R1 THROW: the deck is still built", r.calls.length, 1);
  eq("R1 THROW: and it is built as NOT consented", r.calls[0], false);
  eq("R1 THROW: and showView('reveal') still runs, so the button is not dead",
    JSON.stringify(r.views), JSON.stringify(["reveal"]));
}
{
  // The strict rule, at the handler: a non-boolean resolution is not consent.
  const r = runReplay(async () => "yes");
  await r.fire();
  eq("R1 STRICT: a truthy non-boolean resolves to false at the call site", r.calls[0], false);
}

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
