#!/usr/bin/env node
// SANA_RENDER_V1 — the markdown renderer, extracted from dashboard.html so the
// test exercises shipped source rather than a copy that can drift.
//
// THE LOAD-BEARING PROPERTY: escape FIRST, then apply a closed set of marks.
// The live render was '<p>' + esc(answer) + '</p>', so a model reply containing
// **bold** or a hyphen list appeared with its punctuation literal. Fixing that by
// rendering marks means an XSS surface if the order is ever reversed, which is
// why ESCAPES-FIRST is the first assertion in this file and not the last.
//
// The 12 checks are the mock's, carried over unchanged. mocks/sana-thread.html
// is the approved spec.
//
//   node scripts/test-sana-render.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

function extract(name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found in " + FILE + ": " + name);
  let i = HTML.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced braces: " + name);
  return HTML.slice(m.index, end);
}

const src = extract("sanaRender") + "\n;globalThis.__r = sanaRender;";
new Function(src)();
const r = globalThis.__r;

let pass = 0, fail = 0;
const t = (label, input, want) => {
  const got = r(input);
  if (got === want) { pass++; console.log("  ok   " + label); }
  else {
    fail++; console.log("  FAIL " + label);
    console.log("        got  " + JSON.stringify(got));
    console.log("        want " + JSON.stringify(want));
  }
};

console.log("SAFETY — escaping runs before any mark is applied");
t("escapes HTML first", "<script>alert(1)</script>",
  "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
t("raw html neutralised", "<b>x</b>", "<p>&lt;b&gt;x&lt;/b&gt;</p>");
t("quote escaped", 'say "hi"', "<p>say &quot;hi&quot;</p>");

console.log("MARKS — the closed set");
t("bold", "a **b** c", "<p>a <strong>b</strong> c</p>");
t("paragraph split", "one\n\ntwo", "<p>one</p><p>two</p>");
t("bulleted -", "- a\n- b", "<ul><li>a</li><li>b</li></ul>");
t("bulleted *", "* a\n* b", "<ul><li>a</li><li>b</li></ul>");
t("numbered", "1. a\n2. b", "<ol><li>a</li><li>b</li></ol>");
t("bold inside list", "- x **y**", "<ul><li>x <strong>y</strong></li></ul>");

// SANA_EM_DASH_V1. These are the assertions this file did not have, and their
// absence is why a renderer with NO dash strip at all passed 12 of 12 for four
// days while production shipped em dashes to users. The strip had been written
// into esc(), a DIFFERENT function 1348 lines away, and sanaRender declares a
// local `var esc` that shadows it, so the two could never meet.
//
// Two passes, in this order. A space-flanked dash is a clause break and becomes
// ", ". Any dash left over is compound usage and becomes "-" so the glyph is not
// simply deleted. Order matters: bare-first would eat the spaced case.
//
// The dash is written here as — rather than as the character, matching the
// renderer, so a copy rule sweep for the literal glyph does not silently rewrite
// the test that guards it.
const EM = "—";
console.log("EM DASH — stripped before the escape, both passes");
t("bare em dash becomes a hyphen", "mid" + EM + "sentence", "<p>mid-sentence</p>");
t("spaced em dash becomes comma space", "a " + EM + " b", "<p>a, b</p>");
t("em dash inside bold is stripped", "**a " + EM + " b**",
  "<p><strong>a, b</strong></p>");
t("em dash inside a list item is stripped", "- a " + EM + " b",
  "<ul><li>a, b</li></ul>");
t("two em dashes in one line", "a " + EM + " b " + EM + " c", "<p>a, b, c</p>");

console.log("NOT IN THE SET — these stay literal");
t("no headings", "# Title", "<p># Title</p>");
t("no links", "[a](http://x)", "<p>[a](http://x)</p>");

console.log("EDGE");
t("empty", "", "");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
