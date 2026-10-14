#!/usr/bin/env node
// ONBOARDING_PALETTE_V1 -- the onboarding screens are off the old teal and Plus Jakarta look.
//
// WHAT IS PINNED. Every CSS rule whose selector targets an onboarding screen (#view-upload and its
// upload card, date of birth gate, consent row, dropzone, file row and draw card; the About-you
// modal .onb2-*; the age confirmation .onb-* / #age-modal; #view-processing and #view-pending)
// carries no --teal token, no teal hex or rgb, and no Plus Jakarta Sans. Comments are stripped
// first, because the rules explain what they replaced ("was teal") and a grep that reads comments
// fails on the documentation of the fix.
//
// WHAT IS NOT. The bare .eyebrow, .consent-row, .sana-send and h1 rules are shared with views that
// are out of scope (reveal deck, tester gate, Sana), so they keep their teal and are not matched.
// The out-of-scope control below proves teal still exists elsewhere, so scope held.
//
// CONTROLS. A mutant (a teal declaration added to .bc-start) must FAIL the checker, and the same
// declaration inside a comment must PASS it. Without both, a checker that matched nothing, or one
// that read comments, would look identical to a passing one.
//
//   node scripts/test-onboarding-palette.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));

const css = (html) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join("\n");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

// Flatten to [selector, declarations] pairs, descending into @media / @supports blocks.
function rules(src) {
  const out = [];
  const walk = (s) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf("{", i);
      if (open < 0) break;
      const sel = s.slice(i, open).trim();
      let depth = 1, j = open + 1;
      for (; j < s.length && depth; j++) { if (s[j] === "{") depth++; else if (s[j] === "}") depth--; }
      const body = s.slice(open + 1, j - 1);
      if (sel.startsWith("@media") || sel.startsWith("@supports")) walk(body);
      else if (!sel.startsWith("@")) out.push([sel, body]);
      i = j;
    }
  };
  walk(src);
  return out;
}

const IN_SCOPE = /^(body:has\(#view-(upload|processing|pending)|#view-upload|#view-processing|#view-pending|#age-modal|#onb2-|\.upload-card|\.dobg|\.dropzone|\.dz-|\.upload-meta|\.consent-row input:checked|\.file-row|\.up-ferr|\.bc-|\.cyc-|\.lmp-row|\.ad-submit|\.onb2-|\.onb-|\.spinner|\.proc-|\.pc-)/;
const BAD = /--teal|#0C8E6B|#097A5B|#B8E4D4|#E3F5EE|#F0F9F5|12\s*,\s*142\s*,\s*107|9\s*,\s*122\s*,\s*91|Plus Jakarta/i;

function check(html) {
  const all = rules(stripComments(css(html)));
  const scoped = all.filter(([sel]) => sel.split(",").some(s => IN_SCOPE.test(s.trim())));
  const bad = scoped.filter(([, body]) => BAD.test(body)).map(([sel, body]) => sel + " { " + body.match(BAD)[0] + " }");
  return { all, scoped, bad };
}

// 1. Known-positive: the extractor sees the in-scope rules at all.
const r = check(HTML);
ok(r.scoped.length >= 100, "in-scope rules found: " + r.scoped.length + " (expect 100 or more)");
for (const s of [".bc-start", ".bc-start[disabled]", ".onb2-next", ".onb2-chip.sel", ".onb2-opt.sel", ".dobg-h",
                 ".upload-card h1 em", ".spinner", ".onb-save", "#view-upload .upload-card", ".dobg .sana-send", ".onb2-bar span"])
  ok(r.scoped.some(([sel]) => sel === s), "in-scope rule present: " + s);

// 2. The claim: no teal and no Plus Jakarta in any in-scope rule.
ok(r.bad.length === 0, "no teal or Plus Jakarta in in-scope rules" + (r.bad.length ? ": " + r.bad.join(" | ") : ""));

// 3. Mutant must fail; the same value in a comment must pass.
const mutant = HTML.replace("</style>", ".bc-start{background:var(--teal)}\n</style>");
ok(check(mutant).bad.length === 1, "MUTANT: a teal .bc-start declaration is caught");
const mutantJ = HTML.replace("</style>", ".onb2-q-h{font-family:'Plus Jakarta Sans',sans-serif}\n</style>");
ok(check(mutantJ).bad.length === 1, "MUTANT: a Plus Jakarta .onb2-q-h declaration is caught");
const control = HTML.replace("</style>", "/* .bc-start{background:var(--teal)} rgb(12, 142, 107) Plus Jakarta */\n</style>");
ok(check(control).bad.length === 0, "CONTROL: the same values inside a comment pass");

// 4. Scope held: out-of-scope rules still draw in teal, and the :root teal tokens are unchanged.
for (const s of [".interim-dot", ".eyebrow::before", ".sana-send"])
  ok(r.all.some(([sel, b]) => sel === s && /var\(--teal\)/.test(b)), "out-of-scope " + s + " still uses --teal");
const root = (css(HTML).match(/:root\{([\s\S]*?)\n\}/) || [])[1] || "";
ok(/--teal:#0C8E6B; --teal-dark:#097A5B; --teal-mid:#B8E4D4; --teal-light:#E3F5EE; --teal-soft:#F0F9F5;/.test(root),
   ":root --teal tokens unchanged");
for (const t of ["--ink:#47372B", "--ink-hover:#2F241C", "--olive:#59663A", "--olive-dark:#4A5530", "--sage:#8C9A5B",
                 "--sage-soft:#E3E7D3", "--sage-pale:#F2F4EA", "--coral-deep:#9C5E47", "--coral-deep-text:#8E5340"])
  ok(root.includes(t), ":root defines " + t);

// 5. The one markup change: the progress bar, from the same c.n and c.total as the step text.
const lines = HTML.split("\n");
const stepAt = lines.findIndex(l => l.includes('h += \'<div class="onb2-step">\' + c.n + " of " + c.total'));
ok(stepAt > 0, "step text line unchanged");
ok(stepAt > 0 && /^\s*if\(c\.n > 0\) h \+= '<div class="onb2-bar" aria-hidden="true"><span style="width:' \+ Math\.round\(100 \* c\.n \/ c\.total\) \+ '%"><\/span><\/div>';/.test(lines[stepAt + 1]),
   "progress bar follows it, width from c.n and c.total, aria-hidden, no text");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
