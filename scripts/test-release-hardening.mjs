#!/usr/bin/env node
// RELEASE_HARDENING_V1 -- the dashboard never names a column supa migration 0062 withholds.
//
// 0062 turns the signed-in role's SELECT on reports into a COLUMN grant that omits
// transcription_json and clarify_prompts. Postgres does not return null for an ungranted column:
// it fails the WHOLE statement with 42501. So one stray `clarify_prompts` in a select, or a filter
// on `transcription_json`, takes down the call it sits in, and every caller here swallows errors,
// so it fails silently. buildPicker was exactly that call before this change.
//
// What is pinned:
//   RH-1  no reports query in the file names a withheld column, in a select or in a filter
//   RH-2  pollTick no longer renders the interim transcription view
//   RH-3  the clarify chip is sourced from my_released_clarify_prompts()
//   RH-4  the retry logic reads `transcribed`, in both places it decides FAIL-6
// Every check runs against LOCATED, non-empty source and has a mutant that must fail it.
//
//   node scripts/test-release-hardening.mjs
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };

const WITHHELD = ["transcription_json", "clarify_prompts"];

// Every chain that starts at from("reports") / from('reports'), up to the end of its statement.
function reportsQueries(src) {
  const out = [];
  const re = /\bsb\.from\((["'])reports\1\)/g;
  let m;
  while ((m = re.exec(src))) {
    const end = src.indexOf(";", m.index);
    out.push(src.slice(m.index, end < 0 ? m.index + 400 : end));
  }
  return out;
}
const namesWithheld = (q) => WITHHELD.some((c) => new RegExp("[\"'`][^\"'`]*\\b" + c + "\\b").test(q));

function fnBody(src, name) {
  const at = src.indexOf("async function " + name + "(");
  if (at < 0) return "";
  const next = src.indexOf("\nasync function ", at + 10);
  const next2 = src.indexOf("\nfunction ", at + 10);
  const end = Math.min(...[next, next2].filter((x) => x > 0));
  return src.slice(at, Number.isFinite(end) ? end : at + 20000);
}

console.log("RH-1  no reports query names a withheld column");
const qs = reportsQueries(HTML);
ok(qs.length >= 8, "RH-1-CONTROL: located " + qs.length + " reports queries (the file has at least 8)");
const bad = qs.filter(namesWithheld);
ok(bad.length === 0, "RH-1: none names transcription_json or clarify_prompts (" + bad.length + " do)");
{
  const mut = HTML.replace('.select("id, collected_on, created_at, lab_name, reveal_seen_at, file_path, status")',
                           '.select("id, collected_on, created_at, lab_name, reveal_seen_at, clarify_prompts, file_path, status")');
  ok(mut !== HTML && reportsQueries(mut).filter(namesWithheld).length === 1,
     "RH-1-MUTANT: putting clarify_prompts back in buildPicker's select is caught");
  const mut2 = HTML.replace('.eq("transcribed", true)', '.not("transcription_json", "is", null)');
  ok(mut2 !== HTML && reportsQueries(mut2).filter(namesWithheld).length === 1,
     "RH-1-MUTANT: a filter on transcription_json is caught, not only a select");
}

console.log("RH-2  pollTick renders no interim transcription view");
const POLL = fnBody(HTML, "pollTick");
ok(POLL.length > 1000 && POLL.includes('from("results")'), "RH-2-CONTROL: pollTick located (" + POLL.length + " chars)");
ok(!/renderInterim\(/.test(POLL) && !/showView\(["']interim["']\)/.test(POLL), "RH-2: no renderInterim call and no interim view in pollTick");
ok(/\.select\("status, transcribed, created_at"\)/.test(POLL), "RH-2: pollTick selects status, transcribed, created_at");
{
  // PENDING_FROM_UPLOAD_V1 restructured the in-flight fallback into a block; the mutant targets its processing arm.
  const mut = POLL.replace('else showView("processing");', 'else { renderInterim(x, 0); showView("interim"); }');
  ok(mut !== POLL && /renderInterim\(/.test(mut), "RH-2-MUTANT: re-adding the interim render is caught");
}

console.log("RH-3  the clarify chip comes from my_released_clarify_prompts()");
const PICK = fnBody(HTML, "buildPicker");
ok(PICK.length > 500, "RH-3-CONTROL: buildPicker located (" + PICK.length + " chars)");
ok(/sb\.rpc\("my_released_clarify_prompts"\)/.test(PICK), "RH-3: buildPicker calls my_released_clarify_prompts");
ok(/window\.__clarifyByReport\s*=/.test(PICK), "RH-3: and still publishes window.__clarifyByReport");
ok(/new Map\(reports\.map\(r=>\[r\.id, null\]\)\)/.test(PICK), "RH-3: every report maps (to null) before the call, so a failed call empties the chip, not the picker");

console.log("RH-4  the retry logic reads transcribed");
const UNRET = fnBody(HTML, "pcUnretryableIds");
ok(UNRET.length > 100, "RH-4-CONTROL: pcUnretryableIds located");
ok(/\.eq\("transcribed", true\)/.test(UNRET), "RH-4: pcUnretryableIds filters on transcribed");
ok(/!rep\.transcribed \? "unretryable"/.test(POLL), "RH-4: pollTick's error branch decides FAIL-6 from rep.transcribed");
{
  const mut = POLL.replace('!rep.transcribed ? "unretryable"', '!rep.transcription_json ? "unretryable"');
  ok(mut !== POLL && !/!rep\.transcribed \? "unretryable"/.test(mut), "RH-4-MUTANT: reverting the error branch is caught");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
