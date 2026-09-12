#!/usr/bin/env node
// DAILY_CHECKLIST_ESCAPERS_V1 — the two escapers on the daily card, and why they
// must stay two.
//
// THE CONSTRAINT THIS EXISTS FOR. dcRenderCard writes the model-authored
// action_id into a data-aid attribute. dcToggle reads that attribute back and
// compares it to action.action_id before writing it to action_completions:
//
//   const aid = el.getAttribute('data-aid');
//   if(!__dcState.three.some(t => t.action.action_id === aid)) return;
//
// So the attribute is an IDENTITY, matched by equality against a value that is
// never passed through any escaper. If the attribute path ever gained a dash
// strip, an action_id containing an em dash would be rewritten on one side of
// that comparison only, dcToggle's guard would return early, and the tick would
// stop registering. Silently: no error, no console line, the row just never
// writes. That is the failure mode this file is here to make loud.
//
// dcProse is the PROSE path and MUST strip, because base_text and the
// phase_notes flavor are model prose rendered to the user.
//
// Both are extracted from shipped source rather than reimplemented, so a change
// to either in dashboard.html is what this suite reads.
//
//   node scripts/test-daily-checklist.mjs     (or DASH=path/to/dashboard.html)
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

const src = extract("dcEsc") + "\n" + extract("dcProse") +
  "\n;globalThis.__dcEsc = dcEsc; globalThis.__dcProse = dcProse;";
new Function(src)();
const dcEsc = globalThis.__dcEsc, dcProse = globalThis.__dcProse;

let pass = 0, fail = 0;
const eq = (label, got, want) => {
  if (got === want) { pass++; console.log("  ok   " + label); }
  else {
    fail++; console.log("  FAIL " + label);
    console.log("        got  " + JSON.stringify(got));
    console.log("        want " + JSON.stringify(want));
  }
};
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m))
                        : (fail++, console.log("  FAIL " + m)));

// The dash is written as an escape rather than the glyph so a copy-rule sweep
// for the literal character cannot silently rewrite the tests guarding it.
const EM = "—";

console.log("IDENTITY — dcEsc must NOT strip, because data-aid is matched by equality");
eq("an em dash inside an action_id survives dcEsc",
   dcEsc("act" + EM + "42"), "act" + EM + "42");
eq("a spaced em dash inside an action_id survives dcEsc",
   dcEsc("act " + EM + " 42"), "act " + EM + " 42");
ok(dcEsc("act" + EM + "42").indexOf(EM) !== -1,
   "the glyph is still present, not turned into a hyphen");
ok(dcEsc("a " + EM + " b").indexOf(", ") === -1,
   "no clause rewrite happened on the identity path");

console.log("IDENTITY — dcEsc still entity-encodes, which is its actual job");
eq("angle brackets", dcEsc("<b>"), "&lt;b&gt;");
eq("ampersand", dcEsc("a&b"), "a&amp;b");
eq("double quote", dcEsc('a"b'), "a&quot;b");
eq("single quote", dcEsc("a'b"), "a&#39;b");
eq("null becomes empty", dcEsc(null), "");

console.log("PROSE — dcProse MUST strip, and then encode");
eq("spaced em dash becomes comma space", dcProse("rest " + EM + " then walk"), "rest, then walk");
eq("bare em dash becomes a hyphen", dcProse("mid" + EM + "sentence"), "mid-sentence");
eq("two em dashes in one line", dcProse("a " + EM + " b " + EM + " c"), "a, b, c");
eq("strips and then encodes, both", dcProse("a " + EM + " <b>"), "a, &lt;b&gt;");
eq("null becomes empty", dcProse(null), "");

console.log("THE PAIR — they must not be the same function");
ok(dcEsc("a " + EM + " b") !== dcProse("a " + EM + " b"),
   "dcEsc and dcProse disagree on a dash, which is the whole point");

console.log("WIRING — the card uses each on the right field");
const card = extract("dcRenderCard");
ok(/data-aid="'\s*\+\s*dcEsc\(/.test(card),
   "data-aid is written with dcEsc, the identity escaper");
ok(/dc-base">'\s*\+\s*dcProse\(/.test(card),
   "base_text is written with dcProse, the prose pipe");
ok(/dc-flavor">'\s*\+\s*dcProse\(/.test(card),
   "the phase_notes flavor is written with dcProse");
ok(!/data-aid="'\s*\+\s*dcProse\(/.test(card),
   "data-aid is NOT written with dcProse");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
