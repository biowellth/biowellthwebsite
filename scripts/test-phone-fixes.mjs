#!/usr/bin/env node
// PHONE_FIXES_2026-09-21 -- five findings from the first-account walkthrough on an iPhone.
//
// Each section pins ONE fix and is written to fail on a valid-JS mutant of that fix. The
// mutants the suite is built against, all of which parse:
//   F1  any rule applying to an input/select/textarea back under 16px
//   F2  ddcShouldAsk without the reversed-pair comparison
//   F3  onDdcTap without the dismissal timer
//   F4  renderScanEntry not called before renderCompanionChips' early return
//   F5  the reveal toggle without scrollIntoView
//
//   node scripts/test-phone-fixes.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");
const LOGIN = readFileSync(process.env.LOGIN || "login.html", "utf8");
const SRC = extractApp(HTML, FILE);

let pass = 0, fail = 0;
const ok = (c, m) => {
  let v;
  try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  if (v) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); }
};
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ")");

console.log("PHONE_FIXES_2026-09-21");

// ── FIX 1. iOS focus-zoom ────────────────────────────────────────────────────
// iOS Safari zooms the viewport whenever a focused control computes under 16px, and does
// not zoom back out. The assertion is a PROPERTY over every control, not a list of the
// five classes that were wrong on the day, so a sixth control added at 14px fails here.
console.log("\nFIX 1 — no form control renders under 16px");

function controlRulesUnder16(src) {
  const TAGS = "input|select|textarea";
  const ctrls = src.match(new RegExp("<(?:" + TAGS + ")\\b[^>]*>", "g")) || [];
  const classes = new Set(), ids = new Set();
  for (const c of ctrls) {
    const cm = c.match(/class=\\?"([^"\\]+)/);
    if (cm) for (const t of cm[1].split(/\s+/)) if (t) classes.add(t);
    const im = c.match(/id="([^"]+)"/);
    if (im) ids.add(im[1]);
  }
  const bad = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
  for (const c of classes) {
    const re = new RegExp("(?:^|[,\\s}])\\." + esc(c) + "(?=[,{: .\\[])[^{}]*\\{[^}]*?font-size\\s*:\\s*(\\d+(?:\\.\\d+)?)px", "gm");
    let m; while ((m = re.exec(src))) if (parseFloat(m[1]) < 16) bad.push("." + c + " " + m[1] + "px");
  }
  for (const i of ids) {
    const re = new RegExp("#" + esc(i) + "(?=[,{: .\\[])[^{}]*\\{[^}]*?font-size\\s*:\\s*(\\d+(?:\\.\\d+)?)px", "g");
    let m; while ((m = re.exec(src))) if (parseFloat(m[1]) < 16) bad.push("#" + i + " " + m[1] + "px");
  }
  // bare element selectors, e.g. `input{font-size:15px}` — login.html styles every field this way
  const re = new RegExp("(?:^|[,{}\\s])((?:" + TAGS + ")[^{}]{0,80})\\{([^}]*)\\}", "gm");
  let m;
  while ((m = re.exec(src))) {
    const fs = m[2].match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/);
    if (fs && parseFloat(fs[1]) < 16) bad.push(m[1].trim() + " " + fs[1] + "px");
  }
  return { bad, ctrls: ctrls.length };
}

for (const [name, src] of [["dashboard.html", HTML], ["login.html", LOGIN]]) {
  const r = controlRulesUnder16(src);
  ok(r.ctrls > 0, "F1-" + name + "-CONTROL: form controls were located (" + r.ctrls + "), so the check below is not vacuous");
  eq(r.bad.length, 0, "F1-" + name + ": rules under 16px applying to a control" +
     (r.bad.length ? " -> " + r.bad.join(", ") : ""));
}
// The accessible pinch must stay available.
eq((HTML.match(/maximum-scale|user-scalable/g) || []).length, 0, "F1-pinch: dashboard adds no maximum-scale or user-scalable");
eq((LOGIN.match(/maximum-scale|user-scalable/g) || []).length, 0, "F1-pinch: login adds no maximum-scale or user-scalable");
ok(/<meta name="viewport" content="width=device-width/.test(HTML), "F1-viewport-CONTROL: the viewport meta is present, so the two checks above are about a real page");

// ── FIX 2. Date-aware beat ───────────────────────────────────────────────────
console.log("\nFIX 2 — a reversed pair is answered, not asked");
const ctx = { window: { __ddcAnswered: {}, __ddcMountState: {} }, console: { error(){}, log(){} } };
ctx.sb = { functions: { invoke: (...a) => { ctx.__sent = ctx.__sent || []; ctx.__sent.push(a); return Promise.resolve({}); } } };
ctx.globalThis = ctx;
vm.createContext(ctx);
// Only the two beat helpers are needed; running the whole app would need a DOM.
const beat = SRC.match(/function ddcReversedPair[\s\S]*?\n\}\n/);
const send = SRC.match(/function ddcSendAfterDraw[\s\S]*?\n\}\n/);
const should = SRC.match(/function ddcShouldAsk[\s\S]*?\n\}\n/);
ok(!!beat && !!send && !!should, "F2-CONTROL: all three beat functions were located in the app block");
new vm.Script([beat[0], send[0], should[0]].join("\n")).runInContext(ctx);

const REV = { id: "r1", collected_on: "2024-07-25", lmp_date_before_draw: "2026-05-01", cycle_date_provenance: null };
const FWD = { id: "r2", collected_on: "2026-05-01", lmp_date_before_draw: "2024-07-25", cycle_date_provenance: null };
const SAME = { id: "r3", collected_on: "2026-05-01", lmp_date_before_draw: "2026-05-01", cycle_date_provenance: null };

eq(ctx.ddcReversedPair(REV), true, "F2-1: lmp strictly after collected_on is a reversed pair");
eq(ctx.ddcReversedPair(FWD), false, "F2-2: lmp before collected_on is not");
eq(ctx.ddcReversedPair(SAME), false, "F2-3: the same day is not (strictly after, not on-or-after)");
eq(ctx.ddcShouldAsk(REV), false, "F2-4: a reversed pair renders nothing");
eq(ctx.ddcShouldAsk(FWD), true, "F2-5: an ordinary pair is unchanged and still asks");
ok(ctx.window.__ddcAnswered.r1 === "confirmed_after_draw", "F2-6: the reversed pair was stamped confirmed_after_draw");
ok(ctx.window.__ddcAnswered.r2 === undefined, "F2-6-CONTROL: the ordinary pair was NOT stamped, so F2-6 is about the reversal");
const sent = (ctx.__sent || []);
eq(sent.length, 1, "F2-7: exactly one process-report call was made");
if (sent.length) {
  const b = sent[0][1].body;
  eq(b.mode, "submit", "F2-8: it is submit mode");
  eq(b.cycle_date_provenance, "confirmed_after_draw", "F2-9: it carries the after-draw answer");
  ok(!("lmp_date_before_draw" in b), "F2-10: and NO date key, so it cannot become a second writer on the date");
  ok("report_id" in b, "F2-10-CONTROL: the body does carry report_id, so F2-10 is a real absence");
}
ctx.ddcShouldAsk(REV);
eq((ctx.__sent || []).length, 1, "F2-11: a second call for the same report sends nothing (double-send guard)");
// String comparison, never Date parsing: a parsed date-only string shifts a day west of UTC.
ok(!/new Date\(\s*rep\./.test(should[0] + beat[0]), "F2-12: no Date parsing in the comparison");
ok(/String\(rep\.lmp_date_before_draw\) > String\(rep\.collected_on\)/.test(beat[0]), "F2-12-CONTROL: it is a string comparison");
// The stale comment is gone and the live state is recorded.
ok(!/ACTIVE version 36, which reads body\.cycle_date_provenance ZERO times/.test(HTML), "F2-13: the stale v36 comment is gone");
ok(/ACTIVE version 37/.test(HTML), "F2-13-CONTROL: the live v37 state is recorded instead");

// ── FIX 3. Ack dismissal ─────────────────────────────────────────────────────
console.log("\nFIX 3 — the acknowledgement does not follow her");
const tap = SRC.match(/async function onDdcTap[\s\S]*?\n\}\n/);
const place = SRC.match(/function ddcPlace[\s\S]*?\n\}\n/);
ok(!!tap && !!place, "F3-CONTROL: onDdcTap and ddcPlace were located");
ok(/clarify-ack/.test(tap[0]), "F3-CONTROL-2: onDdcTap does render the acknowledgement, so the checks below are on the right function");
ok(/setTimeout\(/.test(tap[0]), "F3-1: onDdcTap arms a dismissal timer");
ok(/\},\s*4000\)/.test(tap[0]), "F3-2: the timer is 4000ms");
ok(/classList\.add\("hidden"\)/.test(tap[0]), "F3-3: it hides #ddc-wrap");
ok(/innerHTML = ""/.test(tap[0]), "F3-4: and empties #ddc");
ok(/window\.__ddcMountState\[reportId\] = "done"/.test(tap[0]), "F3-5: the report is marked done");
ok(/__ddcMountState\[rvId\] === "done"/.test(place[0]), "F3-6: ddcPlace refuses to move a done wrap");
const doneIdx = place[0].indexOf('=== "done"'), revealIdx = place[0].indexOf('view === "reveal"');
ok(doneIdx > 0 && revealIdx > 0 && doneIdx < revealIdx, "F3-7: the done check runs BEFORE the reveal move, so an answered beat cannot be carried in");

// ── FIX 4a. Face scan entry ──────────────────────────────────────────────────
console.log("\nFIX 4a — the scan entry does not ride on a narrative line");
const chips = SRC.match(/function renderCompanionChips[\s\S]*?\n\}\n/);
ok(!!chips, "F4-CONTROL: renderCompanionChips was located");
const callIdx = chips[0].indexOf("renderScanEntry()");
const mountIdx = chips[0].indexOf("sanaMountChat()");
const lateIdx = chips[0].indexOf("if(!ansEl) return;");
ok(callIdx > 0, "F4-1: renderScanEntry is called inside renderCompanionChips");
// RE-POINTED, EMPTY_PROSE_V1. These two pinned that renderScanEntry sat ABOVE the no-lead early
// return. That return is GONE -- PROSE_GUARD_V1 (worker v134) can empty narrative_headline.lead,
// and the return withheld the whole chip row plus sanaMountChat, which was measured missing on a
// blanked payload. The guarantee is now stronger, so the pin follows it rather than being deleted:
// there is no lead-shaped early return at all, and BOTH reveals run above the only return left.
ok(chips[0].indexOf("if(!lead) return;") === -1,
   "F4-1: there is no no-lead early return in renderCompanionChips any more");
ok(lateIdx > 0, "F4-1-CONTROL: the late `if(!ansEl) return` IS still there, so F4-2 compares two real positions");
ok(callIdx < lateIdx && mountIdx > 0 && mountIdx < lateIdx,
   "F4-2: renderScanEntry AND sanaMountChat both run before the only remaining return, so neither rides on a payload field");
// The consent gate is untouched: the entry must still be consent-gated.
const rse = SRC.match(/async function renderScanEntry[\s\S]*?\n\}\n/);
ok(!!rse && /await sanaConsentGranted\(\)/.test(rse[0]), "F4-3: renderScanEntry still gates itself on consent");
const ofs = SRC.match(/async function openFaceScan[\s\S]*?\n\}\n/);
ok(!!ofs && /await sanaConsentGranted\(\)/.test(ofs[0]), "F4-4: openFaceScan still re-checks consent before minting a token");
eq((HTML.match(/window\.open\(url, "_blank", "noopener"\);/g) || []).length, 1, "F4-5: the pinned scan open is unchanged");

// ── FIX 5. The revealed date row ─────────────────────────────────────────────
console.log("\nFIX 5 — the revealed date row is brought into view");
const lens = SRC.match(/function applyCycleLens[\s\S]*?\n\}\n/);
ok(!!lens, "F5-CONTROL: applyCycleLens was located");
ok(/lens\.classList\.toggle\("hidden", !withLens\)/.test(lens[0]), "F5-CONTROL-2: the in-place reveal toggle is still the mechanism");
ok(/scrollIntoView/.test(lens[0]), "F5-1: the reveal scrolls the row into view");
ok(/block: "nearest"/.test(lens[0]), 'F5-2: with block "nearest", so a row already in view does not jump');
ok(/wasHidden/.test(lens[0]), "F5-3: it scrolls only on the transition into view, not on every re-render");
const scrollIdx = lens[0].indexOf("scrollIntoView"), toggleIdx = lens[0].indexOf('toggle("hidden", !withLens)');
ok(toggleIdx > 0 && scrollIdx > toggleIdx, "F5-4: the scroll runs after the element is visible");
// The row is revealed in place and must still never be moved.
for (const op of ["appendChild", "insertBefore", "insertAdjacentHTML", "prepend("]) {
  const moved = (HTML.match(new RegExp("[^\\n]*" + op.replace("(", "\\(") + "[^\\n]*", "g")) || [])
    .filter((l) => /cyc-lens|lmp-row|cyc-lmp/.test(l));
  eq(moved.length, 0, "F5-5-" + op + ": the date row is never moved by " + op);
}
eq((HTML.match(/appendChild/g) || []).length > 0, true, "F5-5-CONTROL: appendChild IS used elsewhere in the file, so the four checks above can fail");

// ── FIX 6. The scan opens on a phone ─────────────────────────────────────────
// iOS Safari grants a window.open only while the tap's user activation is live, and it does
// not survive an await. openFaceScan has two above the open, so on a phone the call was
// refused silently and nothing at all happened. The phone branch navigates the same tab
// instead. The desktop branch must stay byte-identical, which is why the pinned open count
// is asserted here as well as in FIX 4.
console.log("\nFIX 6 — the scan opens on a phone");
const scanFn = SRC.match(/async function openFaceScan[\s\S]*?\n\}\n/);
ok(!!scanFn, "F6-CONTROL: openFaceScan was located");
ok(/const url = SCAN_ORIGIN \+ "\/index-scan\.html#" \+ token;/.test(scanFn[0]),
   "F6-CONTROL-2: the url expression is still the one the scan page reads, so the checks below are on the right function");
ok(/location\.assign\(url\)/.test(scanFn[0]), "F6-1: a phone navigates the same tab with location.assign");
ok(/window\.matchMedia\("\(pointer: coarse\)"\)/.test(scanFn[0]), "F6-2: the phone test reads pointer coarse");
ok(/window\.innerWidth < 700/.test(scanFn[0]), "F6-3: with a narrow-viewport fallback for a browser that does not answer the media query");
eq((HTML.match(/window\.open\(url, "_blank", "noopener"\);/g) || []).length, 1,
   "F6-4: the pinned desktop open is still present exactly once");
// Ordering: the phone branch must come BEFORE the desktop open, or it can never be reached.
const aIdx = scanFn[0].indexOf("location.assign(url)");
const wIdx = scanFn[0].indexOf('window.open(url, "_blank", "noopener")');
ok(aIdx > 0 && wIdx > 0, "F6-5-CONTROL: both branches were located, so the order check below compares two real positions");
ok(aIdx < wIdx, "F6-5: the phone branch runs before the desktop open");
// It must return, or a phone would navigate AND try to open a window.
ok(/if\(phone\)\{ location\.assign\(url\); return true; \}/.test(scanFn[0]),
   "F6-6: the phone branch returns, so it never falls through to window.open");
// THE PRECONDITION IS RECORDED IN THE CODE, because this branch is only safe while the scan
// page carries its own route back. If that link is ever removed from scan.biowellth.ai, the
// phone branch starts stranding her and the comment here is the only thing that says so.
// A positive assertion on the comment, not an absence: an earlier attempt asserted the copy
// was NOT in this file and failed against its own documentation.
ok(/Back to your dashboard/.test(scanFn[0]),
   "F6-7: openFaceScan records that the scan page carries the route back, which is what makes same-tab safe");
ok(/strand/i.test(scanFn[0]),
   "F6-7b: and names the consequence if that link goes away");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
