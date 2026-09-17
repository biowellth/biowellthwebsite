#!/usr/bin/env node
// Part two: the marker position band (MARKER_BAND_V1), the reveal centring
// (REVEAL_CENTRING_V1) and the Ask Sana top bar entry (ASK_SANA_NAV_V1).
//
// EXECUTES THE SHIPPED CODE. Every behavioural assertion compiles the real
// function out of dashboard.html and calls it. Asserting that a string appears
// in the file would pass for a band nobody renders and for a handler nobody
// attaches, which is the whole failure this file is written against.
//
// The CSS assertions are the exception and they are honest about it: a
// stylesheet rule has no function to call, so they match the rule text with a
// control proving the same matcher finds a rule that is genuinely there.
//
//   node scripts/test-band-nav-centring.mjs      (or DASH=path/to/dashboard.html)
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

console.log("band, nav and centring");

ok("extraction control: JS found, and less than the whole file",
  HTML.length > 10000 && HTML.length < RAW.length);

// ---------------------------------------------------------------------------
// THE STRIPPER, WITH ITS OWN CONTROLS. Comments come out before any brace
// counting, because an apostrophe inside a comment ("the marker's system")
// opens a quote the counter never closes and it then walks off the end of the
// file reporting "unbalanced". That happened on the first run of the sibling
// suite and is the reason this runs first here.
// ---------------------------------------------------------------------------
function stripComments(src) {
  const out = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) { out.push(""); continue; }
    let cut = -1;
    for (let i = 1; i < line.length - 1; i++) {
      if (line[i] !== "/" || line[i + 1] !== "/") continue;
      if (line[i - 1] === ":") continue;                        // https://
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
  HTML.includes("// ASK_SANA_NAV_V1") && !CODE.includes("// ASK_SANA_NAV_V1"));
ok("stripper control B: it leaves ordinary code intact",
  CODE.includes("function markerBandHTML(ref, value){"));
ok("stripper control C: an apostrophe-bearing comment really is present",
  /\/\/.*\b\w+'s\b/.test(HTML));
ok("stripper control D: no apostrophe-bearing comment survives into CODE",
  !/\/\/.*\b\w+'s\b/.test(CODE));
ok("stripper control E: line count preserved, so nothing is silently merged",
  CODE.split("\n").length === HTML.split("\n").length);

// ---------------------------------------------------------------------------
// THE CUTTER. Anchors END with the opening character, because an anchor ending
// in ">" (as in "q.map(x=>") leaves the scanner sitting on ">" and it never
// opens, which surfaces as a SyntaxError from new Function rather than a pass.
// ---------------------------------------------------------------------------
function cutAfter(src, anchor, openChar, closeChar) {
  const start = src.indexOf(anchor);
  if (start < 0) throw new Error("anchor not found: " + anchor);
  let i = start + anchor.length - 1, depth = 0, q = null;
  for (; i < src.length; i++) {
    const c = src[i], prev = src[i - 1];
    if (q) { if (c === q && prev !== "\\") q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === openChar) depth++;
    else if (c === closeChar) { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced from anchor: " + anchor);
}
ok("cutter control: stops at the MATCHING close, not the first or the last",
  cutAfter("zz f(a,(b),c) tail)", "f(", "(", ")") === "f(a,(b),c)");
ok("cutter control: throws when the braces never balance", (() => {
  try { cutAfter("f(a,(b)", "f(", "(", ")"); return false; } catch { return true; }
})());
ok("cutter control: throws on a missing anchor", (() => {
  try { cutAfter("abc", "nope", "(", ")"); return false; } catch { return true; }
})());
ok("cutter control: an anchor ending in '>' would NOT open the counter", (() => {
  try { cutAfter("q.map(x=> 1 )", "q.map(x=>", "(", ")"); return false; } catch { return true; }
})());

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ===========================================================================
// 1. THE BAND, executed.
// ===========================================================================
const bandSrc = cutAfter(CODE, "function markerBandHTML(ref, value){", "{", "}");
const markerBandHTML = new Function("esc", "return " + bandSrc + ";")(esc);
ok("band extraction control: it compiled to a function",
  typeof markerBandHTML === "function");

const two = markerBandHTML({ low: 10, high: 20 }, 15);
ok("band renders with two bounds and a numeric value", two.includes('class="mk-band"'));
ok("it draws a track", two.includes('class="mk-band-track"'));
ok("it draws a dot", two.includes('class="mk-band-dot"'));
ok("both bounds are labelled with their numbers", two.includes(">10<") && two.includes(">20<"));
ok("the track is captioned 'functional range' and nothing else",
  two.includes(">functional range<"));

// midpoint -> 50%
ok("a mid-range value sits at the midpoint", two.includes("left:50.0%"));
// clamp, both directions
ok("a value far BELOW the range clamps to the low end, still visible",
  markerBandHTML({ low: 10, high: 20 }, -500).includes("left:4.0%"));
ok("a value far ABOVE the range clamps to the high end, still visible",
  markerBandHTML({ low: 10, high: 20 }, 5000).includes("left:96.0%"));
ok("clamp control: an in-range value is NOT clamped",
  markerBandHTML({ low: 0, high: 100 }, 73).includes("left:73.0%"));

// NOT drawn
eq("no band with only a low bound", markerBandHTML({ low: 10, high: null }, 15), "");
eq("no band with only a high bound", markerBandHTML({ low: null, high: 20 }, 15), "");
eq("no band with no bounds at all", markerBandHTML({ low: null, high: null }, 15), "");
eq("no band with a null ref", markerBandHTML(null, 15), "");
eq("no band with a non-numeric value", markerBandHTML({ low: 10, high: 20 }, "positive"), "");
eq("no band with an absent value", markerBandHTML({ low: 10, high: 20 }, undefined), "");
eq("no band when the bounds are inverted", markerBandHTML({ low: 20, high: 10 }, 15), "");

// NO VERDICT, checked ONE WORD AT A TIME so a red names the offender.
const VERDICT = ["high", "low", "normal", "optimal", "good", "bad", "flag", "watch",
  "elevated", "deficient", "critical", "healthy", "abnormal", "concern", "risk", "poor"];
const bandText = markerBandHTML({ low: 10, high: 20 }, 15).toLowerCase();
for (const w of VERDICT) {
  ok("no verdict word in the band markup: " + w, !bandText.includes(w));
}
ok("verdict-scan control: the scanner DOES fire on a planted word",
  (bandText + " optimal").includes("optimal"));
ok("the band carries no colour class that could encode a verdict",
  !/s-good|s-watch|s-flag|s-ref/.test(bandText));
ok("the band is marked decorative for assistive tech",
  markerBandHTML({ low: 10, high: 20 }, 15).includes('aria-hidden="true"'));

// ===========================================================================
// 2. THE BAND ON THE PRIORITY PATH, executed, including the sensitive guard.
// ===========================================================================
const prioSrc = cutAfter(CODE, '$("prios").innerHTML = pr.map((x,i)=>{', "{", "}");
const prioArrow = prioSrc.slice(prioSrc.indexOf("(x,i)=>"));
const SENSITIVE_SYSTEMS = new Set(["heavy_metals", "autoimmune", "tumor_markers"]);
const markerName = (m) => (m && (m.display_name || m.marker_id)) || "";
const sysStatus = () => ({ cls: "s-good", label: "Looks good" });
const toneFor = () => "t-coral";
const healthyRangeText = (ref) => (ref && ref.low != null && ref.high != null)
  ? ("Healthy " + ref.low + " to " + ref.high) : "";
const PRIO_TOGGLE_LABEL = { closed: "See more details", open: "Hide details" };

function renderPriority({ sysId, ref, value }) {
  const chipSysByMarker = { m1: sysId };
  const chipValByMarker = value === undefined ? {} : { m1: value };
  const lookupRange = () => ref;
  const fn = new Function(
    "esc", "markerName", "sysStatus", "toneFor", "SENSITIVE_SYSTEMS",
    "chipSysByMarker", "chipValByMarker", "lookupRange", "healthyRangeText",
    "markerBandHTML", "PRIO_TOGGLE_LABEL", "return " + prioArrow + ";"
  )(esc, markerName, sysStatus, toneFor, SENSITIVE_SYSTEMS,
    chipSysByMarker, chipValByMarker, lookupRange, healthyRangeText,
    markerBandHTML, PRIO_TOGGLE_LABEL);
  return fn({
    rank: 1, headline: "SENTINEL_HEADLINE",
    primary_markers: [{ marker_id: "m1", display_name: "Sentinel Marker" }],
    why_this_matters: "SENTINEL_WHY",
  }, 0);
}

const okCard = renderPriority({ sysId: "metabolic", ref: { low: 10, high: 20 }, value: 15 });
ok("priority render control: it produced a .prio card", /class="prio /.test(okCard));
ok("a non-sensitive marker with two bounds and a value DRAWS the band",
  okCard.includes('class="mk-band"'));
ok("and the range sentence is still there beside it",
  okCard.includes("prio-mk-range"));

for (const sid of ["heavy_metals", "autoimmune", "tumor_markers"]) {
  const c = renderPriority({ sysId: sid, ref: { low: 10, high: 20 }, value: 15 });
  ok("SENSITIVE: " + sid + " draws NO band", !c.includes('class="mk-band"'));
  ok("SENSITIVE: " + sid + " draws no range sentence either", !c.includes("prio-mk-range"));
}
ok("sensitive control: an UNMAPPED system also draws no band",
  !renderPriority({ sysId: undefined, ref: { low: 10, high: 20 }, value: 15 }).includes('class="mk-band"'));
ok("sensitive control: the SAME fixture on a mapped system DOES draw one",
  okCard.includes('class="mk-band"'));

ok("one bound on the priority path draws no band",
  !renderPriority({ sysId: "metabolic", ref: { low: 10, high: null }, value: 15 }).includes('class="mk-band"'));
ok("no value on the priority path draws no band",
  !renderPriority({ sysId: "metabolic", ref: { low: 10, high: 20 }, value: undefined }).includes('class="mk-band"'));

// The value must come from the systems map, never from the primary_marker,
// which measurably does not carry one.
ok("the band reads the value from chipValByMarker, not pm.value",
  CODE.includes("markerBandHTML(ref, chipValByMarker[pm.marker_id])"));
ok("value-source control: chipValByMarker is built from p.systems markers",
  /chipValByMarker\[m\.marker_id\] = m\.value/.test(CODE));

// ===========================================================================
// 3. THE REVEAL CENTRING. CSS, so matched as text, with controls.
// ===========================================================================
ok("the reveal card still centres with the safe keyword",
  /#view-reveal \.card\{[^}]*justify-content:safe center/.test(RAW));
eq("NO height-keyed media query survives anywhere in the file",
  (RAW.match(/@media\(max-height/g) || []).length, 0);
ok("flex-start is not forced on the reveal card at any height",
  !/#view-reveal \.card\{justify-content:flex-start\}/.test(RAW));
ok("centring-matcher control: the same matcher finds a rule that IS there",
  /#view-reveal \.card\{[^}]*overflow-y:auto/.test(RAW));
ok("media-query control: the file DOES still carry other @media rules",
  (RAW.match(/@media/g) || []).length > 5);
ok("the card still scrolls, which is what makes safe centring sufficient",
  /#view-reveal \.card\{[^}]*overflow-y:auto/.test(RAW));
ok("no wrapper was introduced: .stag still keys on direct children",
  /#view-reveal \.card\.active \.stag:nth-child\(1\)/.test(RAW));

// ===========================================================================
// 4. ASK SANA, executed.
// ===========================================================================
ok("the control ships HIDDEN in markup",
  /<button class="btn-ghost hidden" id="btn-sana" type="button"><\/button>/.test(RAW));
ok("and EMPTY in markup, so the label can only come from the render step",
  !/id="btn-sana"[^>]*>[^<]/.test(RAW));
ok("markup control: a sibling control that is NOT empty exists",
  /id="btn-account"[^>]*>Account</.test(RAW));

const shippedLabel = (() => {
  const m = HTML.match(/navLabel:\s*"([^"]*)"/);
  return m ? m[1] : null;
})();
eq("the shipped nav label is the ratified Title Case string", shippedLabel, "Ask Sana");

const entrySrc = cutAfter(CODE, "function renderSanaEntry(){", "{", "}");
const askSrc = cutAfter(CODE, "function askSana(){", "{", "}");

function fakeBtn() {
  const cls = new Set(["btn-ghost", "hidden"]);
  return { textContent: "", onclick: null,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) } };
}
function runEntry({ enabled, inputPresent }) {
  const nav = fakeBtn();
  let invoked = 0;
  const input = inputPresent ? { focus(){}, } : null;
  const $ = (id) => id === "btn-sana" ? nav : id === "sana-input" ? input : null;
  const askSana = () => { invoked++; return true; };
  new Function("$", "SANA_CHAT_ENABLED", "SANA_COPY", "askSana",
    entrySrc + "; renderSanaEntry();")($, enabled, { navLabel: "Ask Sana" }, askSana);
  return { nav, invoked };
}

const on = runEntry({ enabled: true, inputPresent: true });
ok("with the chat mounted the control is revealed", !on.nav.classList.contains("hidden"));
eq("and labelled from the render step", on.nav.textContent, "Ask Sana");
ok("its handler is attached", typeof on.nav.onclick === "function");
eq("THE HANDLER IS NOT INVOKED AT LOAD", on.invoked, 0);
ok("it is a BARE REFERENCE, not an arrow wrapper",
  /nav\.onclick = askSana;/.test(CODE) && !/nav\.onclick = \(\s*\)\s*=>/.test(CODE));

const offFlag = runEntry({ enabled: false, inputPresent: true });
ok("chat flag off -> stays hidden", offFlag.nav.classList.contains("hidden"));
eq("and unlabelled", offFlag.nav.textContent, "");
const offInput = runEntry({ enabled: true, inputPresent: false });
ok("no chat input -> stays hidden, so it never points at nothing",
  offInput.nav.classList.contains("hidden"));

// askSana targets the dashboard card, not a view switch.
let scrolled = 0, focused = 0;
const mount = { scrollIntoView: () => { scrolled++; } };
const inputNode = { focus: () => { focused++; } };
const askSana = new Function("$", askSrc + "; return askSana;")(
  (id) => id === "sana-input" ? inputNode : id === "sana-mount" ? mount : null);
eq("askSana returns true when the input is there", askSana(), true);
eq("it scrolled the dashboard card into view", scrolled, 1);
eq("it focused the input", focused, 1);
ok("it does NOT switch views", !/showView/.test(askSrc));
ok("view-switch control: showView IS used elsewhere in the file",
  /showView\(/.test(CODE));
eq("askSana returns false and does nothing when there is no input",
  new Function("$", askSrc + "; return askSana;")(() => null)(), false);

// ===========================================================================
// 5. THE TOP BAR WRAP.
// ===========================================================================
ok(".topbar-right wraps at EVERY width, not only below 600px",
  /\.topbar-right\{[^}]*flex-wrap:wrap/.test(RAW));
ok(".topbar-inner wraps too, so a wrapped right side is not clipped",
  /\.topbar-inner\{[^}]*flex-wrap:wrap/.test(RAW));
ok(".topbar-inner is min-height, not a fixed height that would clip row two",
  /\.topbar-inner\{[^}]*min-height:60px/.test(RAW) && !/\.topbar-inner\{[^}]*[^-]height:60px/.test(RAW));
ok("wrap-matcher control: the same matcher finds a rule without flex-wrap",
  /\.brand\{[^}]*display:flex/.test(RAW) && !/\.brand\{[^}]*flex-wrap/.test(RAW));
ok("the 600px query no longer duplicates the wrap declarations",
  !/@media\(max-width:600px\)\{[^}]*\.topbar-right\{[^}]*flex-wrap/.test(RAW));
ok("and it still carries the phone-specific padding",
  /@media\(max-width:600px\)\{\s*\.topbar-inner\{row-gap:6px;padding:9px 0\}/.test(RAW));

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
