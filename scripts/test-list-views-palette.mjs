#!/usr/bin/env node
// LIST_VIEWS_PALETTE_V1 -- the all-markers, trends, gaps, themes and systems pages, the system modal
// and the marker band are off teal and Plus Jakarta, and ST_COLOR's "Looks good" is sage.
//
// WHAT IS PINNED, with CSS comments stripped first:
//   - every CSS rule whose selector targets one of those surfaces carries no --teal token, no teal
//     hex or rgb, and no Plus Jakarta (the mkFlash keyframes, used only by .sm-marker, included)
//   - ST_COLOR 's-good' is #8C9A5B (--sage), not #0C8E6B, and 's-ref' is #B5C08E (--sage-mid);
//     's-watch', 's-flag' and 's-none' are unchanged
//   - the :root --teal tokens are unchanged, because out-of-scope views still draw with them
// WHAT IS NOT. The dashboard rail's own classes (.longi-card*, .longi-p*, .longi-preview,
// .longi-viewall, .longi-close-line, .longi-block, the bare .gap-card and .sysr-*) and every
// #view-dashboard-prefixed DASHBOARD_V2 rule are out of scope. A control below proves the rail still
// carries teal, so the exclusion is deliberate rather than a pattern that matches nothing.
// WHY COMMENTS ARE STRIPPED. The rules explain what they replaced ("was --teal"), and a "must not
// appear" check that reads comments fails on the documentation of the fix.
// CONTROLS. Three mutants must fail (a teal pill, a Plus Jakarta row name, ST_COLOR back to teal) and
// the same values inside a comment must pass.
//
//   node scripts/test-list-views-palette.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));

const css = (html) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

// Flatten to [selector, body] pairs, descending into @media / @supports; @keyframes kept whole.
function rules(src) {
  const out = [];
  const walk = (s) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf("{", i); if (open < 0) break;
      const sel = s.slice(i, open).trim();
      let depth = 1, j = open + 1;
      for (; j < s.length && depth; j++) { if (s[j] === "{") depth++; else if (s[j] === "}") depth--; }
      const body = s.slice(open + 1, j - 1);
      if (sel.startsWith("@media") || sel.startsWith("@supports")) walk(body);
      else out.push([sel, body]);
      i = j;
    }
  };
  walk(src);
  return out;
}

const RAIL = /^\.(longi-card|longi-p(row|name|move|review)|longi-viewall|longi-close-line|longi-block|sysr-)|^\.gap-card(\s|$|\{|,)/;
const IN_SCOPE = /^(:is\(#view-(markers|trends|gaps|themes|systems)|:is\(\.markers-head|:is\(#view-markers|#view-(markers|trends|gaps|themes|systems)\b|#sys-modal\b|#trends-|#theme-wrap|\.markers-|\.trends-|\.gaps-|\.gap-|\.themes-|\.theme-|button\.theme-card|\.tp-|\.systems-|\.bm-|\.bodymap|\.sys-chip|\.sys-modal|\.sm-|\.bes-|\.longi-|\.mk-|@keyframes mkFlash)/;
const BAD = /--teal|#0C8E6B|#097A5B|#B8E4D4|#E3F5EE|#F0F9F5|12\s*,\s*142\s*,\s*107|9\s*,\s*122\s*,\s*91|Plus Jakarta/i;

function check(html) {
  const all = rules(stripComments(css(html)));
  const scoped = all.filter(([sel]) => sel.split(",").some(s => { s = s.trim(); return IN_SCOPE.test(s) && !RAIL.test(s); }));
  const bad = scoped.filter(([, body]) => BAD.test(body)).map(([sel, body]) => sel.slice(0, 70) + " { " + body.match(BAD)[0] + " }");
  return { all, scoped, bad };
}
function stColor(html) {
  const line = html.split("\n").find(l => /^\s*const ST_COLOR\s*=/.test(l)) || "";
  const get = (k) => ((line.match(new RegExp("'" + k + "'\\s*:\\s*'(#[0-9A-Fa-f]{6})'")) || [])[1] || "").toUpperCase();
  return { line, good: get("s-good"), watch: get("s-watch"), flag: get("s-flag"), none: get("s-none"), ref: get("s-ref") };
}

console.log("LIST VIEWS PALETTE -- " + FILE);
// 1. Known-positive: the extractor sees the in-scope rules.
const r = check(HTML);
ok(r.scoped.length >= 200, "LV-1 CONTROL: in-scope rules found: " + r.scoped.length + " (expect 200 or more)");
for (const s of [".markers-title", ".markers-pill.active", ".markers-search:focus", ".longi-tag.win", ".longi-dot.win", ".sm-status.s-good",
                 ".sys-chip.s-good", ".tp-chip-teal", ".theme-name", ".gap-sys", "#view-trends .longi-row,#view-trends .longi-row.win", "@keyframes mkFlash"])
  ok(r.scoped.some(([sel]) => sel.replace(/\s+/g, " ") === s), "LV-2: in-scope rule present: " + s);

// 2. The claim.
ok(r.bad.length === 0, "LV-3: no teal or Plus Jakarta in any in-scope rule" + (r.bad.length ? ": " + r.bad.join(" | ") : ""));

// 3. ST_COLOR.
const st = stColor(HTML);
ok(!!st.line, "LV-4 CONTROL: the ST_COLOR declaration was found");
ok(st.good !== "#0C8E6B", "LV-5: ST_COLOR 's-good' is not #0C8E6B");
ok(st.good === "#8C9A5B", "LV-6: ST_COLOR 's-good' is --sage #8C9A5B (got " + st.good + ")");
ok(st.ref === "#B5C08E", "LV-7: ST_COLOR 's-ref' is --sage-mid #B5C08E (got " + st.ref + ")");
ok(st.watch === "#D4A94A" && st.flag === "#D47C65" && st.none === "#D9CDBE", "LV-8: 's-watch', 's-flag' and 's-none' are unchanged");

// 4. Scope held: the :root teal tokens are unchanged, and teal still lives in the rail and outside.
const root = (css(HTML).match(/:root\{([\s\S]*?)\n\}/) || [])[1] || "";
ok(/--teal:#0C8E6B; --teal-dark:#097A5B; --teal-mid:#B8E4D4; --teal-light:#E3F5EE; --teal-soft:#F0F9F5;/.test(root), "LV-9: :root --teal tokens unchanged");
for (const s of [".sysr-all", ".interim-dot", ".eyebrow::before"])
  ok(r.all.some(([sel, b]) => sel === s && /var\(--teal\)/.test(b)), "LV-10 CONTROL: out-of-scope " + s + " still uses --teal");

// 5. Mutants must fail; the same values in a comment must pass.
const MUTANTS = [
  ["a teal active filter pill", HTML.replace("</style>", ".markers-pill.active{background:var(--teal)}\n</style>")],
  ["a Plus Jakarta trends row name", HTML.replace("</style>", ".longi-name{font-family:'Plus Jakarta Sans',sans-serif}\n</style>")],
  ["a teal hex in the modal", HTML.replace("</style>", "#sys-modal .sm-h{color:#0C8E6B}\n</style>")],
];
for (const [label, m] of MUTANTS) { ok(m !== HTML, "LV-11 control: the " + label + " mutant changed the page"); ok(check(m).bad.length === 1, "LV-12 MUTANT " + label + ": caught"); }
const stMutant = HTML.replace("'s-good':'#8C9A5B'", "'s-good':'#0C8E6B'");
ok(stMutant !== HTML, "LV-13 control: the ST_COLOR mutant changed the page");
ok(stColor(stMutant).good === "#0C8E6B" && stColor(stMutant).good !== "#8C9A5B", "LV-14 MUTANT ST_COLOR back to teal: caught by LV-5 and LV-6");
const commentOnly = HTML.replace("</style>", "/* .markers-pill.active{background:var(--teal)} .longi-name{font-family:'Plus Jakarta Sans'} #0C8E6B */\n</style>");
ok(check(commentOnly).bad.length === 0, "LV-15 CONTROL: the same values inside a comment pass");
ok(HTML.includes("LIST_VIEWS_PALETTE_V1"), "LV-16: the change token marks the site");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
