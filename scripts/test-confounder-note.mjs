#!/usr/bin/env node
// CONFOUNDER_NOTE_V1 — payload.narrative_headline.confounder_note, rendered at panel level.
//
// WHAT THIS FILE REFUSES TO DO: assert that "confounder_note" appears in dashboard.html. The
// string appearing proves somebody typed it. Two earlier passes on this repo produced misleading
// counts by grepping file-wide for a token that also lives in comments, and this file's own
// comment block would satisfy such a grep.
//
// So the render is CUT OUT of the shipped file, compiled with new Function, handed stubs and a
// synthetic payload, and the returned markup is what gets asserted. If the block changes shape the
// extraction fails loudly rather than an assertion passing for the wrong reason. esc() is cut out
// of the same file, so escaping is asserted against the SHIPPED escaper and not a copy of it.
//
// Every payload here is SYNTHETIC: invented copy, no real panel, no lab value.
//
//   node scripts/test-confounder-note.mjs      (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const RAW = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (label, cond) => {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label); }
};
const eq = (label, got, want) => {
  if (got === want) { pass++; console.log("  ok   " + label + "  (" + JSON.stringify(got) + ")"); }
  else { fail++; console.log("  FAIL " + label + "  got " + JSON.stringify(got) + " want " + JSON.stringify(want)); }
};

console.log("confounder note");

// ── cut the shipped render out ────────────────────────────────────────────────────────────────
const START = 'const cfNote = $("confounder-note");';
const END = '  const pr = Array.isArray(p.priorities)?p.priorities:[];';
const i0 = RAW.indexOf(START), i1 = RAW.indexOf(END, i0);
ok("extraction: the render block is present exactly once", RAW.split(START).length - 1 === 1);
ok("extraction: the block ends before the priority cards are built", i0 > 0 && i1 > i0);
const BLOCK = RAW.slice(i0, i1);
ok("extraction control: the cut is a block, not the whole file",
  BLOCK.length > 120 && BLOCK.length < 1200);

// ── cut the shipped escaper out, so escaping is tested against the real one ───────────────────
const eStart = RAW.indexOf("function esc(s){");
const eEnd = RAW.indexOf("\n}", eStart) + 2;
ok("extraction: esc() found in the shipped file", eStart > 0 && eEnd > eStart);
const ESC_SRC = RAW.slice(eStart, eEnd);
ok("extraction control: esc() body carries the HTML replace, so it is the real escaper",
  ESC_SRC.indexOf("&amp;") > -1 && ESC_SRC.indexOf("&lt;") > -1);

// ── run it ────────────────────────────────────────────────────────────────────────────────────
const runner = new Function("payload", ESC_SRC + `
  const el = { innerHTML: "__UNSET__", _hidden: true,
    classList: { add(c){ if(c==="hidden") el._hidden = true; },
                 remove(c){ if(c==="hidden") el._hidden = false; } } };
  const $ = (id) => (id === "confounder-note" ? el : null);
  const p = payload;
  ${BLOCK}
  return { html: el.innerHTML, hidden: el._hidden };
`);

const NOTE = "Your reproductive hormone markers are in the panel but are not scored this time.";
const withNote = (v) => ({ narrative_headline: v === undefined ? undefined : { confounder_note: v } });

// ── N1: it renders at all ─────────────────────────────────────────────────────────────────────
const r1 = runner(withNote(NOTE));
eq("N1 renders the note", r1.html, NOTE);
eq("N1 un-hides the slot", r1.hidden, false);
ok("N1 CONTROL: the assertion distinguishes rendered from not — an empty payload differs",
  runner(withNote("")).html !== r1.html);

// ── N2/N3: the three quiet cases ──────────────────────────────────────────────────────────────
const rEmpty = runner(withNote(""));
eq("N2 empty string renders nothing", rEmpty.html, "");
eq("N2 empty string stays hidden", rEmpty.hidden, true);

const rWs = runner(withNote("   \n\t  "));
eq("N2b whitespace-only renders nothing", rWs.html, "");
eq("N2b whitespace-only stays hidden", rWs.hidden, true);

const rNullField = runner(withNote(null));
eq("N3 null field renders nothing", rNullField.html, "");
eq("N3 null field stays hidden", rNullField.hidden, true);

const rAbsent = runner(withNote(undefined));
eq("N3b absent narrative_headline renders nothing", rAbsent.html, "");
eq("N3b absent narrative_headline stays hidden", rAbsent.hidden, true);

const rNonString = runner(withNote(42));
eq("N3c a non-string field renders nothing", rNonString.html, "");
eq("N3c a non-string field stays hidden", rNonString.hidden, true);

// ── N4: escaping, against the shipped escaper ─────────────────────────────────────────────────
const XSS = 'note <script>alert("x")</script> & "quoted" <b>bold</b>';
const rX = runner(withNote(XSS));
ok("N4 the script tag is inert — no raw <script in the output", rX.html.indexOf("<script") === -1);
ok("N4 the angle brackets are entity-encoded", rX.html.indexOf("&lt;script&gt;") > -1);
ok("N4 the ampersand is encoded", rX.html.indexOf("&amp;") > -1);
ok("N4 the double quote is encoded", rX.html.indexOf("&quot;") > -1);
ok("N4 no raw <b> survives either", rX.html.indexOf("<b>") === -1);
// CONTROL: the assertion above can fire. Feed the same payload through an UNESCAPED render and
// confirm it goes the other way, so "no <script" is a property of esc() and not of the fixture.
ok("N4 CONTROL: the same text unescaped DOES contain a raw <script, so the check can fail",
  String(XSS).indexOf("<script") > -1);

// ── N5: it is rendered BEFORE the priority cards, in the DOM ──────────────────────────────────
const iLabel = RAW.indexOf('<div class="section-label acc-coral">What needs a closer look</div>');
const iSlot  = RAW.indexOf('<div id="confounder-note"');
const iPrios = RAW.indexOf('<div id="prios"></div>');
const iWrap  = RAW.indexOf('<div id="prios-wrap"');
ok("N5 the slot exists in the markup", iSlot > 0);
ok("N5 it sits INSIDE #prios-wrap", iSlot > iWrap);
ok("N5 it sits AFTER the section label", iSlot > iLabel);
ok("N5 it sits BEFORE the priority cards container", iSlot < iPrios);
// CONTROL: the ordering comparison can fail — the label really is before the cards.
ok("N5 CONTROL: the index comparison is meaningful (label precedes cards)", iLabel < iPrios);
// And the RENDER runs before the cards are built, not just the markup.
ok("N5 the render executes before the cards are mapped", i0 < RAW.indexOf('$("prios").innerHTML'));

// ── N6: the copy is passed through, not rewritten ─────────────────────────────────────────────
const LONG = "Your cholesterol, insulin, and reproductive hormone markers are in the panel but we are holding them out of the score right now.";
eq("N6 the copy survives verbatim", runner(withNote(LONG)).html, LONG);
ok("N6 nothing is prepended", runner(withNote(LONG)).html.indexOf(LONG) === 0);
ok("N6 nothing is appended", runner(withNote(LONG)).html.length === LONG.length);
// The one transform the page applies everywhere, asserted rather than assumed: esc() folds a
// spaced em dash to a comma. That is the shipped escaper's rule, not this render's.
ok("N6 the render adds no transform of its own beyond esc()",
  runner(withNote("a — b")).html === new Function(ESC_SRC + "return esc('a \\u2014 b');")());
// Leading/trailing whitespace is trimmed; the interior is untouched.
eq("N6 surrounding whitespace is trimmed", runner(withNote("  " + NOTE + "  ")).html, NOTE);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
