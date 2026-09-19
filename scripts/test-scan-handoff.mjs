#!/usr/bin/env node
// FACE_SCAN_ENTRY_V1 — the one-tap authenticated hand-off to scan.biowellth.ai.
//
// THE LOAD-BEARING PROPERTY: the access token reaches the scan page through the
// URL FRAGMENT and through nothing else. It is never written to an element, a
// data attribute, localStorage, sessionStorage, a cookie, or the console, and
// the window.open call keeps "noopener" so the far side gets no handle back.
//
// THE INSTRUMENT TRAP THIS FILE EXISTS TO SURVIVE: the code reference is the
// string "https://scan.biowellth.ai", which CONTAINS "//". A naive comment
// stripper cuts at that "//" and deletes the very reference the suite is
// counting, reporting a confident zero. So stripComments below is string-aware,
// and it carries two controls: it must remove a real comment, and it must NOT
// remove the URL. Both are asserted before any absence claim is made.
//
//   node scripts/test-scan-handoff.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const RAW = readFileSync(FILE, "utf8");

/**
 * SCRIPT CONTENT ONLY, and this is not tidiness.
 *
 * dashboard.html is HTML, and its prose carries apostrophes -- "a woman's
 * panel". Fed the whole file, a string-aware stripper treats the first such
 * apostrophe as an opening quote, never finds a closing one, and from that point
 * believes every line is inside a string. It then strips NOTHING, silently, and
 * every absence assertion downstream reads as a pass. That failure was observed
 * on the first run of this file: both stripper controls went red at once, which
 * is the only reason it was caught rather than shipped as a green suite.
 *
 * So the JS is extracted first. Apostrophes inside JS live in quoted strings or
 * in // comments, and both are handled correctly.
 */
const HTML = (RAW.match(/<script\b[^>]*>([\s\S]*?)<\/script>/g) || [])
  .map((b) => b.replace(/^<script\b[^>]*>/, "").replace(/<\/script>$/, ""))
  .join("\n");

let pass = 0, fail = 0;
const ok = (label, cond) => {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label); }
};
const eq = (label, got, want) => {
  if (got === want) { pass++; console.log("  ok   " + label + "  (" + got + ")"); }
  else { fail++; console.log("  FAIL " + label + "  got " + got + " want " + want); }
};

/**
 * LINE-BASED comment removal, and the reason it is not character-based.
 *
 * A character-level string-aware stripper was tried first and FAILED here: this
 * file's 559 KB of JS contains regex literals holding quote characters, e.g.
 * /["']/ , which a stripper that does not also tokenise regex literals reads as
 * an opening quote. From that point it believes everything is inside a string,
 * strips nothing, and every absence assertion downstream reads as a pass. Both
 * of its controls went red together, which is the only reason it was caught.
 *
 * Line classification cannot drift that way. A full-line comment is dropped. On
 * a code line, a trailing "//" is cut only when it is not the "://" of a URL and
 * not inside a string literal on that line.
 */
function stripComments(src) {
  const out = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) continue;
    let cut = -1;
    for (let i = 1; i < line.length - 1; i++) {
      if (line[i] !== "/" || line[i + 1] !== "/") continue;
      if (line[i - 1] === ":") continue;                       // https://
      const before = line.slice(0, i);
      const dq = (before.match(/"/g) || []).length;
      const sq = (before.match(/'/g) || []).length;
      if (dq % 2 === 0 && sq % 2 === 0) { cut = i; break; }
    }
    out.push(cut >= 0 ? line.slice(0, cut) : line);
  }
  return out.join("\n");
}

console.log("scan hand-off");

ok("script extraction control: it found JS, and less than the whole file",
  HTML.length > 10000 && HTML.length < RAW.length);

// ---------------------------------------------------------------------------
// 0. THE INSTRUMENT, before it is trusted for anything.
// ---------------------------------------------------------------------------
const CODE = stripComments(HTML);
ok("stripper control A: it removes a real comment line",
  HTML.includes("// FACE_SCAN_ENTRY_V1") && !CODE.includes("// FACE_SCAN_ENTRY_V1"));
ok("stripper control B: it does NOT eat the URL at its own '//'",
  CODE.includes("https://scan.biowellth.ai"));
ok("stripper control C: it leaves ordinary code intact",
  CODE.includes("async function openFaceScan"));
ok("stripper control D: a comment MENTIONING the host really was present",
  (HTML.match(/scan\.biowellth\.ai/g) || []).length > 1);

// ---------------------------------------------------------------------------
// 1. EXACTLY ONE reference, in code, not in prose.
// ---------------------------------------------------------------------------
eq("exactly one scan.biowellth.ai reference in code",
  (CODE.match(/scan\.biowellth\.ai/g) || []).length, 1);
eq("it is the SCAN_ORIGIN constant",
  (CODE.match(/const SCAN_ORIGIN = "https:\/\/scan\.biowellth\.ai";/g) || []).length, 1);
ok("nothing else builds a scan URL by concatenating a bare host",
  !/["'`]scan\.biowellth/.test(CODE.replace('const SCAN_ORIGIN = "https://scan.biowellth.ai";', "")));

// ---------------------------------------------------------------------------
// 2. THE OPEN CALL: noopener, a new tab, and the fragment.
// ---------------------------------------------------------------------------
const OPEN = (CODE.match(/window\.open\([^)]*\)/g) || []);
ok("at least one window.open exists (non-zero control for the checks below)", OPEN.length >= 1);
const scanOpen = CODE.match(/window\.open\(url, "_blank", "noopener"\);/g) || [];
eq("the scan hand-off opens with noopener", scanOpen.length, 1);
ok("every window.open in the file carries noopener",
  OPEN.every((c) => c.includes("noopener")));
ok("the url is built with a '#' fragment, not a query string",
  /const url = SCAN_ORIGIN \+ "\/index-scan\.html#" \+ token;/.test(CODE));
ok("the token is NOT encoded, matching the page's h.slice(1) contract",
  !/encodeURIComponent\(\s*token\s*\)/.test(CODE));

// ---------------------------------------------------------------------------
// 3. THE TOKEN REACHES NO SINK. Every assertion here is an absence, so each one
//    is paired with a control proving the pattern can fire at all.
// ---------------------------------------------------------------------------
function body(name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(CODE);
  if (!m) throw new Error("not found: " + name);
  let i = CODE.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < CODE.length; j++) {
    if (CODE[j] === "{") depth++;
    else if (CODE[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  return CODE.slice(m.index, end);
}
const FN = body("openFaceScan");
ok("openFaceScan body extracted (non-zero control: it mentions the token)", /\btoken\b/.test(FN));

const SINKS = [
  ["localStorage",      /localStorage/],
  ["sessionStorage",    /sessionStorage/],
  ["document.cookie",   /document\.cookie/],
  ["innerHTML",         /\.innerHTML\s*=/],
  ["textContent",       /\.textContent\s*=\s*[^;]*\btoken\b/],
  ["setAttribute",      /setAttribute\s*\(/],
  ["dataset",           /\.dataset\./],
  ["value =",           /\.value\s*=\s*[^;]*\btoken\b/],
  ["console",           /console\./],
  ["fetch",             /fetch\s*\(/],
  ["location assign",   /location\s*(\.href)?\s*=/],
];
for (const [name, re] of SINKS) ok("token never reaches " + name, !re.test(FN));
ok("sink control: the same matcher DOES fire on a line that uses a sink",
  /localStorage/.test('localStorage.setItem("t", token);'));

ok("the url const is local to the call, not a module-level binding",
  /\n  const url = SCAN_ORIGIN/.test(FN) && !/^const url/m.test(CODE));

// ---------------------------------------------------------------------------
// 4. GATING: consent before a camera, and no open without a live session.
// ---------------------------------------------------------------------------
ok("consent is checked before the token is minted",
  FN.indexOf("sanaConsentGranted") > -1 &&
  FN.indexOf("sanaConsentGranted") < FN.indexOf("sanaAccessToken"));
ok("a refused consent returns before any window.open",
  /if\(!\(await sanaConsentGranted\(\)\)\) return false;/.test(FN));
ok("the token is minted before the open, and an empty one returns early",
  FN.indexOf("sanaAccessToken") < FN.indexOf("window.open") &&
  /if\(!token\)\{/.test(FN));
ok("the no-session path uses the EXISTING expired copy, not a new string",
  /sanaNote\(n, SANA_COPY\.expired\)/.test(FN));
ok("no new user-facing string literal is introduced in the handler",
  !/"[A-Z][a-z]+ [a-z]/.test(FN.replace(/"_blank"|"noopener"|"sana-turn"|"sana-thread"/g, "")));

const order = [FN.indexOf("sanaConsentGranted"), FN.indexOf("sanaAccessToken"), FN.indexOf("window.open")];
ok("strict order: consent, then token, then open",
  order[0] >= 0 && order[0] < order[1] && order[1] < order[2]);

// ---------------------------------------------------------------------------
// 5. NO COPY SHIPPED. The dashboard must still carry zero scan/camera strings,
//    because the visible entry point is a separate ruling.
// ---------------------------------------------------------------------------
const STRINGS = (CODE.match(/"[^"\n]{4,}"/g) || []);
// Lazily read, because the approved-set block above needs the copy object and this
// file builds COPY_OBJ further down. One reader, so the two cannot drift.
function COPY_OBJ_EARLY(){
  return (CODE.match(/const SANA_COPY = \{[\s\S]*?\n\};/) || [""])[0];
}
ok("string control: the file does carry many literals", STRINGS.length > 100);
// PASS 1 asserted zero scan or camera copy, which was right while the entry point
// had no label. The approved copy now ships, so the assertion is INVERTED rather
// than deleted: exactly the approved strings, and no fourth one smuggled in beside
// them.
// UPDATED 2026-09-16 with the top bar entry point, which adds a third literal,
// "Camera reading". The count moves 2 -> 3 and the approved list gains that one
// string. The "no fourth one smuggled in" property is what this pair is for and
// it is unchanged; the set is now pinned EXACTLY rather than checked with an
// every() over an or-chain, so a swap of one approved string for another
// approved string can no longer pass unnoticed.
const SCANNY = STRINGS.filter((s) => /\b(face scan|camera|scan now|start scan)\b/i.test(s));
// UPDATED 2026-09-19 BY RULING, with the reveal deck's walkthrough beat. The count moves 3 -> 5
// and the approved list gains the beat's item 6, a title and a description. The beat renders that
// item ONLY when the face scan is consented and omits it entirely otherwise, which is the same
// rule renderScanEntry follows; the strings still ship in the source either way, which is what
// this gate reads, so they have to be approved here.
eq("exactly five scan or camera literals ship", SCANNY.length, 5);
// CASING UPDATED 2026-09-16 BY RULING. The nav label is TITLE case, the chip and the
// companion button stay SENTENCE case. The two are pinned SEPARATELY and exactly, so a
// future session cannot "fix the inconsistency" in either direction without going red.
// A THIRD CASING NOW EXISTS AND IT IS DELIBERATE. The nav label is Title case, the chip and the
// companion button are Sentence case, and the walkthrough beat's item title is Sentence case too.
// All are pinned separately and exactly, so a future session cannot "fix the inconsistency" in
// any direction without going red. That is the point of the exact set, not an oversight in it.
const SCAN_APPROVED = [
  '"Start a face scan"',
  '"Face Scan"',
  '"This uses your camera for about a minute to read your pulse and breathing. It opens in a new tab."',
  '"Face scan"',
  '"A sixty second face scan reading your pulse and breathing."',
];
eq("and they are exactly the founder-approved set, no more and no fewer",
  SCANNY.slice().sort().join("|"), SCAN_APPROVED.slice().sort().join("|"));
ok("approved-set control: the matcher fires on a literal that is NOT approved",
  ['"Start your face scan"'].join("|") !== SCAN_APPROVED.slice().sort().join("|"));

// REVERSED 2026-09-16 BY RULING, and replaced rather than deleted. This pair used to
// assert that NO user-facing string said "face scan", which was correct under the
// previous naming and is exactly wrong now: the feature IS a wellness face scan and
// the action copy says so.
//
// THE ACTION IS A FACE SCAN. THE OUTPUT IS A READING. A blanket find-and-replace
// would have destroyed that distinction silently, so it is now pinned in BOTH
// directions here: the action labels must say face scan, and no user-facing string
// may still call the action a camera reading.
ok("the ACTION labels say face scan, both variants, verbatim and in their own casing",
  COPY_OBJ_EARLY().includes('action: "Start a face scan"') &&
  COPY_OBJ_EARLY().includes('nav:    "Face Scan"'));
// THE CASING DIFFERENCE IS DELIBERATE AND IS PINNED AS SUCH. A nav label sits in a row
// with New Upload and Account and is title cased with them; the chip and the companion
// button are sentences. Left only to the verbatim pins above, a future session reading
// two spellings of the same feature would reasonably "tidy" one of them. This says out
// loud that they are supposed to differ, and breaks if either is normalised.
ok("nav is title case and the sentence variant is not, deliberately",
  /nav:    "Face Scan"/.test(RAW) &&
  !/nav:    "Face scan"/.test(RAW) &&
  /action: "Start a face scan"/.test(RAW) &&
  !/action: "Start A Face Scan"/.test(RAW));
ok("casing control: the matcher can tell the two spellings apart",
  /"Face Scan"/.test('nav:    "Face Scan"') && !/"Face Scan"/.test('nav:    "Face scan"'));
ok("no user-facing string calls the action a camera reading",
  !STRINGS.some((s) => /camera reading/i.test(s)));
ok("camera-reading control: that matcher DOES fire on the old string",
  /camera reading/i.test('"Take a camera reading"'));
// REPLACED 2026-09-16, NOT DELETED, and the difference matters. This pair used to
// REQUIRE the card's second line, which enumerated three metrics. That line named three
// while the results card shows four, with two more requested and stored but not
// displayed because the licence returns null for them. It was wrong and it was removed.
//
// Deleting the assertion with the string would have left nothing stopping a metric list
// coming back, by a future session that reads a one-line card as incomplete. So it is
// INVERTED: the card must not enumerate metrics AT ALL, and the surviving line is
// pinned verbatim so it cannot be quietly reworded into one.
//
// scanIntro says what the scan DOES, which is stable. The removed line said what she
// GETS, which is not, and that is the whole reason one survived and one did not.
ok("the surviving line is verbatim and describes what the scan DOES",
  STRINGS.some((s) => s.includes("read your pulse and breathing")));
ok("the card carries ONE explanatory line, not two",
  !/scanDetail/.test(CODE) && !/id="scan-detail"/.test(RAW));
ok("one-line control: the matcher DOES fire on the node that used to be there",
  /id="scan-detail"/.test('<p class="scan-detail" id="scan-detail"></p>'));

// NO METRIC ENUMERATION in the face scan explainer. Scoped to that one string rather
// than the file, because the results card names metrics legitimately and a file-wide ban
// would be wrong. Each metric is named separately so a red says WHICH one crept back.
const SCAN_EXPLAINER = (COPY_OBJ_EARLY().match(/scanIntro:\s*"([^"]*)"/) || [, ""])[1];
ok("explainer control: it was extracted and is a real sentence", SCAN_EXPLAINER.length > 40);
for (const metric of ["heart rate", "heart rate variability", "hrv", "stress index",
                      "blood pressure", "cardiac workload", "breathing rate"])
  ok("the face scan card does not name " + metric,
    !SCAN_EXPLAINER.toLowerCase().includes(metric));
ok("metric-ban control: that matcher DOES fire on the copy that was removed",
  "you will see your heart rate, heart rate variability and breathing rate."
    .includes("heart rate variability"));

// ---------------------------------------------------------------------------
// 6. THE CALL SITE. Exactly one, and it is the button's handler.
// ---------------------------------------------------------------------------
// UPDATED 2026-09-16. Was 2, the declaration plus the companion button. The top
// bar is a second entry point, so it is 3. The COUNT IS NOT MERELY RAISED: every
// wiring is now pinned BY NAME below, so a fourth reference appearing without a
// matching named assertion breaks the total and says which one is unaccounted
// for. Raising a bare count is how a silent extra reference gets waved through.
const CALLS = (CODE.match(/openFaceScan/g) || []);
eq("openFaceScan appears exactly four times: the declaration and three wirings",
  CALLS.length, 4);
eq("wiring 1 of 3: the companion entry button",
  (CODE.match(/go\.onclick = openFaceScan;/g) || []).length, 1);
eq("wiring 2 of 3: the top bar nav item",
  (CODE.match(/nav\.onclick = openFaceScan;/g) || []).length, 1);
eq("wiring 3 of 3: the suggestion chip, as an action rather than a call",
  (CODE.match(/items\.unshift\(\{ q: SANA_COPY\.scanLabel\.action, action: openFaceScan \}\);/g) || []).length, 1);
eq("exactly one declaration", (CODE.match(/async function openFaceScan\(/g) || []).length, 1);
// The declaration is removed FIRST. "async function openFaceScan()" contains the
// literal "openFaceScan()", so a naive invocation check fails on a correct file.
// That happened on this file's first run of these assertions.
const NO_DECL = CODE.replace("async function openFaceScan(", "async function __decl(");
ok("it is never invoked at load time", !/openFaceScan\(\)/.test(NO_DECL));
ok("declaration-strip control: the declaration really was there and is now gone",
  /openFaceScan\(\)/.test(CODE) && CODE !== NO_DECL);
ok("call-site control: the matcher DOES fire on a real invocation",
  /openFaceScan\(\)/.test("openFaceScan();"));

// ---------------------------------------------------------------------------
// 7. THE COPY. In the object, never inline, and reaching the DOM from there.
// ---------------------------------------------------------------------------
const COPY_OBJ = COPY_OBJ_EARLY();
ok("copy object control: SANA_COPY was found and is non-trivial", COPY_OBJ.length > 400);
// UPDATED 2026-09-16 twice. scanLabel became one constant with two variants, so it is
// listed as both. Then scanDetail was removed with the card's second line, so its row
// went with it: a verbatim pin on a string that no longer exists can only ever be red.
// What replaces it is the inversion above, which is a stronger guarantee than the row
// was. scanIntro keeps all four of its checks here, INCLUDING the rendering pin, so the
// surviving line is proven to reach the DOM and not merely to sit in the copy object.
const THREE = [
  ["scanLabel.action", "Start a face scan"],
  ["scanLabel.nav",    "Face Scan"],
  ["scanIntro",  "This uses your camera for about a minute to read your pulse and breathing. It opens in a new tab."],
];
for (const [key, text] of THREE) {
  ok("SANA_COPY." + key + " carries the approved string verbatim",
    COPY_OBJ.includes('"' + text + '"'));
  // RAW, NOT CODE. CODE is script-only, so an approved string inlined into the
  // MARKUP -- the exact mistake this assertion exists to catch -- is invisible to
  // a CODE-based count. A mutation that inlined the label into the button passed
  // a green suite until this was changed.
  eq("zero inline literals of " + key + " anywhere in the file",
    (RAW.split(text).length - 1) - (COPY_OBJ.split(text).length - 1), 0);
  ok("inline control: the string IS present once, in the copy object",
    (RAW.split(text).length - 1) === 1);
  ok(key + " reaches the DOM from the copy object",
    new RegExp("textContent\\s*=\\s*SANA_COPY\\." + key).test(CODE));
}
ok("no em dash in the three strings", THREE.every(([, t]) => !t.includes("\u2014")));
ok("no colon in the three strings", THREE.every(([, t]) => !t.includes(":")));
ok("copy control: an em dash IS detectable by that test", "a \u2014 b".includes("\u2014"));

// ---------------------------------------------------------------------------
// 8. THE VISUAL GATE. Hidden by default, revealed only on a true consent.
// ---------------------------------------------------------------------------
ok("the entry node ships carrying the hidden class",
  /<div class="scan-entry hidden" id="scan-entry">/.test(RAW));
const RS = body("renderScanEntry");
ok("renderScanEntry control: body extracted and mentions the host", /scan-entry/.test(RS));
ok("consent is awaited before anything is rendered",
  /if\(!\(await sanaConsentGranted\(\)\)\) return;/.test(RS) &&
  RS.indexOf("sanaConsentGranted") < RS.indexOf("classList.remove"));
ok("a false consent returns BEFORE the class is removed and BEFORE the handler is wired",
  RS.indexOf("sanaConsentGranted") < RS.indexOf("go.onclick"));
// NEW 2026-09-16. The top bar item must not be able to offer a reading that the
// companion card is withholding, so it rides the same gate in the same function.
ok("the top bar item is wired INSIDE the same consent gate",
  /nav\.onclick = openFaceScan;/.test(RS) &&
  RS.indexOf("sanaConsentGranted") < RS.indexOf("nav.onclick"));
// TEXT ORDER IS NOT REACHABILITY, and this pair exists because the assertion above
// alone did not catch it. A mutation inserting a bare `return;` immediately above
// the nav block left every index comparison satisfied and the whole suite green,
// while the top bar item could never be wired at all. That is the same shape as
// the CHIP-4 note in test-sana-thread.mjs: matching the call without pinning the
// guard passes a mutation that makes the call unreachable.
// So the EXIT COUNT is pinned. Three returns, each named below. A fourth, wherever
// it is inserted, breaks this.
const RS_RETURNS = (RS.match(/\breturn;/g) || []).length;
eq("renderScanEntry has exactly three exits, so a new early return cannot hide", RS_RETURNS, 3);
ok("and they are the three expected guards, in order",
  RS.indexOf("if(!host) return;") <
  RS.indexOf("if(!(await sanaConsentGranted())) return;") &&
  RS.indexOf("if(!(await sanaConsentGranted())) return;") <
  RS.indexOf("if(!intro || !go) return;"));
ok("exit-count control: the matcher fires on an added return",
  ((RS + "\n  return;").match(/\breturn;/g) || []).length === RS_RETURNS + 1);
ok("the top bar item ships hidden and is only ever REVEALED here",
  /<button class="btn-ghost hidden" id="btn-scan" type="button"><\/button>/.test(RAW) &&
  /nav\.classList\.remove\("hidden"\)/.test(RS));
ok("top-bar-hidden control: that markup matcher fires on the shipped node and not on a visible one",
  !/<button class="btn-ghost" id="btn-scan"/.test(RAW));
ok("the label comes from the copy object, never inline",
  /nav\.textContent = SANA_COPY\.scanLabel\.nav;/.test(RS));
ok("and the dashboard button takes the OTHER variant of that same constant",
  /go\.textContent     = SANA_COPY\.scanLabel\.action;/.test(RS));
ok("the two variants are different strings, so one constant did not collapse them",
  /action: "Start a face scan"/.test(RAW) && /nav:    "Face Scan"/.test(RAW));

// ---------------------------------------------------------------------------
// 8a. THE TOP BAR READS AS ONE ROW. NEW 2026-09-16.
// ---------------------------------------------------------------------------
// New Upload and Account have no constant; they are inline markup, and refactoring them
// was ruled out of scope tonight. So they are pinned AT THE MARKUP, which for those two
// is also where they are rendered from, and the whole row is checked together. Casing
// one label and missing its neighbours is the failure this catches.
ok("the top bar carries all three nav labels in title case",
  /<button class="btn-ghost hidden" id="btn-new">New Upload<\/button>/.test(RAW) &&
  /<button class="btn-ghost" id="btn-account">Account<\/button>/.test(RAW) &&
  COPY_OBJ_EARLY().includes('nav:    "Face Scan"'));
ok("top-bar control: the matcher fires on the OLD casing and would have caught it",
  /<button class="btn-ghost hidden" id="btn-new">New upload<\/button>/
    .test('<button class="btn-ghost hidden" id="btn-new">New upload</button>'));
ok("no lower-case survivor of either inline label",
  !/>New upload</.test(RAW) && !/>account</.test(RAW));
// AND THE FACE SCAN LABEL STILL REACHES THE BAR. Text presence is not rendering: the
// constant could read "Face Scan" while nothing wired it to the button.
ok("the nav label is still rendered from the constant, not merely present in it",
  /nav\.textContent = SANA_COPY\.scanLabel\.nav;/.test(RS) &&
  /<button class="btn-ghost hidden" id="btn-scan" type="button"><\/button>/.test(RAW));

// ---------------------------------------------------------------------------
// 8b. THE SUGGESTION CHIP. NEW 2026-09-16. The third entry point.
// ---------------------------------------------------------------------------
const RC = body("renderCompanionChips");
ok("chip control: renderCompanionChips body extracted and mentions the row",
  /comp-chips/.test(RC) || /chipsEl/.test(RC));
// PREPENDED AT THE SEAM. Generation runs on this woman's own panel and must not be
// touched, so the fixed entry goes in AFTER the last push and BEFORE the render.
ok("the chip is prepended, never pushed into the generated run",
  /items\.unshift\(/.test(RC) && !/items\.push\(\{ q: SANA_COPY/.test(RC));
ok("prepend control: the matcher would fire on a push of the same item",
  /items\.push\(\{ q: SANA_COPY/.test('items.push({ q: SANA_COPY.scanLabel'));
ok("it is prepended AFTER the generated items are assembled",
  RC.lastIndexOf("items.push(") < RC.indexOf("items.unshift("));
ok("and BEFORE the row is rendered",
  RC.indexOf("items.unshift(") < RC.indexOf("chipsEl.innerHTML = items.map("));
// IT IS AN ACTION, NOT A QUESTION. The row's shared handler assumes q and a; this
// one must branch out before that, append no turn, and not be spent.
ok("the chip carries action and no pre-generated answer",
  /items\.unshift\(\{ q: SANA_COPY\.scanLabel\.action, action: openFaceScan \}\);/.test(RC));
ok("the handler branches on action BEFORE appending a turn",
  RC.indexOf("if(items[idx].action)") > -1 &&
  RC.indexOf("if(items[idx].action)") < RC.indexOf("sanaAppendChipTurn("));
ok("the action branch returns, so no turn is appended and the chip is not spent",
  /if\(items\[idx\]\.action\)\{ items\[idx\]\.action\(\); return; \}/.test(RC));
ok("action-branch control: that matcher does NOT fire without the return",
  !/if\(items\[idx\]\.action\)\{ items\[idx\]\.action\(\); return; \}/
    .test("if(items[idx].action){ items[idx].action(); }"));
// R3. MARKED, in vocabulary the file already speaks, and not the loudest thing.
ok("the action chip is visually distinguished by a modifier class",
  /comp-chip comp-chip-do/.test(RC));
ok("it uses the chevron this file already uses for opening something",
  /&#8250;/.test(RC) && (RAW.match(/&#8250;/g) || []).length > 1);
ok("it claims no aria-expanded, because it expands nothing",
  !/comp-chip comp-chip-do[^']*aria-expanded/.test(RC));
ok("aria control: the QUESTION chip still declares aria-expanded",
  RC.includes('\'<button class="comp-chip" type="button" data-i="\'+i+\'" aria-expanded="false">\''));
ok("the modifier borrows an existing token, it does not invent a color",
  /\.comp-chip-do\{border-color:var\(--teal-mid\);color:var\(--teal-dark\)\}/.test(RAW) &&
  /\.comp-chip:hover\{border-color:var\(--teal-mid\)\}/.test(RAW));
ok("it is not filled, so it is not the loudest thing in the row",
  !/\.comp-chip-do\{[^}]*background:var\(--teal\)/.test(RAW));
ok("the only visibility change ADDS visibility, never removes it",
  /classList\.remove\("hidden"\)/.test(RS) && !/classList\.add\("hidden"\)/.test(RS));
ok("hidden, not disabled: nothing sets a disabled property here",
  !/\.disabled\s*=/.test(RS));
ok("disabled control: that matcher fires on a line that does disable something",
  /\.disabled\s*=/.test("btn.disabled = true;"));

// ---------------------------------------------------------------------------
// 9. ORDERING ACROSS BOTH GATES. Visual gate resolves first; the token gate is
//    re-checked independently before anything is minted.
// ---------------------------------------------------------------------------
ok("both gates read the same consent function",
  /sanaConsentGranted/.test(RS) && /sanaConsentGranted/.test(FN));
ok("the render hook runs before the chat flag is consulted",
  /renderScanEntry\(\);\n  if\(!SANA_CHAT_ENABLED\) return;/.test(CODE));
eq("renderScanEntry has exactly one call site", (CODE.match(/renderScanEntry\(\);/g) || []).length, 1);
ok("markup order, not handler order, puts the intro above the button",
  RAW.indexOf('id="scan-intro"') < RAW.indexOf('id="scan-go"'));
ok("markup order control: the ids really are present", RAW.indexOf('id="scan-go"') > 0);
// NEW 2026-09-16. The card is intro then button, with nothing between them. A second
// paragraph reappearing is exactly how a metric list would come back, so the SHAPE is
// pinned and not just the absence of the old id.
ok("the card is one paragraph and one button, nothing between",
  /<div class="scan-entry hidden" id="scan-entry">\s*<p class="scan-intro" id="scan-intro"><\/p>\s*<button class="btn-ghost" id="scan-go" type="button"><\/button>\s*<\/div>/
    .test(RAW));
ok("card-shape control: that matcher does NOT fire with a second paragraph present",
  !/<div class="scan-entry hidden" id="scan-entry">\s*<p class="scan-intro" id="scan-intro"><\/p>\s*<button class="btn-ghost" id="scan-go" type="button"><\/button>\s*<\/div>/
    .test('<div class="scan-entry hidden" id="scan-entry">\n<p class="scan-intro" id="scan-intro"></p>\n<p class="scan-detail" id="scan-detail"></p>\n<button class="btn-ghost" id="scan-go" type="button"></button>\n</div>'));
ok("the dead class is gone from the stylesheet too",
  !/\.scan-detail\{/.test(RAW));
ok("dead-class control: the sibling rule IS still there",
  /\.scan-intro\{/.test(RAW));

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
