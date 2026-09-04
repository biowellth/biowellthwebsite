#!/usr/bin/env node
// ONB2_WRITEFAIL_V1 — a refused profile write must not look like a saved one.
//
// THE LOAD-BEARING PROPERTY: onb2Advance must not advance when onb2Write returns
// false, and onb2Finish must not show the done card unless a read-back agrees.
// Extracts the real functions from dashboard.html, the same technique as
// scripts/test-consent-gate.mjs, so it tests what ships.
//
// WHY IT EXISTS. Until 2026-09-04 onb2Advance did `await onb2Write(...)` and threw
// the result away. A minor entering a real date of birth was refused by the
// profiles_dob_adult CHECK, saw onboarding complete normally, and ended with dob
// NULL -- the state the upload policies permit, since they gate on consent and
// never on age.
//
// MUTATION LEDGER, run 2026-09-04. Baseline 15 passed; 4 of 4 caught.
//   restore the discarded return in onb2Advance        -> 1 failed
//   delete the dob read-back assertion                 -> 2 failed
//   make the read-back `error` branch a no-op          -> 1 failed
//   assert dob even when the screen was skipped        -> 2 failed
//
// The third row is why READERR-3 and -4 exist. With dob answered, deleting the
// error branch still fails closed via the dob assertion, so the suite passed and
// the guard looked tested when it was not. Those two cases answer with dob NOT
// answered, where only the error branch can block.
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

function makeCtx({ writeOk, readBack, readThrows, readError, answeredDob }) {
  const log = { msgs: [], advanced: false, doneShown: false, writes: 0, reads: 0 };
  const msgEl = { textContent: "" };
  const card = { querySelector: () => msgEl };
  const ctx = {
    onb2: { idx: 0, ans: answeredDob ? { dob: "2009-01-01" } : {}, stored: {},
            cards: [{ id: "dob", key: "dob" }], hist: [], open: true },
    ONB2_COPY: { writeFail: "We could not save that. Please try again." },
    USER: { id: "00000000-0000-4000-8000-000000000001" },
    document: { querySelector: () => card, querySelectorAll: () => [] },
    onb2Write: async () => { log.writes++; return writeOk; },
    onb2Patch: () => ({ dob: "2009-01-01" }),
    onb2NextIdx: () => -1,           // force the finish path
    onb2Leap: () => { log.advanced = true; },
    onb2Transit: () => {}, onb2Present: () => { log.doneShown = true; },
    onb2Pan: () => {}, onb2Seeds: () => {}, onb2SyncBack: () => {},
    onb2SeatOrb: () => {}, onb2Close: () => {},
    setTimeout: () => {},
    sb: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      log.reads++;
      if (readThrows) throw new Error("network");
      return { data: readBack, error: readError || null };
    } }) }) }) },
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
let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log("  ok   " + name); }
                            else { fail++; console.log("  FAIL " + name); } };

// 1. write fails -> no advance, retry copy shown, no read-back attempted
{
  const r = await run({ writeOk: false, answeredDob: true });
  t("WRITEFAIL-1: does not advance when the write fails", r.advanced === false);
  t("WRITEFAIL-2: shows the retry copy",                  r.msg === FAIL);
  t("WRITEFAIL-3: does not show the done card",           r.doneShown === false);
  t("WRITEFAIL-4: does not read back after a failed write", r.reads === 0);
}
// 2. write succeeds, read-back agrees -> advances to done, no message
{
  const r = await run({ writeOk: true, answeredDob: true, readBack: { dob: "2009-01-01" } });
  t("PASS-1: advances when write and read-back both succeed", r.advanced === true);
  t("PASS-2: shows the done card",                            r.doneShown === true);
  t("PASS-3: shows no message",                               r.msg === "");
}
// 3. write "succeeds" but read-back shows dob still null -> the CHECK-refusal shape
{
  const r = await run({ writeOk: true, answeredDob: true, readBack: { dob: null } });
  t("READBACK-1: no done card when dob is still null", r.doneShown === false);
  t("READBACK-2: shows the retry copy",                r.msg === FAIL);
}
// 4. dob NOT answered this run + null dob -> must still finish (skip is legitimate)
{
  const r = await run({ writeOk: true, answeredDob: false, readBack: { dob: null } });
  t("SKIP-1: a skipped dob still finishes", r.doneShown === true);
  t("SKIP-2: no message on a skip",         r.msg === "");
}
// 5. read-back errors / throws -> no done card
{
  const a = await run({ writeOk: true, answeredDob: true, readError: { message: "x" } });
  t("READERR-1: no done card when the read-back errors", a.doneShown === false);
  const b = await run({ writeOk: true, answeredDob: true, readThrows: true });
  t("READERR-2: no done card when the read-back throws", b.doneShown === false);
  // ISOLATES the error branch. With dob NOT answered, the dob assertion cannot
  // fire, so only the `if(error)` guard can stop the done card. Without this the
  // suite passes even when that guard is deleted.
  const c = await run({ writeOk: true, answeredDob: false, readError: { message: "x" } });
  t("READERR-3: error alone blocks done, with no dob answered", c.doneShown === false);
  const d = await run({ writeOk: true, answeredDob: false, readThrows: true });
  t("READERR-4: throw alone blocks done, with no dob answered", d.doneShown === false);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
