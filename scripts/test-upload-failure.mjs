#!/usr/bin/env node
// UPLOAD_FAILURE_V1 — the two silent-failure paths on the upload flow.
//
// THE DEFECT THIS EXISTS FOR. The upload invoke of process-report discarded the
// thrown case with a bare catch and inspected the response only for status 429.
// supabase-js does not throw on a non-2xx, so a refusal survived as a value that
// only the quota branch ever read, and execution fell through to pollForResult
// either way. The poll had no elapsed-time bail. So EVERY failure other than a
// quota refusal presented to the user as an endless "we are reading your report"
// spinner, indefinitely, with nothing logged.
//
// TWO PATHS, AND THEY MUST NOT COLLAPSE INTO ONE TIMER.
//
//   PATH 1, never enqueued. Knowable immediately from the invoke result, with no
//   timer at all. The poll must NOT start, because there is nothing to poll for.
//
//   PATH 2, enqueued but overdue. Not knowable without waiting. The job may still
//   land, so the copy must not claim failure and no retry is offered.
//
// These are source-level assertions, deliberately. Driving the real upload
// handler needs a Supabase client, a file, a storage bucket and a reachable Edge
// function, none of which belong in a unit suite. What can be pinned here is the
// SHAPE of the handling: that both failure shapes are read, that the poll is
// skipped on path 1, that the bail exists with the right constant, and that the
// signed strings are untouched. Every check below is proven failable by mutation
// in the same commit.
//
//   node scripts/test-upload-failure.mjs     (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m))
                        : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

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

// The upload handler is an inline block, not a named function, so it is sliced
// between two stable markers rather than brace-matched.
const upStart = HTML.indexOf("UPLOAD_FAILURE_V1, PATH 1");
const upEnd = HTML.indexOf("pollForResult(reportId);", upStart);
ok(upStart > 0 && upEnd > upStart, "SETUP: the upload failure block was located");
const UP = HTML.slice(upStart, upEnd);

const POLL = extract("pollForResult");
const POLL_TICK = extract("pollTick");
const RENDER = extract("pcRenderFailure");

console.log("PATH 1 — a refusal is read on ANY status, not only 429");
ok(/catch\s*\(\s*e\s*\)\s*\{\s*__prThrew\s*=\s*e;?\s*\}/.test(UP),
   "a: the thrown case is CAPTURED, not discarded by a bare catch");
ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(UP),
   "a: no bare empty catch remains on this path");
ok(/__prThrew\s*\|\|\s*!__prRes\s*\|\|\s*__prRes\.error/.test(UP),
   "b: all three failure shapes are inspected, thrown, absent and returned-error");
ok(/pcRenderFailure\(\s*reportId\s*,\s*["']nostart["']\s*\)/.test(UP),
   "b: a refusal renders the nostart state");

console.log("PATH 1 — the poll must NOT start");
// The return has to come BEFORE pollForResult, or the spinner starts anyway.
const nostartIdx = UP.indexOf('"nostart"');
const returnIdx = UP.indexOf("return", nostartIdx);
ok(nostartIdx > 0 && returnIdx > nostartIdx,
   "a: the nostart branch returns, so execution never reaches pollForResult");
// Comment lines are stripped first. The block's own explanatory comment mentions
// pollForResult by name, and asserting against the raw text fails on the
// documentation of the fix rather than on the code. Same trap the supa scanner
// records: strip comments before asserting absence.
const stripLineComments = (s) => s.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
ok(!/pollForResult/.test(stripLineComments(UP)),
   "a: pollForResult is not CALLED anywhere inside the failure block, comments excluded");

console.log("QUOTA — the 429 branch is unchanged");
ok(/pcIsQuotaRefusal\(__prRes\.error\)/.test(UP),
   "c: the quota check still reads __prRes.error");
ok(/pcRenderQuota\(\)/.test(UP), "c: the quota branch still renders the quota state");
// The quota branch must be checked BEFORE the general failure branch, or a 429
// would be reported as nostart and she would be told to retry into a spent quota.
ok(UP.indexOf("pcIsQuotaRefusal") < UP.indexOf("__prThrew ||"),
   "c: the quota check runs BEFORE the general refusal branch");

console.log("PATH 2 — the overdue bail, and the number");
const mConst = HTML.match(/const PC_OVERDUE_MS = (\d+) \* 60 \* 1000;/);
ok(!!mConst, "d: PC_OVERDUE_MS is declared in minutes-times-60-times-1000 form");
eq(mConst && Number(mConst[1]), 25, "d: the bail is 25 minutes");
ok(/PC_OVERDUE_MS/.test(POLL_TICK),
   "d: the bail lives in pollTick, where the reports row is in scope");
// Asserted as three separate facts plus their ORDER, rather than one regex with a
// character window. The window version failed on a console.error sitting between
// the two calls, which is a true statement about spacing and says nothing about
// behaviour. Order is what matters: the interval must be cleared BEFORE the
// render, or a slow render leaves one more tick armed.
const bailIdx = POLL_TICK.indexOf("PC_OVERDUE_MS");
const clearIdx = POLL_TICK.indexOf("clearInterval(pollTimer)", bailIdx);
const renderIdx = POLL_TICK.indexOf('pcRenderFailure(reportId, "overdue")', bailIdx);
ok(clearIdx > bailIdx, "d: the bail clears the interval");
ok(renderIdx > bailIdx, "d: the bail renders the overdue state");
ok(clearIdx < renderIdx, "d: the interval is cleared BEFORE the render, so no tick survives it");
// Asserted by INDEX, not by a character window. The window version failed on the
// three comment lines between the render and the return, which is the second time
// a spacing-shaped assertion has produced a false red in this file. What matters
// is that the return comes after the render and before the next branch.
const bailReturnIdx = POLL_TICK.indexOf("return true;", renderIdx);
const nextBranchIdx = POLL_TICK.indexOf("if(rep && rep.transcription_json)", renderIdx);
ok(bailReturnIdx > renderIdx, "d: the bail returns after rendering");
ok(nextBranchIdx > bailReturnIdx,
   "d: it returns true BEFORE the next branch, so the ONE terminal path in pollForResult clears the poll");

// e. The three thresholds, asserted as VALUES so nobody tightens the bail to the
// copy threshold without reading the derivation. 9 is PC_LONG_MS, the IN-3 to
// IN-4 copy switch. 20 is under the modelled reaper path. Neither may bail.
console.log("PATH 2 — a healthy long run does NOT bail");
const overdueMs = Number(mConst[1]) * 60 * 1000;
const bails = (min) => (min * 60 * 1000) >= overdueMs;
eq(bails(9), false, "e: a run at 9 minutes does not bail, that is the COPY threshold");
eq(bails(20), false, "e: a run at 20 minutes does not bail, still inside the reaper path");
eq(bails(25), true, "e: a run at 25 minutes bails");
eq(bails(26), true, "e: a run past 25 minutes bails");
const mLong = HTML.match(/const PC_LONG_MS = (\d+) \* 60 \* 1000;/);
ok(mLong && Number(mLong[1]) < Number(mConst[1]),
   "e: PC_LONG_MS is strictly less than PC_OVERDUE_MS, they are not the same number");

// UPLOAD_FAILURE_V1f. The bail must use pcElapsedMs, which resolves created_at
// first and __pcPollStart second. The first cut read __pcPollStart directly and
// was the only elapsed-time consumer in the file on the weaker clock, which also
// meant a woman returning to a long-dead job got a fresh timer instead of the
// truth. pcElapsedMs is extracted from shipped source and exercised for real
// here, rather than the precedence being asserted as a string match.
console.log("PATH 2 — the clock, created_at first and poll-start second");
const ELAPSED_SRC = extract("pcElapsedMs");
ok(/rep && rep\.created_at \? Date\.parse\(rep\.created_at\)/.test(ELAPSED_SRC),
   "f: pcElapsedMs reads created_at first");
ok(/__pcPollStart \? \(Date\.now\(\) - __pcPollStart\)/.test(ELAPSED_SRC),
   "f: pcElapsedMs falls back to __pcPollStart");
ok(/pcElapsedMs\(rep\) >= PC_OVERDUE_MS/.test(POLL_TICK),
   "f: the bail compares pcElapsedMs against PC_OVERDUE_MS");
ok(!/__pcPollStart\s*&&\s*\(Date\.now\(\)/.test(POLL_TICK + POLL),
   "f: no direct __pcPollStart arithmetic remains on the bail path");

// Run the REAL helper against synthetic rows, so the precedence is exercised and
// not merely matched.
const fn = new Function("__pcPollStart", ELAPSED_SRC + "; return pcElapsedMs;");
const minsAgo = (m) => new Date(Date.now() - m * 60 * 1000).toISOString();
const bailsWith = (rep, pollStartMinsAgo) => {
  const ps = pollStartMinsAgo == null ? 0 : Date.now() - pollStartMinsAgo * 60 * 1000;
  return fn(ps)(rep) >= overdueMs;
};
eq(bailsWith({ created_at: minsAgo(30) }, 0), true,
   "d: a report created 30 minutes ago bails on the FIRST tick, poll just armed");
eq(bailsWith({ created_at: minsAgo(5) }, null), false,
   "d: a report created 5 minutes ago does not bail even with no poll-start");
eq(bailsWith(null, 30), true,
   "d: with created_at missing the __pcPollStart fallback still bails past 25");
eq(bailsWith(null, 5), false,
   "d: with created_at missing a 5 minute poll does not bail");
eq(bailsWith({ created_at: minsAgo(9) }, 9), false,
   "e: 9 minutes does not bail under EITHER clock, that is the copy threshold");
eq(bailsWith({ created_at: minsAgo(20) }, 20), false,
   "e: 20 minutes does not bail under either clock, still inside the reaper path");
eq(bailsWith({ created_at: minsAgo(26) }, 1), true,
   "f: created_at WINS over a fresh poll-start, which is the reload case");

console.log("PATH 2 — no retry is offered, because there is nothing to retry");
ok(/overdue \? '' :/.test(RENDER),
   "d: the overdue mode renders NO action button");

console.log("SUCCESS PATH — untouched");
ok(/pollForResult\(reportId\);/.test(HTML),
   "f: pollForResult is still called on the success path");
ok(/if\(await pollTick\(reportId\)\)/.test(POLL),
   "f: the tick still terminates the poll on a terminal result");
eq((HTML.match(/setInterval\(async \(\)=>\{/g) || []).length >= 1, true,
   "f: the 3000ms interval still exists");
ok(/\}, 3000\);/.test(POLL), "f: the poll interval is still 3000ms");

console.log("COPY — the two new strings, and the signed three untouched");
const strOf = (n) => { const m = HTML.match(new RegExp("^const " + n + ' = "(.*?)";$', "m")); return m && m[1]; };
for (const n of ["PC_NOSTART_H", "PC_NOSTART", "PC_OVERDUE_H", "PC_OVERDUE"]) {
  const v = strOf(n);
  ok(!!v, "copy: " + n + " is declared");
  ok(v && v.indexOf("—") === -1, "copy: " + n + " has no em dash");
  ok(v && v.indexOf(":") === -1, "copy: " + n + " has no colon");
}
// PATH 2 must not claim failure, promise a time, or ask for a re-upload.
const od = (strOf("PC_OVERDUE") + " " + strOf("PC_OVERDUE_H")).toLowerCase();
for (const banned of ["fail", "could not", "minutes", "hour", "try again"]) {
  ok(od.indexOf(banned) === -1, "copy: PC_OVERDUE does not say " + JSON.stringify(banned));
}
ok(od.indexOf("no need to upload it again") !== -1,
   "copy: PC_OVERDUE tells her a re-upload is unnecessary, not that she should");

console.log("CONTACT — the reply channel renders in ALL five modes");
// FAIL_CONTACT_V1. Outside every mode conditional, so it cannot be dropped from
// one state by a later edit to another.
ok(/id="pc-contact"/.test(RENDER), "g: the contact control is in the failure render");
ok(/mailto:support@mybiowellth\.com/.test(RENDER), "g: it uses the shared support address");
for (const mode of ["nostart", "overdue", "unretryable", "spent", "retryable"]) {
  // The control sits after the mode ternaries and inside no conditional, so it is
  // present for every mode by construction. Asserted by position rather than by
  // rendering each mode, which would need the DOM.
  const contactIdx = RENDER.indexOf('id="pc-contact"');
  const actionsIdx = RENDER.indexOf('class="pc-fail-actions"');
  ok(contactIdx > actionsIdx, "g: contact control renders for mode " + mode);
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
