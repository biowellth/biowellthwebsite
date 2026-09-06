#!/usr/bin/env node
// SANA_CONSENT_GATE_V1 — the two-layer approval gate, tested against shipped source.
//
// THE LOAD-BEARING PROPERTY: with SANA_CONSENT_TEXT_APPROVED false, no code path can
// create a consent record. Extracts the real functions from dashboard.html, the same
// technique as scripts/test-sse-parser.mjs, so it tests what ships.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

// SWITCHED ON 2026-09-05, Phase 3, under counsel's Launch Privacy & Data Protection
// Determination. These assertions are INVERTED from their original form, which held the
// flags dark. They are kept as equality checks rather than deleted: the file is still the
// tripwire, it now guards the opposite edge. A silent revert to false would mean the
// consent card stopped rendering while the policy still promises it.
check("SANA_CONSENT_TEXT_APPROVED is true in the committed file", APPROVED, "true");
check("SANA_CHAT_ENABLED is true in the committed file", CHAT, "true");
check("exactly one assignment of each flag",
  [ (src.match(/SANA_CONSENT_TEXT_APPROVED\s*=/g) || []).length,
    (src.match(/SANA_CHAT_ENABLED\s*=/g) || []).length ], [1, 1]);

// STAMP-1, the load-bearing one. It used to read the flag out of the file, which meant
// that on the day the flag flipped, the test measuring "a grant cannot fire while
// unapproved" silently started measuring the opposite and went red. The property did not
// change; the way it was sourced was wrong. The flag is now FORCED in the sandbox, so the
// refusal path stays tested forever, including after switch-on.
const mkPost = (approved) => {
  const body = extract("consentPost");
  const box = {
    SANA_CONSENT_TEXT_APPROVED: approved, SANA_CONSENT_VERSION: "v3.1",
    SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "k",
    sb: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
    fetch: async () => { box.n++; return { ok: true }; },
    n: 0,
  };
  return { fn: new Function(...Object.keys(box), body + "; return consentPost;")(...Object.values(box)), box };
};

{
  // UNAPPROVED arm: the permanent guard. A grant must never reach the network.
  const { fn, box } = mkPost(false);
  const granted = await fn("sana", "granted");
  check("STAMP-1: a GRANT does not fire while the notice is unapproved", { granted, fetched: box.n }, { granted: false, fetched: 0 });

  // A withdrawal is deliberately NOT gated, so a user is never trapped in a consent.
  const withdrawn = await fn("sana", "withdrawn");
  check("STAMP-2: a WITHDRAWAL is not blocked by the approval gate", { withdrawn, fetched: box.n }, { withdrawn: true, fetched: 1 });
}

{
  // APPROVED arm, added 2026-09-05. Without it the suite proves only that consent can be
  // REFUSED, and a card that silently stopped stamping would read as green.
  const { fn, box } = mkPost(true);
  const granted = await fn("sana", "granted");
  check("STAMP-3: with the notice approved, a GRANT does reach the network", { granted, fetched: box.n }, { granted: true, fetched: 1 });
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
// REPOINTED 2026-09-05, and the reason matters. The pre-v3.1 card said Sana conversations
// are "stored by Microsoft until you delete them". Counsel's approved v3.1 notice does NOT
// carry that phrasing -- the retention detail moved to the Privacy Policy section 3, and the
// consent line covers deletion as "Deleting your Sana history removes it". Asserting the old
// words would now fail against the approved text, so this asserts the approved text's own
// two required disclosures instead.
check("the notice carries the deletion sentence",
      /consentBody:\s*"[^"]*Deleting your Sana history removes it[^"]*"/.test(src), true);
// THE MEMORY DISCLOSURE. The card shipped before today never mentioned the memory profile at
// all, while the Privacy Policy and Determination section 3 both describe it. That gap is the
// reason this check exists; it is the sentence a user most needs to have read.
check("the notice discloses the memory profile",
      /consentBody:\s*"[^"]*keeps a short AI-generated profile[^"]*"/.test(src), true);
check("the withdrawal control is dark-guarded", /async function renderConsentControls\(\)[\s\S]{0,200}if\(!SANA_CHAT_ENABLED\) return;/.test(src), true);
check("consent is checked BEFORE sanaEnsureLinked in sanaSend", (() => {
  const send = src.slice(src.indexOf("async function sanaSend(){"));
  return send.indexOf("sanaConsentGranted()") < send.indexOf("sanaEnsureLinked(");
})(), true);
check("there is exactly ONE poster to consent-accept", (src.match(/functions\/v1\/consent-accept/g) || []).length, 1);

// ── NOTICE-1 ────────────────────────────────────────────────────────────────────
// THE CARD MUST SHOW THE TEXT THE SERVER HASHES.
//
// consent-accept derives notice_sha256 from ITS OWN copy of the v3.1 notice in
// supabase/functions/process-report-worker/consent-versions.ts. It never accepts a hash
// from the client, which is what makes the record trustworthy -- and also what makes a
// drift here invisible: the stamp would succeed and certify wording the user never read.
//
// Found live on 2026-09-05. The shipped card was 253 chars of different text that never
// mentioned the memory profile, while the approved notice is 311 chars and does. Flipping
// the flags without this check would have recorded consent against unseen words, which is
// the exact defect consent-versions.ts was written to prevent.
//
// The digest is embedded rather than read across repos so this suite has no dependency
// outside its own tree. It is recorded in the approving commit (supa ee2dfe8).
{
  const V31_SHA = "9a01eab1091ff0b1add8c5b625f1a73d3d9dfe81b60358bfa9e7c1f0376aec0d";
  const m = /consentBody:\s*"((?:[^"\\]|\\.)*)"/.exec(src);
  check("NOTICE-1a: the consent card body is present", !!m, true);
  const card = m ? JSON.parse('"' + m[1] + '"') : "";
  const sha = createHash("sha256").update(card, "utf8").digest("hex");
  check("NOTICE-1b: rendered card text hashes to the counsel-approved v3.1 notice", sha, V31_SHA);
  check("NOTICE-1c: and is the expected length", card.length, 311);

  // Known-positive control. Without it a broken extractor hashing "" would look like a pass
  // only if "" happened to match, and a silently-empty card would be indistinguishable.
  const mutated = createHash("sha256").update(card + " ", "utf8").digest("hex");
  check("NOTICE-1d: one extra space changes the digest (the check can fail)", mutated !== V31_SHA, true);

  // The stamped version and the hashed notice are one artifact. Asserting only the hash
  // would pass while the client sent a version the server refuses.
  const VER = /const SANA_CONSENT_VERSION = "([^"]+)";/.exec(src)?.[1];
  check("NOTICE-1e: the version sent is the version whose text was hashed", VER, "v3.1");

  // The accept control must be an affirmative act, not a dismissal.
  const AGREE = /consentAgree:\s*"([^"]*)"/.exec(src)?.[1];
  check("NOTICE-1f: the accept button is an affirmative verb", AGREE, "I agree");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

