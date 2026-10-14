#!/usr/bin/env node
// ERROR_CONTRAST_V2 -- six error texts use #8E5340 (--coral-deep-text), which clears WCAG AA 4.5:1
// on every background they sit on. --coral-dark #BC6550 measured 3.67 to 4.11:1 (PR #18 harness).
//
// WHAT IS PINNED, with comments stripped first:
//   dashboard.html .msg.err, .bc-err-t, .dobg-msg, .dobg-refuse, .del-msg.err
//   review.html    .msg.err
// each declares color:var(--coral-deep-text) or #8E5340, and the token resolves to #8E5340 in that
// page's :root. .proc-err is deliberately NOT pinned: no markup or script uses it.
// MUTANTS. Putting --coral-dark back on any one rule must fail; the same declaration inside a comment
// must pass, which proves the check reads code and not the documentation of the fix.
//
//   node scripts/test-error-contrast.mjs        (or DASH=... REVIEW=...)
import { readFileSync } from "node:fs";

const PAGES = { dashboard: process.env.DASH || "dashboard.html", review: process.env.REVIEW || "review.html" };
const TARGETS = [
  ["dashboard", ".msg.err"], ["dashboard", ".bc-err-t"], ["dashboard", ".dobg-msg"],
  ["dashboard", ".dobg-refuse"], ["dashboard", ".del-msg.err"], ["review", ".msg.err"],
];
let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));

const css = (html) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
// The bare top-level rule for a selector (not one inside a scoped or compound selector).
function colorOf(html, sel) {
  const esc = sel.replace(/[.]/g, "\\.");
  const m = css(html).match(new RegExp("(?:^|[}\\n])\\s*" + esc + "\\{([^}]*)\\}"));
  if (!m) return null;
  const c = m[1].match(/(?:^|;)\s*color:\s*([^;]+)/);
  return c ? c[1].trim() : "";
}
const tokenOf = (html) => ((css(html).match(/:root\{[\s\S]*?--coral-deep-text:\s*(#[0-9A-Fa-f]{6})/) || [])[1] || "").toUpperCase();
const good = (c) => c === "var(--coral-deep-text)" || (c || "").toUpperCase() === "#8E5340";

const HTML = Object.fromEntries(Object.entries(PAGES).map(([k, f]) => [k, readFileSync(f, "utf8")]));
for (const k of Object.keys(PAGES)) ok(tokenOf(HTML[k]) === "#8E5340", "EC2-1: " + PAGES[k] + " :root defines --coral-deep-text:#8E5340");
for (const [pg, sel] of TARGETS) {
  const c = colorOf(HTML[pg], sel);
  ok(c !== null, "EC2-2 CONTROL: " + PAGES[pg] + " " + sel + " rule found");
  ok(good(c), "EC2-3: " + PAGES[pg] + " " + sel + " text is " + c);
}

console.log("\nMUTANTS -- --coral-dark back on any one rule must fail, and only in real code");
for (const [pg, sel] of TARGETS) {
  const html = HTML[pg];
  const esc = sel.replace(/[.]/g, "\\.");
  const re = new RegExp("(\\n" + esc + "\\{[^}]*?)color:var\\(--coral-deep-text\\)");
  const mutated = html.replace(re, "$1color:var(--coral-dark)");
  ok(mutated !== html, "EC2-4 control: the " + sel + " mutant changed " + PAGES[pg]);
  ok(!good(colorOf(mutated, sel)), "EC2-5 MUTANT " + PAGES[pg] + " " + sel + " back to --coral-dark: caught");
}
const commentOnly = HTML.dashboard.replace("</style>", "/* .msg.err{color:var(--coral-dark)} */\n</style>");
ok(good(colorOf(commentOnly, ".msg.err")), "EC2-6 CONTROL: the old value inside a comment is not read");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
