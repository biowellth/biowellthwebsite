#!/usr/bin/env node
// REVEAL_PALETTE_V1 -- the post-reading walkthrough (#view-reveal), the "Still reading" screen
// (#view-interim) and the cycle card accent are off teal and Plus Jakarta.
//
// WHAT IS PINNED, with comments stripped first (CSS block comments, JS line comments):
//   - every CSS rule scoped to #view-reveal, and every .interim-* / .itile-* / .isys-* rule, carries
//     no --teal token, no teal hex or rgb and no Plus Jakarta
//   - the reveal ring colour code in animateRing and the initial ringStyle contain no var(--teal),
//     and the ring arc is var(--coral-deep)
//   - CY_ACCENT follicular is not var(--teal) (it is var(--olive))
//   - the :root --teal tokens are unchanged, because other views still draw with them (corrected by
//     LEFTOVERS_PALETTE_V1: they now point at olive and sage, so the views that name them no longer paint teal)
// WHY COMMENTS ARE STRIPPED. The rules explain what they replaced ("was --teal"), and a check that
// reads comments fails on the documentation of the fix.
// CONTROLS. Mutants (a teal reveal rule, a Plus Jakarta interim rule, var(--teal) back in the ring
// expression, CY_ACCENT follicular back to teal) must fail; the same text inside comments must pass.
//
//   node scripts/test-reveal-palette.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));

const css = (html) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
const js = (html) => [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n")
  .split("\n").map(l => /^\s*\/\//.test(l) ? "" : l.replace(/\s\/\/\s.*$/, "")).join("\n");

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
      if (sel.startsWith("@media") || sel.startsWith("@supports")) walk(body); else out.push([sel, body]);
      i = j;
    }
  };
  walk(src);
  return out;
}
const IN_SCOPE = /^(#view-reveal\b|#view-interim\b|\.interim-|\.itile|\.isys)/;
const BAD = /--teal|#0C8E6B|#097A5B|#B8E4D4|#E3F5EE|#F0F9F5|12\s*,\s*142\s*,\s*107|9\s*,\s*122\s*,\s*91|240\s*,\s*249\s*,\s*245|Plus Jakarta/i;

function cssCheck(html) {
  const all = rules(css(html));
  const scoped = all.filter(([sel]) => sel.split(",").some(s => IN_SCOPE.test(s.trim())));
  return { all, scoped, bad: scoped.filter(([, b]) => BAD.test(b)).map(([sel, b]) => sel.slice(0, 60) + " { " + b.match(BAD)[0] + " }") };
}
function jsCheck(html) {
  const code = js(html);
  const ringInit = (code.match(/const ringStyle = [^;]+;/) || [""])[0];
  const anim = (code.match(/function animateRing\(\)\{[\s\S]*?\n {2}\}/) || [""])[0];
  const col = (anim.match(/const col = [^;]+;/) || [""])[0];
  const stroke = (anim.match(/fg\.style\.stroke = [^;]+;/) || [""])[0];
  const cy = (code.match(/const CY_ACCENT = \{[^}]*\}/) || [""])[0];
  const fol = (cy.match(/follicular:\s*'([^']+)'/) || [])[1] || "";
  return { ringInit, anim, col, stroke, cy, fol };
}

console.log("REVEAL PALETTE -- " + FILE);
const r = cssCheck(HTML);
ok(r.scoped.length >= 150, "RP-1 CONTROL: in-scope rules found: " + r.scoped.length + " (expect 150 or more)");
for (const s of ["#view-reveal .eyebrow", "#view-reveal .display", "#view-reveal .navbtn.next", "#view-reveal .qcard", "#view-reveal .bandlabel",
                 "#view-reveal .pm-h", "#view-reveal .b5-name", ".interim-dot", ".itile-n", ".isys-tile"])
  ok(r.scoped.some(([sel]) => sel.replace(/\s+/g, " ") === s), "RP-2: in-scope rule present: " + s);
ok(r.bad.length === 0, "RP-3: no teal or Plus Jakarta in any #view-reveal or interim rule" + (r.bad.length ? ": " + r.bad.join(" | ") : ""));

const j = jsCheck(HTML);
ok(!!j.ringInit && !!j.col && !!j.stroke && !!j.cy, "RP-4 CONTROL: ringStyle, the ring colour expression, the stroke assignment and CY_ACCENT were found");
ok(!/var\(--teal/.test(j.ringInit + j.col + j.stroke), "RP-5: the ring colour code contains no var(--teal)");
ok(/var\(--coral-deep\)/.test(j.ringInit) && /fg\.style\.stroke = 'var\(--coral-deep\)'/.test(j.stroke), "RP-6: the ring arc is var(--coral-deep), initially and when animated");
ok(/var\(--sage\)/.test(j.col) && /var\(--amber\)/.test(j.col) && /var\(--coral\)/.test(j.col), "RP-7: the vischip dot keeps three tiers, sage, amber and coral");
ok(j.fol && j.fol !== "var(--teal)", "RP-8: CY_ACCENT follicular is not var(--teal)");
ok(j.fol === "var(--olive)", "RP-9: CY_ACCENT follicular is var(--olive) (got " + j.fol + ")");
const root = (css(HTML).match(/:root\{([\s\S]*?)\n\}/) || [])[1] || "";
// LEFTOVERS_PALETTE_V1 (2026-10-14) re-pointed the :root teal tokens at olive and sage on purpose, so no view can
// paint teal. This assertion pinned the old hexes; it now pins the re-point instead, and still fails if :root drifts.
ok(/--teal:var\(--olive\); --teal-dark:var\(--olive-dark\); --teal-mid:var\(--sage-mid\); --teal-light:var\(--sage-soft\); --teal-soft:var\(--sage-pale\);/.test(root), "RP-10: :root --teal tokens point at olive and sage (LEFTOVERS_PALETTE_V1)");

console.log("\nMUTANTS -- each must fail, and only in real code");
const M = [
  ["a teal reveal rule", HTML.replace("</style>", "#view-reveal .navbtn.next{background:var(--teal)}\n</style>"), (h) => cssCheck(h).bad.length === 1],
  ["a Plus Jakarta interim rule", HTML.replace("</style>", ".itile-n{font-family:'Plus Jakarta Sans',sans-serif}\n</style>"), (h) => cssCheck(h).bad.length === 1],
  ["var(--teal) back in the ring expression", HTML.replace("const col = composite>=70 ? 'var(--sage)'", "const col = composite>=70 ? 'var(--teal)'"), (h) => /var\(--teal/.test(jsCheck(h).col)],
  ["CY_ACCENT follicular back to teal", HTML.replace("follicular: 'var(--olive)'", "follicular: 'var(--teal)'"), (h) => jsCheck(h).fol === "var(--teal)"],
];
for (const [label, m, caught] of M) { ok(m !== HTML, "RP-11 control: the " + label + " mutant changed the page"); ok(caught(m), "RP-12 MUTANT " + label + ": caught"); }
const ctlCss = HTML.replace("</style>", "/* #view-reveal .navbtn.next{background:var(--teal)} Plus Jakarta */\n</style>");
ok(cssCheck(ctlCss).bad.length === 0, "RP-13 CONTROL: teal and Plus Jakarta inside a CSS comment pass");
const ctlJs = HTML.replace("const CY_ACCENT = {", "// const CY_ACCENT = { follicular: 'var(--teal)' } was the old value\nconst CY_ACCENT = {");
ok(jsCheck(ctlJs).fol === "var(--olive)", "RP-14 CONTROL: the old CY_ACCENT inside a JS comment is not read");
ok(HTML.includes("REVEAL_PALETTE_V1"), "RP-15: the change token marks the site");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
