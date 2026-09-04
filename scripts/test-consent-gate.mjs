#!/usr/bin/env node
// SANA_CONSENT_GATE_V1 — the two-layer approval gate, tested against shipped source.
//
// THE LOAD-BEARING PROPERTY: with SANA_CONSENT_TEXT_APPROVED false, no code path can
// create a consent record. Extracts the real functions from dashboard.html, the same
// technique as scripts/test-sse-parser.mjs, so it tests what ships.
import { readFileSync } from "node:fs";
const FILE = process.env.DASH || "dashboard.html";
const src = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`); }
};

// ── extract the stamp function and run it with a fetch spy ──────────────────
function extract(name) {
  const at = src.indexOf(`async function ${name}(`);
  if (at < 0) throw new Error(`${name} not found in ${FILE}`);
  // brace-match to the end of the function
  let i = src.indexOf("{", at), depth = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(at, j + 1);
}

const APPROVED = /const SANA_CONSENT_TEXT_APPROVED = (\w+);/.exec(src)?.[1];
const CHAT = /const SANA_CHAT_ENABLED = (\w+);/.exec(src)?.[1];

check("SANA_CONSENT_TEXT_APPROVED is false in the committed file", APPROVED, "false");
check("SANA_CHAT_ENABLED is false in the committed file", CHAT, "false");
check("exactly one assignment of each flag",
  [ (src.match(/SANA_CONSENT_TEXT_APPROVED\s*=/g) || []).length,
    (src.match(/SANA_CHAT_ENABLED\s*=/g) || []).length ], [1, 1]);

// STAMP-1, the load-bearing one. Run the real sanaStampConsent with the committed
// flag value and a fetch that records any call. A grant must not reach the network.
{
  const body = extract("consentPost");
  let fetched = 0;
  const sandbox = {
    SANA_CONSENT_TEXT_APPROVED: APPROVED === "true", SANA_CONSENT_VERSION: "v3",
    SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "k",
    sb: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
    fetch: async () => { fetched++; return { ok: true }; },
  };
  const fn = new Function(...Object.keys(sandbox), body + "; return consentPost;")(...Object.values(sandbox));
  const granted = await fn("sana", "granted");
  check("STAMP-1: a GRANT does not fire while the notice is unapproved", { granted, fetched }, { granted: false, fetched: 0 });

  // A withdrawal is deliberately NOT gated, so a user is never trapped in a consent.
  const withdrawn = await fn("sana", "withdrawn");
  check("STAMP-2: a WITHDRAWAL is not blocked by the approval gate", { withdrawn, fetched }, { withdrawn: true, fetched: 1 });
}

// REPOINTED 2026-09-04. This asserted `consentBody` still began "PENDING COUNSEL".
// That was a proxy for "not yet approved", and it went red when counsel's real
// data-flow language was pasted in (daa35cb) with BOTH gates deliberately left
// false, so that the switch-on review reads the real notice instead of a stub.
//
// The proxy is obsolete; the property it stood for is not, and it is already
// asserted twice above and independently -- SANA_CONSENT_TEXT_APPROVED is false
// (line 33) and STAMP-1 proves a grant cannot fire while it is (line 52). Those
// are the load-bearing checks and neither was touched.
//
// What replaces it is a POSITIVE assertion on required content, so the notice
// cannot silently regress to a placeholder, be emptied, or lose the disclosure
// that is the whole point of it.
check("the notice carries counsel's data-flow disclosure",
      /consentBody:\s*"[^"]*Azure AI Foundry[^"]*"/.test(src), true);
check("the notice carries the retention sentence",
      /consentBody:\s*"[^"]*stored by Microsoft[^"]*"/.test(src), true);
check("the withdrawal control is dark-guarded", /async function renderConsentControls\(\)[\s\S]{0,200}if\(!SANA_CHAT_ENABLED\) return;/.test(src), true);
check("consent is checked BEFORE sanaEnsureLinked in sanaSend", (() => {
  const send = src.slice(src.indexOf("async function sanaSend(){"));
  return send.indexOf("sanaConsentGranted()") < send.indexOf("sanaEnsureLinked(");
})(), true);
check("there is exactly ONE poster to consent-accept", (src.match(/functions\/v1\/consent-accept/g) || []).length, 1);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
