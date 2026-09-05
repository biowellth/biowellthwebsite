#!/usr/bin/env node
// DOB_GATE_V1 -- the age computation, extracted from dashboard.html so the test exercises
// shipped source rather than a copy that can drift. Same technique as test-onb2-writefail.mjs.
//
// THE LOAD-BEARING PROPERTY: dobIsAdult must be TRUE on the 18th birthday and FALSE the day
// before it. An off-by-one here is not cosmetic -- it either refuses an adult or admits a minor,
// and migration 0044's server-side policy uses `dob <= current_date - interval '18 years'`,
// which is the same boundary. The two halves must agree or the client explains a refusal that
// did not happen, or fails to explain one that did.
//
//   node scripts/test-dob-gate.mjs        (or DASH=path/to/dashboard.html)
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

const src = extract("dobAgeYears") + "\n" + extract("dobIsAdult") +
            "\n;globalThis.__dobAgeYears = dobAgeYears; globalThis.__dobIsAdult = dobIsAdult;";
new Function(src)();
const dobAgeYears = globalThis.__dobAgeYears, dobIsAdult = globalThis.__dobIsAdult;

let pass = 0, fail = 0;
const ok  = (c, m) => c ? (pass++, console.log("  ok   " + m))
                        : (fail++, console.log("  FAIL " + m));
const eq  = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

// ── BOUNDARY. The reference day is fixed so the suite cannot pass or fail by calendar drift.
const REF = "2026-09-05T12:00:00Z";

console.log("BOUNDARY -- the 18th birthday itself");
eq(dobIsAdult("2008-09-05", REF), true,  "AGE-1: 18th birthday TODAY passes");
eq(dobAgeYears("2008-09-05", REF), 18,   "AGE-2: and computes as exactly 18");

console.log("BOUNDARY -- the day before");
eq(dobIsAdult("2008-09-06", REF), false, "AGE-3: 18th birthday TOMORROW fails");
eq(dobAgeYears("2008-09-06", REF), 17,   "AGE-4: and computes as 17");
eq(dobIsAdult("2008-10-01", REF), false, "AGE-5: birthday later this year fails");
eq(dobIsAdult("2008-08-01", REF), true,  "AGE-6: birthday earlier this year passes");

console.log("LEAP DAY");
// Born 29 Feb 2008. In 2026, a common year, the birthday falls on 1 March.
eq(dobAgeYears("2008-02-29", REF), 18,   "AGE-7: leap-day birth is 18 by September");
eq(dobIsAdult("2008-02-29", "2026-02-28T12:00:00Z"), false,
   "AGE-8: on 28 Feb of a common year the leap-day child is NOT yet 18");
eq(dobIsAdult("2008-02-29", "2026-03-01T12:00:00Z"), true,
   "AGE-9: on 1 March it is");
eq(dobAgeYears("2011-02-29", REF), null, "AGE-10: 29 Feb of a NON-leap year is not a date");

console.log("MALFORMED -- must be null, never a number that could read as adult");
for (const bad of ["", null, undefined, "2008", "2008-9-5", "08-09-05", "not-a-date",
                   "2008-13-01", "2008-00-10", "2008-09-32", "2008-09-05T00:00:00Z"]) {
  eq(dobAgeYears(bad, REF), null, "AGE-11: rejected " + JSON.stringify(bad));
  eq(dobIsAdult(bad, REF), false, "AGE-12: and is not adult " + JSON.stringify(bad));
}

console.log("KNOWN-POSITIVE CONTROL -- the harness can actually fail");
{
  // If extract() silently returned something inert, every assertion above would be vacuous.
  let threw = false;
  try { extract("thisFunctionDoesNotExist"); } catch (_) { threw = true; }
  ok(threw, "AGE-13: extract() throws on a missing function, so a silent no-op is impossible");
  ok(dobIsAdult("1990-01-01", REF) === true && dobIsAdult("2020-01-01", REF) === false,
     "AGE-14: the two obvious cases disagree, so the function is discriminating");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
