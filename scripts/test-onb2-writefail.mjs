#!/usr/bin/env node
// ONB2_WRITEFAIL_V1 — a refused profile write must not look like a saved one.
//
// THE LOAD-BEARING PROPERTY: onb2Advance must not advance when onb2Write returns
// false, and onb2Finish must not show the done card unless the write that records
// the flow as finished was accepted.
// Extracts the real functions from dashboard.html, the same technique as
// scripts/test-consent-gate.mjs, so it tests what ships.
//
// WHY IT EXISTS. Until 2026-09-04 onb2Advance did `await onb2Write(...)` and threw
// the result away. A minor entering a real date of birth was refused by the
// profiles_dob_adult CHECK, saw onboarding complete normally, and ended with dob
// NULL -- the state the upload policies permit, since they gate on consent and
// never on age.
//
// RE-POINTED 2026-09-23 (ABOUT_YOU_V1). The dob screen left this flow; the DOB gate
// owns date of birth. The done card's gate moved with it: from a dob READ-BACK to
// the about_you_status 'completed' WRITE. Every former assertion maps to one of the
// same strength on the new gate; nothing was dropped:
//   READBACK-1/2  "no done card / retry copy when dob is still null"
//              -> FINISHFAIL-1/2 "no done card / retry copy when the completed write is refused"
//   SKIP-1/2      "a skipped dob still finishes / no message"
//              -> SKIP-1/2 "an unanswered screen still finishes / no message"
//   READERR-1/2   "no done card when the read-back errors / throws"
//              -> FINISH-1/2 "the finishing write is exactly completed + a timestamp,
//                 and it is written before the done card"
//   READERR-3/4   "error alone blocks done, with no dob answered" (isolation)
//              -> FINISHFAIL-3/4 "a refused completed write ALONE blocks done and
//                 shows the retry copy, with no screen answered" (same isolation)
//   WRITEFAIL-4   "does not read back after a failed write" (no read exists any more,
//                 so it would pass vacuously)
//              -> WRITEFAIL-4 "does not attempt the completed write after a failed
//                 screen write"
//
// MUTATION LEDGER, run 2026-09-04. Baseline 15 passed; 4 of 4 caught. (That ledger
// describes the read-back version; the About-you mutants are in test-about-you.mjs.)
//
//   node scripts/test-onb2-writefail.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

/** Pull `function NAME(...)` or `async function NAME(...)` with brace matching. */
function extract(name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found: " + name);
  let i = HTML.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  return HTML.slice(m.index, end);
}

const SRC = ["onb2Msg", "onb2Advance", "onb2Finish"].map(extract).join("\n\n");

// writeResults: one boolean per onb2Write call, in order. The last value repeats.
function makeCtx({ writeResults, answered }) {
  const log = { advanced: false, doneShown: false, writes: [], order: [] };
  const msgEl = { textContent: "" };
  const card = { querySelector: () => msgEl };
  const ctx = {
    onb2: { idx: 0, ans: answered ? { preg: false } : {}, stored: {},
            cards: [{ id: "preg", key: "preg" }], hist: [], open: true },
    ONB2_COPY: { writeFail: "We could not save that. Please try again." },
    USER: { id: "00000000-0000-4000-8000-000000000001" },
    document: { querySelector: () => card, querySelectorAll: () => [] },
    onb2Write: async (patch) => {
      if (!patch || !Object.keys(patch).length) return true;   // the real onb2Write's empty-patch rule
      log.writes.push(patch); log.order.push("write");
      const k = Math.min(log.writes.length - 1, writeResults.length - 1);
      return writeResults[k];
    },
    onb2Patch: () => (answered ? { pregnant_or_postpartum_within_6_months: false } : {}),
    onb2NextIdx: () => -1,           // force the finish path
    onb2Leap: () => { log.advanced = true; log.order.push("leap"); },
    onb2Transit: () => {}, onb2Present: () => { log.doneShown = true; },
    onb2Pan: () => {}, onb2Seeds: () => {}, onb2SyncBack: () => {},
    onb2SeatOrb: () => {}, onb2Close: () => {},
    setTimeout: () => {},
    sb: { from: () => { throw new Error("onb2Finish must not read the profile any more"); } },
    log, msgEl,
  };
  return ctx;
}

async function run(opts) {
  const ctx = makeCtx(opts);
  const names = Object.keys(ctx);
  const fn = new Function(...names, SRC + "\n; return onb2Advance;");
  const advance = fn(...names.map((n) => ctx[n]));
  await advance(false);
  ctx.log.msg = ctx.msgEl.textContent;
  return ctx.log;
}

const FAIL = "We could not save that. Please try again.";
const isCompleted = (p) => p && p.about_you_status === "completed";
let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log("  ok   " + name); }
                            else { fail++; console.log("  FAIL " + name); } };

// 1. screen write fails -> no advance, retry copy shown, finish never attempted
{
  const r = await run({ writeResults: [false], answered: true });
  t("WRITEFAIL-1: does not advance when the write fails", r.advanced === false);
  t("WRITEFAIL-2: shows the retry copy",                  r.msg === FAIL);
  t("WRITEFAIL-3: does not show the done card",           r.doneShown === false);
  t("WRITEFAIL-4: does not attempt the completed write after a failed screen write",
    r.writes.length === 1 && !isCompleted(r.writes[0]));
}
// 2. screen write and completed write both succeed -> done, no message
{
  const r = await run({ writeResults: [true, true], answered: true });
  t("PASS-1: advances when both writes succeed", r.advanced === true);
  t("PASS-2: shows the done card",               r.doneShown === true);
  t("PASS-3: shows no message",                  r.msg === "");
}
// 3. screen write ok, completed write REFUSED -> the shape a refusal takes now
{
  const r = await run({ writeResults: [true, false], answered: true });
  t("FINISHFAIL-1: no done card when the completed write is refused", r.doneShown === false);
  t("FINISHFAIL-2: shows the retry copy",                             r.msg === FAIL);
}
// 4. screen NOT answered -> empty patch writes nothing, and the flow still finishes
{
  const r = await run({ writeResults: [true], answered: false });
  t("SKIP-1: an unanswered screen still finishes", r.doneShown === true);
  t("SKIP-2: no message on an unanswered screen",  r.msg === "");
}
// 5. the finishing write itself: its content, and that it lands BEFORE the done card
{
  const a = await run({ writeResults: [true, true], answered: true });
  const last = a.writes[a.writes.length - 1] || {};
  t("FINISH-1: the finishing write is exactly completed plus a timestamp",
    isCompleted(last) && Object.keys(last).sort().join(",") === "about_you_at,about_you_status" &&
    !isNaN(Date.parse(last.about_you_at)));
  t("FINISH-2: the completed write happens before the done card",
    a.order.lastIndexOf("write") >= 0 && a.order.lastIndexOf("write") < a.order.lastIndexOf("leap"));
  // ISOLATES the finish gate. With no screen answered there is no screen write, so
  // ONLY the completed write can stop the done card.
  const c = await run({ writeResults: [false], answered: false });
  t("FINISHFAIL-3: a refused completed write alone blocks done, with no screen answered", c.doneShown === false);
  t("FINISHFAIL-4: and shows the retry copy, with no screen answered", c.msg === FAIL);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
