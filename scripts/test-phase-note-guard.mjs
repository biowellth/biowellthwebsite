#!/usr/bin/env node
// PHASE_NOTE_GUARD_V1 -- the daily card shows a Call D phase note only if the shared guard allows it.
//
// js/phase-note-guard.js and scripts/fixtures/phase-note-guard-corpus.json are byte-identical to supa
// supabase/functions/_shared/phase-note-guard.js + phase-note-guard-corpus.json. The two constants
// below are the SAME constants supa pins. Edit one copy without the other and that repository goes red.
//
// Sections:
//   1. pins, and the import URL's cache key matches the pinned guard
//   2. the shared corpus: every must-drop drops with its category, every must-keep is kept
//   3. dcFlavorFor, extracted from dashboard.html: the guard runs AFTER the ovulatory remap, a dropped
//      note shows no note, and no guard shows no note
// Full renders through dcRenderDailyCard are in scripts/test-cycle-movement.mjs (CM-W49..53).
//
//   node scripts/test-phase-note-guard.mjs
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const GUARD_SHA256 = "2f643d317c78aa85c985f416eba2a3853d53c56663d449bf5937059b956dac43";
const CORPUS_SHA256 = "a9de7e366df92fc5a2831ffaa62d244a3317069f6ca72b3f9e5b99eb1c375aa6";
const GUARD_PATH = new URL("../js/phase-note-guard.js", import.meta.url);
const CORPUS_PATH = new URL("./fixtures/phase-note-guard-corpus.json", import.meta.url);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

console.log("PHASE_NOTE_GUARD_V1");
const HTML = readFileSync(process.env.DASH || new URL("../dashboard.html", import.meta.url), "utf8");
const G = await import(GUARD_PATH);
const CORPUS = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));

// ── 1. pins ──────────────────────────────────────────────────────────────────
eq(sha(GUARD_PATH), GUARD_SHA256, "PNG-W1: the guard is the pinned bytes, the same pin supa holds");
eq(sha(CORPUS_PATH), CORPUS_SHA256, "PNG-W2: the corpus is the pinned bytes, the same pin supa holds");
const src = (HTML.match(/const PNG_SRC = '([^']+)'/) || [])[1];
eq(src, "/js/phase-note-guard.js?v=" + GUARD_SHA256.slice(0, 8), "PNG-W3: the import URL's cache key is the pinned guard's sha prefix");
const cmBanned = JSON.parse(readFileSync(new URL("./fixtures/cycle-movement-corpus.json", import.meta.url), "utf8")).banned_copy;
eq(JSON.stringify([...G.BANNED_COPY].sort()), JSON.stringify([...cmBanned].sort()), "PNG-W4: BANNED_COPY is the cycle-movement corpus's banned_copy");

// ── 2. corpus ────────────────────────────────────────────────────────────────
const badDrop = CORPUS.must_drop.filter((c) => G.phaseNoteCategory(c.text) !== c.category);
eq(badDrop.length, 0, `PNG-W5: all ${CORPUS.must_drop.length} must-drop cases drop with their category` + (badDrop.length ? " -- " + badDrop[0].text : ""));
const badKeep = CORPUS.must_keep.filter((c) => !G.phaseNoteAllowed(c.text));
eq(badKeep.length, 0, `PNG-W6: all ${CORPUS.must_keep.length} must-keep cases are kept` + (badKeep.length ? " -- " + badKeep[0].text : ""));
ok(CORPUS.must_keep.some((c) => /no need to push hard/.test(c.text)), "PNG-W7 CONTROL: the word-boundary trap is in the corpus");

// ── 3. dcFlavorFor ───────────────────────────────────────────────────────────
const fnSrc = (HTML.match(/^function dcFlavorFor\(pn, phase, guard\)\{[\s\S]*?^\}$/m) || [])[0];
ok(!!fnSrc, "PNG-W8 REACHABILITY: dcFlavorFor(pn, phase, guard) is in dashboard.html");
const ctx = {}; vm.createContext(ctx); new vm.Script(fnSrc + "\n;globalThis.f = dcFlavorFor;").runInContext(ctx);
const f = ctx.f;
const CLEAN = "Warm cooked greens can feel gentler than a cold salad right now.";
const FLAGGED = "Avocado also offers healthy fats that can help steady mood and cravings in this phase.";
eq(f({ luteal: CLEAN }, "luteal", G), CLEAN, "PNG-W9 CONTROL: a clean note is shown");
for (const ph of ["menstrual", "follicular", "luteal"]) eq(f({ [ph]: FLAGGED }, ph, G), null, `PNG-W10 ${ph}: a flagged note shows no note`);
eq(f({ follicular: CLEAN, ovulatory: FLAGGED }, "ovulatory", G), CLEAN, "PNG-W11: ovulatory remaps to a clean follicular note, which is shown");
eq(f({ follicular: FLAGGED, ovulatory: CLEAN }, "ovulatory", G), null, "PNG-W12: ovulatory remaps to a flagged follicular note: no note, and the ovulatory note is never the fallback");
eq(f({ luteal: CLEAN }, "luteal", null), null, "PNG-W13: no guard (failed load), no note");
eq(f({ luteal: CLEAN }, "luteal", {}), null, "PNG-W14: a guard without phaseNoteAllowed, no note");
eq(f({ luteal: "A calm walk after dinner can feel grounding when energy is more inward this phase." }, "luteal", G), null, "PNG-W15: energy attributed to a phase shows no note (ruled 2026-10-12)");
const COND = "Steaming or roasting these can make them easier to enjoy when energy is lower.";
eq(f({ menstrual: COND }, "menstrual", G), COND, "PNG-W16: a conditional, state-led energy note is shown");

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
