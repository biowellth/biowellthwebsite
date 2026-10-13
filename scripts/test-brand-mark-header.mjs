#!/usr/bin/env node
// BRAND_MARK_HEADER_V1 -- the site headers on index.html, science.html and privacy.html carry
// the real BioWellth mark, not an olive dot or plain text.
//
// WHAT IS PINNED, per page, inside the header element that holds the wordmark:
//   - an inline <svg> whose path data is byte-identical to dashboard.html's #bw-mark symbol, the
//     brown mark (NOT the olive-disc favicon.svg, whose geometry differs)
//   - aria-hidden="true" on it, with the wordmark text still present as the accessible name
//   - a fill of #47372B in the page's rule for that svg's class
//   - no element with class brand-dot anywhere on the page
// MUTANT. Each page with its old header put back must fail, which proves the checks read the
// header rather than passing by luck.
//
// LOGIN_BRAND_MARK_V1 (2026-10-13) adds login.html, whose .brand held a teal rounded square with a
// white "B" as a placeholder. It is checked the same way, plus: no "B" placeholder element and no
// teal gradient left on .brand-mark. Its mutant puts the "B" div back.
//
//   node scripts/test-brand-mark-header.mjs
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));

const DASH = readFileSync("dashboard.html", "utf8");
const sym = DASH.match(/<symbol id="bw-mark"[^>]*>([\s\S]*?)<\/symbol>/);
ok(!!sym, "BM-0: dashboard.html still carries the #bw-mark symbol, the source of truth");
const paths = (s) => [...s.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
const MARK = sym ? paths(sym[1]) : [];
ok(MARK.length === 2, "BM-0b: the mark is two paths  (" + MARK.length + ")");
const FAV = readFileSync("favicon.svg", "utf8");
ok(/<circle/.test(FAV), "BM-0c: favicon.svg is the olive disc, which is why it is NOT the header source");

const PAGES = [
  ["index.html",   /<a class="brand" href="\/"[^>]*>([\s\S]*?)<\/a>/,               "brand-mark"],
  ["science.html", /<a class="brand" href="\/"[^>]*>([\s\S]*?)<\/a>/,               "brand-mark"],
  ["privacy.html", /<div class="policy-nav-inner">\s*(?:<!--[\s\S]*?-->\s*)?<span>([\s\S]*?)<\/span>/, "policy-mark"],
  ["login.html",   /<div class="brand">([\s\S]*?<div class="brand-name">[\s\S]*?<\/div>)\s*<\/div>/, "brand-mark"],
];
const TOKEN = { "login.html": "LOGIN_BRAND_MARK_V1" };

function check(label, html, headerRe, cls) {
  const r = { header: false, svg: false, samePaths: false, hidden: false, name: false, fill: false, noDot: false };
  const h = html.match(headerRe);
  if (h) {
    r.header = true;
    const svg = h[1].match(/<svg class="([^"]+)"[^>]*>[\s\S]*?<\/svg>/);
    if (svg) {
      r.svg = svg[1] === cls;
      const p = paths(svg[0]);
      r.samePaths = p.length === MARK.length && p.every((d, i) => d === MARK[i]);
      r.hidden = /aria-hidden="true"/.test(svg[0].slice(0, svg[0].indexOf(">")));
    }
    r.name = h[1].replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "").trim() === "BioWellth";
  }
  r.fill = new RegExp("\\." + cls + "\\{[^}]*fill:#47372B").test(html);
  // An ELEMENT with the class, not a mention in a comment.
  r.noDot = !/class="[^"]*\bbrand-dot\b[^"]*"/.test(html);
  return r;
}

for (const [file, re, cls] of PAGES) {
  const html = readFileSync(file, "utf8");
  console.log("\n" + file);
  const r = check(file, html, re, cls);
  ok(r.header, "BM-1 " + file + ": the header wordmark element was found");
  ok(r.svg, "BM-2 " + file + ": it holds an inline svg." + cls);
  ok(r.samePaths, "BM-3 " + file + ": the svg's paths are byte-identical to dashboard.html's #bw-mark");
  ok(r.hidden, "BM-4 " + file + ": the svg is aria-hidden");
  ok(r.name, "BM-5 " + file + ": the wordmark text is still exactly BioWellth, the accessible name");
  ok(r.fill, "BM-6 " + file + ": ." + cls + " is filled #47372B");
  ok(r.noDot, "BM-7 " + file + ": no element carries the brand-dot class");
  const tok = TOKEN[file] || "BRAND_MARK_HEADER_V1";
  ok(html.indexOf(tok) > -1, "BM-8 " + file + ": the change token " + tok + " marks the site");
  if (file === "login.html") {
    ok(!/<div class="brand-mark">B<\/div>/.test(html), "BM-11 login.html: no \"B\" placeholder element");
    ok(!/\.brand-mark\{[^}]*linear-gradient/.test(html), "BM-12 login.html: .brand-mark carries no gradient any more");
  }

  // MUTANT: the pre-change header put back on this page.
  const OLD = file === "privacy.html"
    ? html.replace(/<span><svg class="policy-mark"[\s\S]*?<\/svg>BioWellth<\/span>/, "<span>BioWellth</span>")
    : file === "login.html"
    ? html.replace(/<svg class="brand-mark"[\s\S]*?<\/svg>/, '<div class="brand-mark">B</div>')
    : html.replace(/<svg class="brand-mark"[\s\S]*?<\/svg>BioWellth<\/a>/, '<span class="brand-dot" aria-hidden="true"></span>BioWellth</a>');
  ok(OLD !== html, "BM-9 " + file + " MUTANT control: the old header was really put back");
  const m = check(file, OLD, re, cls);
  ok(!(m.svg && m.samePaths) || !m.noDot, "BM-10 " + file + " MUTANT: the old header fails BM-2/3 or BM-7, so they read the header");
  if (file === "login.html") ok(/<div class="brand-mark">B<\/div>/.test(OLD), "BM-13 login.html MUTANT: and it carries the \"B\" placeholder BM-11 rejects");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
