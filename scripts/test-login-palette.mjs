#!/usr/bin/env node
// LOGIN_PALETTE_V1 -- login.html is off the old teal palette and the Plus Jakarta font.
//
// WHAT IS PINNED, in login.html's CODE (CSS, markup, scripts), with comments stripped first:
//   - no #0C8E6B and no #097A5B (the old teal and teal-dark), in any case
//   - no --teal custom property, declared or used
//   - no Plus Jakarta, either as a font-family name or in a Google Fonts URL
//   - the font link is index.html's Fraunces plus Instrument Sans link
// WHY COMMENTS ARE STRIPPED. A "must not appear" check that reads comments fails on the comment
// that explains what was removed (LOGIN_BRAND_MARK_V1 and this change both record the old values),
// so it would report a false failure on the documentation of the fix.
// MUTANTS. Each forbidden value injected into real CSS or markup must fail; the same value inside a
// comment must still pass, which proves the stripping is deliberate and not hiding a real hit.
//
//   node scripts/test-login-palette.mjs        (or LOGIN=path/to/login.html)
import { readFileSync } from "node:fs";

const FILE = process.env.LOGIN || "login.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const FORBIDDEN = [
  ["#0C8E6B (old teal)", /#0C8E6B/i],
  ["#097A5B (old teal-dark)", /#097A5B/i],
  ["a --teal custom property", /--teal\b/],
  ["Plus Jakarta (font name)", /Plus Jakarta/i],
  ["Plus+Jakarta (font URL)", /Plus\+Jakarta/i],
];
function findings(html) {
  const code = strip(html);
  return FORBIDDEN.filter(([, re]) => re.test(code)).map(([name]) => name);
}

console.log("LOGIN PALETTE -- " + FILE);
const hits = findings(HTML);
for (const [name] of FORBIDDEN) ok(!hits.includes(name), "LP-1: no " + name + " in the page's code");
const INDEX_FONTS = (readFileSync("index.html", "utf8").match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)" rel="stylesheet"\/>/) || [])[1];
ok(!!INDEX_FONTS, "LP-2 CONTROL: index.html's Google Fonts link was found");
ok(INDEX_FONTS && HTML.includes('<link href="' + INDEX_FONTS + '" rel="stylesheet"/>'), "LP-3: login.html loads exactly index.html's font link (Fraunces plus Instrument Sans)");
ok(/\.btn\{[^}]*background:var\(--brown\);color:var\(--cream\)/.test(HTML), "LP-4: the button is the ink pill, --brown with --cream text");
ok(HTML.indexOf("LOGIN_PALETTE_V1") > -1, "LP-5: the change token marks the site");

console.log("\nMUTANTS -- each forbidden value in real code must fail, and only in real code");
const ROOT = ":root{";
const MUTANTS = [
  ["teal hex in a rule", HTML.replace(".btn{", ".btn{border-color:#0C8E6B;"), "#0C8E6B (old teal)"],
  ["teal-dark hex in a rule", HTML.replace(".btn{", ".btn{outline-color:#097a5b;"), "#097A5B (old teal-dark)"],
  ["a --teal token back in :root", HTML.replace(ROOT, ROOT + "\n  --teal:#0C8E6B;"), "a --teal custom property"],
  ["Plus Jakarta as a font-family", HTML.replace(".brand-name{", ".brand-name{font-family:'Plus Jakarta Sans',sans-serif;"), "Plus Jakarta (font name)"],
  ["Plus Jakarta back in the font URL", HTML.replace("family=Fraunces", "family=Plus+Jakarta+Sans:wght@700&family=Fraunces"), "Plus+Jakarta (font URL)"],
];
for (const [label, mutated, expect] of MUTANTS) {
  ok(mutated !== HTML, "LP-6 control: the " + label + " mutant really changed the page");
  ok(findings(mutated).includes(expect), "LP-7 MUTANT " + label + ": caught as " + expect);
}
const commentOnly = HTML.replace(ROOT, ROOT + "\n  /* was --teal:#0C8E6B with Plus Jakarta */");
ok(findings(commentOnly).length === 0, "LP-8 CONTROL: the same values inside a comment are not reported, so LP-1 reads code only");

// ERROR_CONTRAST_V1 -- the .msg.err text clears WCAG AA 4.5:1 on its own fill. Both colours are read
// from the page's CSS with comments stripped and var() resolved through :root, so the ratio is the one
// the browser paints (the Playwright run in the PR measured the same 5.42:1 from computed styles).
console.log("\nERROR CONTRAST -- .msg.err");
const lum = (h) => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  .map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function errPair(html) {
  const code = strip(html);
  const root = (code.match(/:root\{([\s\S]*?)\}/) || [])[1] || "";
  const tok = (v) => { const m = v.match(/^var\((--[\w-]+)\)$/); if (!m) return v;
    const d = root.match(new RegExp(m[1] + ":\\s*(#[0-9A-Fa-f]{6})")); return d ? d[1] : null; };
  const rule = (code.match(/\.msg\.err\{([^}]*)\}/) || [])[1] || "";
  const fg = tok(((rule.match(/(?:^|;)color:([^;]+)/) || [])[1] || "").trim());
  const bg = tok(((rule.match(/background:([^;]+)/) || [])[1] || "").trim());
  return { rule, fg, bg, r: fg && bg ? ratio(fg, bg) : 0 };
}
const ep = errPair(HTML);
ok(!!ep.rule && !!ep.fg && !!ep.bg, "EC-1 CONTROL: .msg.err found and both colours resolved (" + ep.fg + " on " + ep.bg + ")");
ok(/color:var\(--coral-deep-text\)/.test(ep.rule), "EC-2: .msg.err text is var(--coral-deep-text)");
ok(/--coral-deep-text:#8E5340/.test(strip(HTML)), "EC-3: --coral-deep-text is #8E5340 in :root");
ok(/background:var\(--coral-light\)/.test(ep.rule) && /border:1px solid #EAC9BF/.test(ep.rule), "EC-4: fill and border are unchanged");
ok(ep.r >= 4.5, "EC-5: .msg.err text contrast " + ep.r.toFixed(2) + ":1 is at least 4.5:1");
const ecMutant = HTML.replace("color:var(--coral-deep-text);border:1px solid #EAC9BF", "color:var(--coral-dark);border:1px solid #EAC9BF");
ok(ecMutant !== HTML, "EC-6 control: the --coral-dark mutant really changed the page");
const em = errPair(ecMutant);
ok(em.r > 0 && em.r < 4.5, "EC-7 MUTANT: the old --coral-dark text is caught at " + em.r.toFixed(2) + ":1");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
