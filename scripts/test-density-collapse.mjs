#!/usr/bin/env node
// DENSITY_COLLAPSE_V1 — the dashboard's three collapsed sections and the hidden
// first-panel trajectory.
//
// WHAT THIS FILE REFUSES TO DO: assert that a string is present in
// dashboard.html. Text presence is not wiring. "See more details" appearing in
// the file proves a label was typed, not that a toggle renders it, and an
// assertion that why_this_matters is "absent from the card face" is satisfied by
// deleting the paragraph entirely -- the one outcome nobody wants.
//
// So every assertion below EXECUTES the shipped render. The mapper source is cut
// out of the file, compiled with new Function, handed stub dependencies and a
// synthetic payload, and the returned HTML is what gets asserted. If the template
// changes shape, the extraction fails loudly rather than the assertion passing
// for the wrong reason. renderLongitudinal is executed whole against a fake DOM.
//
// The payload is SYNTHETIC throughout: invented marker names, invented copy, and
// values that are not lab values. No real panel is read.
//
//   node scripts/test-density-collapse.mjs      (or DASH=path/to/dashboard.html)
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

console.log("density collapse");

ok("extraction control: JS found, and less than the whole file",
  HTML.length > 10000 && HTML.length < RAW.length);

// ---------------------------------------------------------------------------
// THE STRIPPER MUST RUN BEFORE THE CUTTER, and this is not tidiness.
//
// Observed on the first run of this file, as a throw rather than a silent pass:
// the priority mapper contains the comment "resolve the marker's system via
// chipSysByMarker". That lone apostrophe opens a quote the brace-counter never
// closes, so it skipped every brace after it and walked off the end of the file
// reporting "unbalanced". Same family as the trap documented in
// test-scan-handoff.mjs, and it is why comments come out first.
//
// Line-based, lifted from that file's proven form: a full-line comment is
// dropped; on a code line a trailing "//" is cut only when it is not the "://" of
// a URL and not inside a string literal on that line. Controls below.
// ---------------------------------------------------------------------------
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
ok("stripper control A: it removes a real comment line",
  HTML.includes("// DENSITY_COLLAPSE_V1") && !CODE.includes("// DENSITY_COLLAPSE_V1"));
ok("stripper control B: it leaves ordinary code intact",
  CODE.includes("function renderLongitudinal(p){"));
ok("stripper control C: the apostrophe comment that broke the cutter really was there",
  /\/\/ SENSITIVE GUARD: resolve the marker's system/.test(HTML));
ok("stripper control D: and it is gone from CODE",
  !/resolve the marker's system/.test(CODE));
ok("stripper control E: line count is preserved, so nothing is silently merged",
  CODE.split("\n").length === HTML.split("\n").length);

// ---------------------------------------------------------------------------
// THE CUTTER, and its controls. Brace-counting from an anchor that ENDS with the
// opening character. A miscount returns a truncated body that will not compile,
// so the failure is a throw, never a silent pass.
// ---------------------------------------------------------------------------
function cutAfter(src, anchor, openChar, closeChar) {
  const start = src.indexOf(anchor);
  if (start < 0) throw new Error("anchor not found: " + anchor);
  let i = start + anchor.length - 1;          // sits on the opening brace/paren
  let depth = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i], prev = src[i - 1];
    if (q) { if (c === q && prev !== "\\") q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === openChar) depth++;
    else if (c === closeChar) { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced from anchor: " + anchor);
}

// cutter control: a shape with a NESTED close, so stopping at the first one fails.
const cutterProbe = cutAfter("zz f(a,(b),c) tail)", "f(", "(", ")");
ok("cutter control: it stops at the MATCHING close, not the first or the last",
  cutterProbe === "f(a,(b),c)");
ok("cutter control: it throws when the braces never balance", (() => {
  try { cutAfter("f(a,(b)", "f(", "(", ")"); return false; } catch { return true; }
})());
ok("cutter control: it throws on a missing anchor", (() => {
  try { cutAfter("abc", "nope", "(", ")"); return false; } catch { return true; }
})());

// ---------------------------------------------------------------------------
// STUBS. Deliberately dumb: they must not be able to manufacture a pass.
// esc is identity-with-escaping so asserted copy survives verbatim.
// ---------------------------------------------------------------------------
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const markerName = (m) => (m && (m.display_name || m.marker_id)) || "";
const sysStatus = () => ({ cls: "s-good", label: "Looks good" });
const toneFor = () => "t-coral";
const SENSITIVE_SYSTEMS = new Set(["heavy_metals", "autoimmune", "tumor_markers"]);
const lookupRange = () => null;              // no range -> name only, exercised below
const healthyRangeText = () => "";
const foundPipe = (t) => String(t == null ? "" : t);

// THE LABELS ARE READ OUT OF THE PAGE, not restated here, and that distinction
// earned itself. A first version declared them locally and fed those to the
// render; reverting the shipped constant to the old "See the detail" then failed
// exactly ONE assertion, the literal pin, while every render assertion sailed
// through green on the stub. The render was being asked about this file's idea of
// the label rather than the page's. Now the shipped values drive the render, so a
// label change reddens the renders too, and the literal pin below is the separate
// question of whether the ratified copy is still what ships.
const shipped = (name) => {
  const m = HTML.match(new RegExp("const " + name + " = \\{[^}]*\\}"));
  if (!m) throw new Error("shipped constant not found: " + name);
  return new Function("return " + m[0].replace("const " + name + " = ", "") + ";")();
};
const PRIO_TOGGLE_LABEL = shipped("PRIO_TOGGLE_LABEL");
// PRIO_ART_V1 — the card callback calls prioArtSVG for its drawing. Stubbed here the same way
// toneFor is, because the drawing is not what this file asserts: scripts/test-prio-art.mjs
// executes the real one and scripts/test-dashboard-e2e.mjs renders it in a browser.
const prioArtSVG = () => "";
// MARKER_BAND_V3 — the legend markup is read out of the page, not restated here.
const BAND_LEGEND_HTML = new Function(
  "return " + (CODE.match(/const BAND_LEGEND_HTML = ([\s\S]*?);\n/) || [])[1] + ";")();
const MORE_TOGGLE_LABEL = shipped("MORE_TOGGLE_LABEL");
ok("label-source control: both constants were read out of the page, not defaulted",
  typeof PRIO_TOGGLE_LABEL.closed === "string" && typeof MORE_TOGGLE_LABEL.closed === "string");
// CHANGED 2026-09-23 with PRIO_TOGGLE_RIGHT_V1. The pair was ratified as
// {"See more details","Hide details"} and is now {"See more","Hide"}, shortened on the founder's
// explicit instruction because the expander moved to a right-hand column beside the headline and
// the long pair crowded it. The assertion is kept, not dropped, so the pair is still pinned and
// still named -- reversing the copy means editing this line and the constant, nothing else.
eq("shipped priority labels are the ratified pair", JSON.stringify(PRIO_TOGGLE_LABEL),
  '{"closed":"See more","open":"Hide"}');
eq("shipped shared labels are the ratified pair", JSON.stringify(MORE_TOGGLE_LABEL),
  '{"closed":"See more","open":"See less"}');

// ---------------------------------------------------------------------------
// SYNTHETIC PAYLOAD. Invented throughout.
// ---------------------------------------------------------------------------
const WHY = "SENTINEL_WHY_THIS_MATTERS_ZQ";
const CONN = "SENTINEL_THE_CONNECTION_ZQ";
const HEADLINE = "SENTINEL_HEADLINE_ZQ";
const CHIPNAME = "Sentinel Marker";
const priority = {
  rank: 1, headline: HEADLINE, system_id: "metabolic",
  primary_markers: [{ marker_id: "sentinel_marker", display_name: CHIPNAME, value: 7, unit: "u/L" }],
  why_this_matters: WHY,
  the_connection: CONN,
  action_layer: { primary_lever: "SENTINEL_LEVER_ZQ" },
  trajectory_promise: "SENTINEL_PROMISE_ZQ",
};
const chipSysByMarker = { sentinel_marker: "metabolic" };
// MARKER_BAND_V1 added two dependencies to this mapper: a marker_id -> value map
// and markerBandHTML. They are injected here rather than stubbed away so this
// suite keeps exercising the REAL template; a stub that returned "" would let the
// band regress while these assertions stayed green. The band's own behaviour is
// asserted in test-band-nav-centring.mjs, so this file only has to let it run.
const chipValByMarker = { sentinel_marker: 7 };
// MARKER_BAND_V3 — the Tier 2 pad constant is READ OUT OF THE PAGE, never restated here. A
// number typed into this file is a second definition and would agree with itself forever.
const BAND_FALLBACK_PAD_K = Number(CODE.match(/const BAND_FALLBACK_PAD_K = ([0-9.]+)/)[1]);
const markerBandGeometry = new Function("BAND_FALLBACK_PAD_K",
  "return " + cutAfter(CODE, "function markerBandGeometry(ref, value){", "{", "}") + ";")(BAND_FALLBACK_PAD_K);
// The note table and its renderer are compiled TOGETHER, in one scope, so the table the page
// ships is the one the assertions read. Copying the strings into this file would be the second
// definition the ruled copy exists to avoid.
const bandZoneNoteHTML = new Function(
  "return (function(){\n" +
  cutAfter(CODE, "const BAND_ZONE_NOTE = {", "{", "}") + ";\n" +
  cutAfter(CODE, "function bandZoneNoteHTML(g){", "{", "}") + ";\n" +
  "return bandZoneNoteHTML; })();")();
const markerBandHTML = new Function("esc", "markerBandGeometry", "bandZoneNoteHTML",
  "return " + cutAfter(CODE, "function markerBandHTML(ref, value){", "{", "}") + ";")(esc, markerBandGeometry, bandZoneNoteHTML);
// MARKER_BAND_V2 added a consistency check to the priority mapper. It is injected REAL, not
// stubbed to false: a stub would let the check regress while these assertions stayed green. Its
// own behaviour is asserted in test-band-nav-centring.mjs; this file only has to let it run.
// BAND_FAMILY_GENERATED_V1 — the family is no longer a regex in the page, it is the
// band_family_optimal array in ranges-slim.json. The REAL generated file is loaded and the REAL
// classifier is compiled against it; a hand-written six-word list here would be the second
// definition this change exists to delete.
const RANGES_SLIM = JSON.parse(readFileSync(process.env.RANGES || "ranges-slim.json", "utf8"));
const isOptimalBandWord = new Function("RANGES_LOOKUP",
  "return " + cutAfter(CODE, "function isOptimalBandWord(band){", "{", "}") + ";")(RANGES_SLIM);
const bandContradictsEngine = new Function("markerBandGeometry", "isOptimalBandWord",
  "return " + cutAfter(CODE, "function bandContradictsEngine(ref, value, band){", "{", "}") + ";"
)(markerBandGeometry, isOptimalBandWord);

// ---------------------------------------------------------------------------
// 1. THE PRIORITY CARD, executed.
// ---------------------------------------------------------------------------
const prioSrc = cutAfter(CODE, '$("prios").innerHTML = pr.map((x,i)=>{', "{", "}");
const prioArrow = prioSrc.slice(prioSrc.indexOf("(x,i)=>"));
const prioFn = new Function(
  "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
  "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
  "markerBandHTML", "bandContradictsEngine", "PRIO_TOGGLE_LABEL", "prioArtSVG",
  "markerBandGeometry", "BAND_LEGEND_HTML",
  "return " + prioArrow + ";"
)(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
  chipSysByMarker, chipValByMarker, lookupRange, healthyRangeText,
  markerBandHTML, bandContradictsEngine, PRIO_TOGGLE_LABEL, prioArtSVG,
  markerBandGeometry, BAND_LEGEND_HTML);

const card = prioFn(priority, 0);
ok("priority render control: it produced a .prio card at all", /class="prio /.test(card));

const face = card.slice(0, card.indexOf('<div class="prio-detail">'));
const detail = card.slice(card.indexOf('<div class="prio-detail">'));
ok("split control: both halves are non-empty and detail really is the tail",
  face.length > 50 && detail.length > 50 && card === face + detail);

ok("collapsed face carries the headline", face.includes(HEADLINE));
ok("collapsed face carries the marker chip", face.includes(CHIPNAME) && face.includes('class="chip'));
ok("collapsed face does NOT carry why_this_matters", !face.includes(WHY));
ok("why_this_matters is in .prio-detail", detail.includes(WHY));
ok("why_this_matters LEADS the detail, before the_connection",
  detail.indexOf(WHY) < detail.indexOf(CONN));
ok("the paragraph was MOVED, not deleted: it appears exactly once in the card",
  (card.match(new RegExp(WHY, "g")) || []).length === 1);
ok("it is still wrapped in .prio-finding, not stripped to bare text",
  detail.includes('<div class="prio-finding">' + WHY + "</div>"));

ok("the toggle renders with the collapsed label",
  face.includes('<span class="prio-toggle-label">See more</span>'));
ok("the toggle starts closed",
  face.includes('class="prio-toggle" type="button" aria-expanded="false"'));
ok("the chevron survived the label span (it is a sibling, not overwritten)",
  face.includes('<span class="prio-chev">'));

// A priority whose ONLY detail is why_this_matters must still get a toggle --
// otherwise moving the paragraph would make it unreachable.
const bare = prioFn({ rank: 2, headline: HEADLINE, primary_markers: [], why_this_matters: WHY }, 1);
ok("a priority with why_this_matters and nothing else STILL gets a toggle",
  bare.includes('class="prio-toggle"') && bare.includes(WHY));
// control: the same card with no why_this_matters and no other detail gets none.
const empty = prioFn({ rank: 3, headline: HEADLINE, primary_markers: [] }, 2);
ok("toggle control: a priority with no detail at all gets NO toggle",
  !empty.includes('class="prio-toggle"') && empty.includes(HEADLINE));

// C1(c): the sensitive override still forces s-none, untouched by this commit.
const sens = prioFn({
  rank: 1, headline: HEADLINE, why_this_matters: WHY,
  primary_markers: [{ marker_id: "sentinel_metal", display_name: "Sentinel Metal", value: 1 }],
}, 0);
ok("sensitive guard intact: an UNMAPPED marker still renders s-none",
  sens.includes('class="chip s-none"'));
ok("sensitive-guard control: a MAPPED non-sensitive marker does not get s-none",
  card.includes('class="chip s-good"'));

// ---------------------------------------------------------------------------
// 2. THE GOING-RIGHT CARD, executed.
// ---------------------------------------------------------------------------
const FIND = "SENTINEL_FINDING_ZQ", IMPL = "SENTINEL_IMPLICATION_ZQ";
// Anchor on the "(" itself so the cutter has an opening character to count from,
// then peel the wrapper. Anchoring on "x=>" put the scanner on ">" and it never
// opened -- which surfaced as a SyntaxError from new Function, not as a pass.
const quietSrc = cutAfter(CODE, '$("quiet").innerHTML = q.map(', "(", ")");
const quietArrow = quietSrc.slice(quietSrc.indexOf("(", quietSrc.indexOf("q.map")) + 1, -1);
ok("quiet extraction control: it cut an arrow function, not a fragment",
  /^\s*x\s*=>/.test(quietArrow));
const quietFn = new Function("esc", "MORE_TOGGLE_LABEL", "return " + quietArrow + ";")(esc, MORE_TOGGLE_LABEL);

const qcard = quietFn({ finding: FIND, implication: IMPL });
ok("going-right render control: it produced a .quiet card", /class="quiet"/.test(qcard));
ok("the headline is present and outside any detail wrapper",
  qcard.includes('<div class="quiet-title">' + FIND + "</div>"));
ok("the implication is present in full, not truncated",
  qcard.includes('<div class="quiet-note">' + IMPL + "</div>"));
ok("a disclosure control renders", qcard.includes('class="quiet-toggle"'));
ok("it carries the shared collapsed label",
  qcard.includes('<span class="quiet-toggle-label">See more</span>'));
ok("it starts closed", qcard.includes('aria-expanded="false"'));
const qbare = quietFn({ finding: FIND });
ok("no implication -> NO toggle, so the control is never dead",
  !qbare.includes("quiet-toggle") && qbare.includes(FIND));

// THE CLAMP is CSS, and it is the collapsed state, so it must sit on .quiet-note
// itself with .quiet.open releasing it. Asserted on RAW because it is a stylesheet
// rule, with a control proving the matcher can fire.
ok("the clamped element is .quiet-note and it is clamped to two lines",
  /\.quiet-note\{[^}]*-webkit-line-clamp:2[^}]*\}/.test(RAW));
ok("the clamp rule carries every declaration it needs to take effect",
  /\.quiet-note\{[^}]*display:-webkit-box[^}]*\}/.test(RAW) &&
  /\.quiet-note\{[^}]*-webkit-box-orient:vertical[^}]*\}/.test(RAW) &&
  /\.quiet-note\{[^}]*overflow:hidden[^}]*\}/.test(RAW));
ok("opening the card releases the clamp",
  /\.quiet\.open \.quiet-note\{[^}]*-webkit-line-clamp:none[^}]*\}/.test(RAW));
ok("clamp-matcher control: the same matcher finds NO clamp on .quiet-title",
  !/\.quiet-title\{[^}]*-webkit-line-clamp/.test(RAW));

// ---------------------------------------------------------------------------
// 3. THE FOUNDATIONS LEVER, executed.
// ---------------------------------------------------------------------------
const NAME = "SENTINEL_LEVER_NAME_ZQ", ACT = "SENTINEL_ACTION_ZQ", LCONN = "SENTINEL_LEVER_CONN_ZQ";
const leverSrc = cutAfter(CODE, '$("found-levers").innerHTML = levers.map(lv=>{', "{", "}");
const leverArrow = leverSrc.slice(leverSrc.indexOf("lv=>"));
const leverFn = new Function("foundPipe", "rankById", "MORE_TOGGLE_LABEL", "return " + leverArrow + ";")(
  foundPipe, { p1: 1 }, MORE_TOGGLE_LABEL);

const lev = leverFn({ display_name: NAME, action: ACT, connection: LCONN, appears_in_priority_ids: ["p1"] });
ok("lever render control: it produced a .lever card", /class="lever"/.test(lev));
const lface = lev.slice(0, lev.indexOf('<div class="lever-detail">'));
const ldet = lev.slice(lev.indexOf('<div class="lever-detail">'));
ok("lever split control: both halves non-empty and they reassemble",
  lface.length > 20 && ldet.length > 20 && lev === lface + ldet);
ok("the collapsed lever keeps its name", lface.includes(NAME));
ok("the collapsed lever keeps its action", lface.includes(ACT));
ok("the connection is behind the disclosure", !lface.includes(LCONN) && ldet.includes(LCONN));
ok("the relates cross-reference is behind the disclosure too",
  !lface.includes("lever-relates") && ldet.includes("lever-relates"));
ok("the lever toggle carries the shared collapsed label",
  lface.includes('<span class="lever-toggle-label">See more</span>'));

// Deploy B's fallback: with no action, the connection IS the primary line and
// must stay on the face, or the card collapses to a bare noun.
const levNoAction = leverFn({ display_name: NAME, connection: LCONN, appears_in_priority_ids: [] });
ok("no action -> the connection stays on the FACE, not hidden",
  levNoAction.includes(LCONN) && !levNoAction.includes("lever-detail"));
ok("no-action control: that card really does lack an action line",
  !levNoAction.includes("lever-action"));

ok("the lever detail hides by default and opens on .open",
  /\.lever-detail\{[^}]*display:none[^}]*\}/.test(RAW) &&
  /\.lever\.open \.lever-detail\{[^}]*display:block[^}]*\}/.test(RAW));

// THE GRID IS NOT CHANGED by this commit.
ok("the foundations grid is untouched: still 2-up with align-items:start",
  /\.found-levers\{display:grid;grid-template-columns:repeat\(2,1fr\);gap:12px;align-items:start\}/.test(RAW));
ok("and still drops to 1-up only below 600px",
  /@media\(max-width:600px\)\{\.found-levers\{grid-template-columns:1fr\}/.test(RAW));

// ---------------------------------------------------------------------------
// 4. wireDisclosures, executed against a fake DOM.
//    This is what pins reset-to-closed and per-card independence.
// ---------------------------------------------------------------------------
function fakeEl(cls) {
  const classes = new Set(String(cls || "").split(" ").filter(Boolean));
  return {
    _attrs: {}, _kids: [], _label: null,
    classList: {
      add: (c) => classes.add(c), remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c) => (classes.has(c) ? (classes.delete(c), false) : (classes.add(c), true)),
    },
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return this._attrs[k]; },
    querySelector(sel) {
      if (sel.startsWith("[class$=")) return this._label;
      return this._kids.find((k) => k._sel === sel) || null;
    },
    onclick: null,
  };
}
function fakeCard() {
  const c = fakeEl("prio open");            // deliberately STARTS OPEN
  const label = fakeEl(); label.textContent = "STALE_LABEL";
  const tog = fakeEl(); tog._sel = ".prio-toggle"; tog._label = label;
  c._kids = [tog]; c._tog = tog; c._label = label;
  return c;
}
const wireSrc = cutAfter(CODE, "function wireDisclosures(host, cardSel, togSel, labels){", "{", "}");
const wireDisclosures = new Function("return " + wireSrc.replace(/^function /, "function ") + ";")();
ok("wireDisclosures extraction control: it compiled to a function",
  typeof wireDisclosures === "function");

const cardA = fakeCard(), cardB = fakeCard();
const host = { querySelectorAll: () => [cardA, cardB] };
wireDisclosures(host, ".prio", ".prio-toggle", PRIO_TOGGLE_LABEL);

ok("every card is reset to CLOSED on render", !cardA.classList.contains("open") && !cardB.classList.contains("open"));
eq("aria-expanded is reset too", cardA._tog.getAttribute("aria-expanded"), "false");
// These five read the SHIPPED pair rather than restating it. They were five hand-typed copies
// of "See more details" / "Hide details", and every one of them went red when the pair was
// shortened -- five failures for one copy decision already pinned, deliberately, at :156.
// What this block is actually about is the WIRING: reset, swap, independence, re-render.
eq("the label is reset to the collapsed string", cardA._label.textContent, PRIO_TOGGLE_LABEL.closed);

cardA._tog.onclick();
eq("opening one card swaps its label to the open string", cardA._label.textContent, PRIO_TOGGLE_LABEL.open);
eq("and sets aria-expanded true", cardA._tog.getAttribute("aria-expanded"), "true");
ok("the card carries .open", cardA.classList.contains("open"));
ok("INDEPENDENCE: the sibling card stayed closed", !cardB.classList.contains("open"));
eq("and the sibling's label did not move", cardB._label.textContent, PRIO_TOGGLE_LABEL.closed);

cardA._tog.onclick();
eq("closing it again restores the collapsed label", cardA._label.textContent, PRIO_TOGGLE_LABEL.closed);
eq("and aria-expanded false", cardA._tog.getAttribute("aria-expanded"), "false");

// Re-running the wiring on an open card must close it: that is the panel-switch case.
cardA._tog.onclick();
ok("precondition: the card is open again", cardA.classList.contains("open"));
wireDisclosures(host, ".prio", ".prio-toggle", PRIO_TOGGLE_LABEL);
ok("RE-RENDER resets an open card back to closed", !cardA.classList.contains("open"));
eq("and its label back to collapsed", cardA._label.textContent, PRIO_TOGGLE_LABEL.closed);

// all three sections go through this one helper
eq("all three sections are wired through the SAME helper",
  (HTML.match(/wireDisclosures\(\$\(/g) || []).length, 3);

// ---------------------------------------------------------------------------
// 5. renderLongitudinal, executed against a fake DOM.
// ---------------------------------------------------------------------------
const longiSrc = cutAfter(CODE, "function renderLongitudinal(p){", "{", "}");
function longiEnv() {
  const nodes = {};
  const mk = (id) => (nodes[id] = nodes[id] || (() => {
    const e = fakeEl(); e.id = id; e.innerHTML = ""; e.textContent = "";
    e.classList.add("hidden");
    e.querySelectorAll = () => [];
    return e;
  })());
  // $ AUTO-CREATES. An enumerated list of ids meant that adding a node to the
  // trends page made this harness throw on a null, which reads as a broken test
  // rather than a broken render. The nodes that matter are asserted by name below.
  return { nodes, $: (id) => mk(id) };
}
function runLongi(payload) {
  const env = longiEnv();
  const fn = new Function(
    "$", "window", "esc", "fmtPanelDate", "longiPreviewRow", "longiOverview",
    "longiRow", "openTrendsView", "closeTrendsView", "renderFirstPanelTrajectory",
    "return " + longiSrc + ";"
  )(env.$, { __rdPayload: { panel_date: "2026-09-01" } }, esc,
    (d) => String(d), () => "<div></div>", () => "overview", () => "<div></div>",
    () => {}, () => {}, () => { throw new Error("renderFirstPanelTrajectory must NOT be called"); });
  fn(payload);
  return env.nodes;
}

ok("renderLongitudinal extraction control: it compiled",
  /^function renderLongitudinal/.test(longiSrc));

// FIRST PANEL: no longitudinal block at all.
const n1 = runLongi({});
ok("first panel (no longitudinal): the wrap is HIDDEN", n1["longi-wrap"].classList.contains("hidden"));
// FIRST PANEL: longitudinal present but no baseline date.
const n2 = runLongi({ longitudinal: { persistent_open: [], resolved: [], newly_crossed: [], counts: {} } });
ok("first panel (no baseline_panel_date): the wrap is HIDDEN", n2["longi-wrap"].classList.contains("hidden"));
ok("and the first-panel card is NOT rendered", n2["longi-firstpanel"].innerHTML === "");

// SECOND PANEL: a baseline exists and something moved -> it renders.
const n3 = runLongi({
  longitudinal: {
    baseline_panel_date: "2026-06-01",
    persistent_open: [{ marker_id: "sentinel_marker" }],
    resolved: [], newly_crossed: [], counts: { resolved: 0, steady_healthy: 0 },
  },
});
ok("second panel with movement: the wrap is SHOWN", !n3["longi-wrap"].classList.contains("hidden"));
ok("second-panel control: it actually populated the preview", n3["longi-preview"].innerHTML.length > 0);

// SECOND PANEL, nothing moved -> still hidden, and that is the PRE-EXISTING
// behaviour, not this commit's. Kept so the two hide paths cannot be confused.
const n4 = runLongi({
  longitudinal: {
    baseline_panel_date: "2026-06-01",
    persistent_open: [], resolved: [], newly_crossed: [], counts: {},
  },
});
ok("second panel, nothing moved: still hidden (pre-existing State 2)",
  n4["longi-wrap"].classList.contains("hidden"));

// renderFirstPanelTrajectory is KEPT for the second-panel work, and unreferenced.
ok("renderFirstPanelTrajectory is still defined",
  /\nfunction renderFirstPanelTrajectory\(/.test(HTML));
eq("and it is called from nowhere",
  (HTML.split("\n").filter((l) =>
    l.includes("renderFirstPanelTrajectory") &&
    !/^\s*(\/\/|\*)/.test(l) &&
    !/^function renderFirstPanelTrajectory/.test(l)).length), 0);

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
