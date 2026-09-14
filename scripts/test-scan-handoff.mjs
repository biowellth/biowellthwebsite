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
ok("string control: the file does carry many literals", STRINGS.length > 100);
eq("no user-facing scan or camera copy shipped",
  STRINGS.filter((s) => /\b(face scan|camera|scan now|start scan)\b/i.test(s)).length, 0);

console.log("");
console.log("  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
