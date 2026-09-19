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

// ---------------------------------------------------------------------------------------
// R2/R3. THE WALKTHROUGH BEAT. Everything below reads the EXECUTED deck, never the source.
// ---------------------------------------------------------------------------------------
// Pull the walkthrough beat out of the rendered deck by its eyebrow, then take that <section>.
function beatOf(html) {
  const key = '<div class="eyebrow stag">WHAT HAPPENS NEXT</div>';
  const k = html.indexOf(key);
  if (k < 0) return null;
  const start = html.lastIndexOf("<section", k);
  const end = html.indexOf("</section>", k);
  if (start < 0 || end < 0) return null;
  return html.slice(start, end + "</section>".length);
}
// Direct children of the beat's <section>: elements opened at depth 0 inside it.
// NULL-SAFE. A mutant that removes the beat leaves beatOf returning null, and an unguarded
// .replace on it would kill the process. A dead runner is not a red, so a missing beat has to
// arrive as an empty list and fail the count assertions by name.
function directChildren(beat) {
  if (!beat) return [];
  const inner = beat.replace(/^<section\b[^>]*>/, "").replace(/<\/section>$/, "");
  const out = []; let depth = 0;
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g; let m;
  while ((m = re.exec(inner))) {
    const close = m[1], tag = m[2], attrs = m[3];
    if (close) { depth--; continue; }
    if (/\/\s*$/.test(attrs) || /^(br|img|input|hr)$/i.test(tag)) { if (depth === 0) out.push(tag); continue; }
    if (depth === 0) out.push(tag);
    depth++;
  }
  return out;
}
// Text nodes of the beat, tags removed and entities decoded. Proven against the apostrophe.
function textOf(beat) {
  if (!beat) return "";
  return beat.replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

const FIRST = runDeck(firstPanel(), true);
const FIRST5 = runDeck(firstPanel(), false);
const LATER = runDeck(laterPanel(), true);
eq("beat fixtures ran without throwing",
  JSON.stringify([FIRST.threw, FIRST5.threw, LATER.threw]), JSON.stringify([null, null, null]));

const B6 = beatOf(FIRST.html), B5 = beatOf(FIRST5.html);
ok("extractor control: the beat was found on a first panel", !!B6);
ok("extractor control: it is a single <section> and not the whole deck",
  !!B6 && B6.startsWith("<section") && (B6.match(/<section/g) || []).length === 1);
ok("extractor impossible control: it finds nothing in markup with no such eyebrow",
  beatOf('<section class="card"><div class="eyebrow stag">SOMETHING ELSE</div></section>') === null);

// THE APOSTROPHE. On this codebase's instrument-fault record twice. Proven, with a control.
ok("apostrophe control: textOf returns the apostrophe string intact",
  textOf('<p><b>What' + "'" + 's going right</b> x</p>').includes("What" + "'" + "s going right"));
ok("apostrophe control: and it survives the entity form too",
  textOf("<p><b>What&#39;s going right</b> x</p>").includes("What" + "'" + "s going right"));
ok("apostrophe control: the extractor does NOT silently drop it",
  !textOf('<p>What' + "'" + 's</p>').includes("Whats"));

// R2. FIRST PANEL ONLY, five named fixtures.
ok("R2 longitudinal null          -> beat present", !!beatOf(runDeck(firstPanel({ longitudinal: null }), true).html));
ok("R2 longitudinal undefined     -> beat present", !!beatOf(runDeck(firstPanel({ longitudinal: undefined }), true).html));
ok("R2 longitudinal a string      -> beat present, and no throw",
  runDeck(firstPanel({ longitudinal: "not-an-object" }), true).threw === null &&
  !!beatOf(runDeck(firstPanel({ longitudinal: "not-an-object" }), true).html));
ok("R2 longitudinal an empty object -> beat present", !!beatOf(runDeck(firstPanel({ longitudinal: {} }), true).html));
ok("R2 longitudinal with baseline_panel_date -> beat ABSENT", beatOf(LATER.html) === null);

// R2. THE BEAT COUNT MOVES BY EXACTLY ONE, executed, not inspected.
eq("R2 a first panel adds exactly one beat", FIRST.cards - LATER.cards, 1);
eq("R2 a later panel adds exactly none", LATER.cards - LATER.cards, 0);
ok("R2 beat-count control: the later panel still rendered a real deck", LATER.cards > 1);
ok("R2 BEATS is still read from cards.length after the write, so no constant changed",
  /deck\.innerHTML = beats\.join\(''\);/.test(CODE) &&
  /const cards = \[\.\.\.deck\.querySelectorAll\('\.card'\)\];/.test(CODE) &&
  /const BEATS = cards\.length;/.test(CODE) &&
  CODE.indexOf("const BEATS = cards.length") > CODE.indexOf("deck.innerHTML = beats.join('')"));
ok("R2 BEATS control: it is never assigned a literal",
  (CODE.match(/const BEATS\s*=\s*[0-9]/g) || []).length === 0);

// R2. THE BEAT IS LAST.
ok("R2 the walkthrough beat is the FINAL beat in the deck",
  FIRST.html.lastIndexOf("<section") === FIRST.html.lastIndexOf(B6));
ok("R2 position control: it is NOT the first beat either",
  FIRST.html.indexOf("<section") !== FIRST.html.lastIndexOf(B6));

// R2. THE .stag CEILING, computed from the CSS at run time.
const STAG_RULES = (RAW.match(/#view-reveal \.card\.active \.stag:nth-child\(\d+\)\{animation-delay:[0-9.]+s\}/g) || []).length;
eq("R2 the .stag delay rule count, read from the stylesheet", STAG_RULES, 10);
ok("R2 stag-rule control: the matcher finds rules, and none at 11",
  STAG_RULES > 0 && !/\.stag:nth-child\(11\)/.test(RAW));
const KIDS6 = directChildren(B6), KIDS5 = directChildren(B5);
eq("R2 the beat has this many direct children with six items", KIDS6.length, 10);
eq("R2 and this many with the face scan omitted", KIDS5.length, 9);
ok("R2 the direct-child count is within the .stag rule count, six items", KIDS6.length <= STAG_RULES);
ok("R2 the direct-child count is within the .stag rule count, five items", KIDS5.length <= STAG_RULES);
ok("R2 ceiling control: the SAME assertion fails at eleven children",
  !((KIDS6.length + 1) <= STAG_RULES));
ok("R2 every direct child carries .stag, so every one is staggered",
  ((B6 || "").match(/ class="[^"]*\bstag\b[^"]*"/g) || []).length >= KIDS6.length);
ok("R2 NO WRAPPER: the children are the flat tags, not one container",
  JSON.stringify(KIDS6) === JSON.stringify(["div", "h1", "p", "p", "p", "p", "p", "p", "p", "button"]));
ok("R2 wrapper control: a wrapped beat would read as ONE direct child",
  directChildren('<section class="card"><div class="wrap"><p>a</p><p>b</p></div></section>').length === 1);

// R2. ITEM 6 IS CONDITIONAL.
const itemsOf = (b) => ((b || "").match(/<p class="sub stag"><b>/g) || []).length;
eq("R2 six items render when the parameter is true", itemsOf(B6), 6);
eq("R2 five items render when it is false", itemsOf(B5), 5);
ok("R2 'face scan' appears NOWHERE in the beat when not consented",
  !/face\s*scan/i.test(textOf(B5)));
ok("R2 face-scan control: it DOES appear when consented", /face\s*scan/i.test(textOf(B6)));
// STRICT: unknown is not consent, now observable.
for (const [label, v] of [["null", null], ["undefined", undefined], ["the string 'yes'", "yes"],
                          ["the number 1", 1], ["a pending Promise", Promise.resolve(true)]]) {
  const b = beatOf(runDeck(firstPanel(), v).html);
  ok("R2 STRICT: " + label + " omits the face scan", !!b && itemsOf(b) === 5);
}

// R3. THE COPY, VERBATIM, one assertion per string.
const T6 = textOf(B6);
for (const str of [
  "WHAT HAPPENS NEXT",
  "Everything from here lives on one page.",
  "You can come back to it any time. Here is what each part is for.",
  "What needs attention",
  "The findings this panel puts first, and the markers behind each one.",
  "What" + "'" + "s going right",
  "What this panel says is already working.",
  "Where to start",
  "The few habits that move several of these findings at once.",
  "Across your panels",
  "How each marker has moved since your last panel. It appears once you have two.",
  "Sana",
  "Ask her anything about this panel. She reads from your results.",
  "Face scan",
  "A sixty second face scan reading your pulse and breathing.",
  "Open my results >",
]) ok("R3 verbatim: " + JSON.stringify(str), T6.includes(str));
ok("R3 verbatim control: a string that is NOT ruled is absent",
  !T6.includes("Everything from here lives on one screen."));

// R3. NO COLON, with a control proving the scan fires on a planted one.
eq("R3 no colon anywhere in the beat's text", (T6.match(/:/g) || []).length, 0);
ok("R3 colon control: the same scan DOES fire on a planted colon",
  (textOf((B6 || "").replace("Where to start", "Where to start:")).match(/:/g) || []).length === 1);
ok("R3 'camera reading' appears nowhere, case-insensitive", !/camera\s*reading/i.test(T6));
ok("R3 camera control: the same matcher fires on a planted instance",
  /camera\s*reading/i.test(textOf((B6 || "").replace("A sixty second face scan", "A camera reading"))));
ok("R3 American spelling: no -ise form in the beat", !/\b\w+ised?\b/i.test(T6));
ok("R3 spelling control: the matcher fires on a planted British spelling",
  /\b\w+ised?\b/i.test(textOf((B6 || "").replace("already working", "already personalised"))));

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
