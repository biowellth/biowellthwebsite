// PROVES scripts/lib/extract-app.mjs — the one definition of "the app block".
//
// WHAT BROKE, AND WHY THIS TEST EXISTS. Six scripts took the first `<script>` line to the
// last `</script>` line. A Sentry block was added to the head on 2026-09-20 and that span
// began swallowing an intervening `</script>`, so it stopped being valid JavaScript. Six
// tests went red and read like product regressions. Nothing about the product was wrong.
//
// So the helper has one job with two halves, and both are asserted here: it returns the
// APP on the real page even with other blocks present, and it THROWS, loudly, when the
// page stops holding exactly one candidate — rather than quietly picking a block.
//
// THE MUTANT THIS MUST CATCH: a helper that takes the FIRST bare block. On the real page
// that is Sentry's init, and the six scripts would then evaluate monitoring code and
// assert against it.

import { readFileSync } from "node:fs";
import { extractApp, locateApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";

let pass = 0, fail = 0;
const ok = (c, m) => {
  let v;
  try { v = !!c; } catch (e) { v = false; m += " [threw: " + e.message + "]"; }
  if (v) { pass++; console.log("  ok   " + m); }
  else   { fail++; console.log("  FAIL " + m); }
};
/** Returns the thrown Error, or null if the call returned. */
const threw = (fn) => { try { fn(); return null; } catch (e) { return e; } };

// ── the real page ────────────────────────────────────────────────────────────
console.log("THE REAL PAGE — the app is returned, the head block is not");
const HTML = readFileSync(FILE, "utf8");
const where = locateApp(HTML);
console.log("  " + FILE + ": " + where.bare + " bare block(s), " + where.candidates +
            " candidate(s), app at lines " + where.openLine + "-" + where.closeLine);

const SRC = extractApp(HTML, FILE);
ok(typeof SRC === "string" && SRC.length > 0, "REAL-1: extractApp returns a non-empty string (" + SRC.length + " bytes)");

// The four scripts that never broke take the LAST bare open and the first close after it.
// The helper must return those exact bytes, or it is not a drop-in for them.
{
  const lines = HTML.split("\n");
  const opens = lines.map((l, i) => (l.trim() === "<script>" ? i : -1)).filter((i) => i >= 0);
  const closes = lines.map((l, i) => (l.trim() === "</script>" ? i : -1)).filter((i) => i >= 0);
  const s = opens[opens.length - 1];
  const e = closes.filter((c) => c > s)[0];
  const legacy = lines.slice(s + 1, e).join("\n");
  ok(SRC === legacy, "REAL-2: byte-identical to what the never-broken scripts extract (" + legacy.length + " bytes)");
}

// Identity, positive: this is the app, not a monitoring shim.
ok(/\bfunction\s+loadProfile\b|\bloadProfile\s*=/.test(SRC), "REAL-3: the returned source defines loadProfile — it is the app");
ok(!/SENTRY_DSN/.test(SRC), "REAL-4: the returned source does NOT contain SENTRY_DSN — the head block was skipped");
// CONTROL for REAL-4: the string really is in the page, so its absence above means something.
ok(/SENTRY_DSN/.test(HTML), "REAL-4-CONTROL: SENTRY_DSN IS present in the page, so REAL-4 is not vacuous");
ok(where.bare === 2, "REAL-5: the page holds exactly 2 bare blocks today (got " + where.bare + ") — if this moves, read the helper's comment");

// ── zero candidates ──────────────────────────────────────────────────────────
console.log("\nZERO BARE BLOCKS — must throw, naming the count");
const ZERO = [
  "<html>", "<head>",
  '<script src="https://cdn.example/lib.js"></script>',
  "</head>", "<body>", "<div>no inline script here</div>", "</body>", "</html>",
].join("\n");
{
  const e = threw(() => extractApp(ZERO, "zero.html"));
  ok(e !== null, "ZERO-1: it throws");
  ok(e && /0 candidate/.test(e.message), "ZERO-2: the message names the candidate count (got: " + (e ? e.message.slice(0, 90) : "no throw") + ")");
  ok(e && /Bare <script> blocks seen: 0/.test(e.message), "ZERO-3: and names how many bare blocks it saw");
}

// ── two candidates ───────────────────────────────────────────────────────────
console.log("\nTWO CANDIDATES — must throw rather than guess");
const TWO = [
  "<html>", "<head>", "</head>", "<body>",
  "<script>", "var a = 1;", "</script>",
  "<div>content</div>",
  "<script>", "var b = 2;", "</script>",
  "</body>", "</html>",
].join("\n");
{
  const e = threw(() => extractApp(TWO, "two.html"));
  ok(e !== null, "TWO-1: it throws instead of returning one of them");
  ok(e && /2 candidate/.test(e.message), "TWO-2: the message names the candidate count (got: " + (e ? e.message.slice(0, 90) : "no throw") + ")");
  ok(e && /Bare <script> blocks seen: 2/.test(e.message), "TWO-3: and names how many bare blocks it saw");
  ok(e && /lines 5-7/.test(e.message) && /lines 9-11/.test(e.message), "TWO-4: and names where each one sits, so it can be found");
}

// ── one candidate, with noise around it ──────────────────────────────────────
console.log("\nONE CANDIDATE AMONG NOISE — the shape of the real page");
const ONE = [
  "<html>", "<head>",
  '<script src="https://cdn.example/sentry.js"></script>',
  "<script>", "var sentryInit = 1;", "</script>",   // bare, parses, but in the HEAD
  "</head>", "<body>",
  "<script>", "var app = 2;", "</script>",
  "</body>", "</html>",
].join("\n");
{
  const got = threw(() => extractApp(ONE, "one.html"));
  ok(got === null, "ONE-1: a bare HEAD block does not make it ambiguous" + (got ? " [threw: " + got.message.slice(0, 80) + "]" : ""));
  ok(extractApp(ONE, "one.html").trim() === "var app = 2;", "ONE-2: it returns the BODY block, not the head block (got " + JSON.stringify(extractApp(ONE, "one.html").trim()) + ")");
}

// ── a bare block that is not JavaScript is not a candidate ───────────────────
console.log("\nA NON-JS BARE BLOCK IS NOT A CANDIDATE");
const JSONLD = [
  "<html>", "<head>", "</head>", "<body>",
  '<script type="application/ld+json">', '{ "@context": "x", }{', "</script>",
  "<script>", "var app = 3;", "</script>",
  "</body>", "</html>",
].join("\n");
{
  const got = threw(() => extractApp(JSONLD, "jsonld.html"));
  ok(got === null, "JSONLD-1: a bare block that does not parse is skipped" + (got ? " [threw: " + got.message.slice(0, 80) + "]" : ""));
  ok(extractApp(JSONLD, "jsonld.html").trim() === "var app = 3;", "JSONLD-2: and the JavaScript block is returned");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
