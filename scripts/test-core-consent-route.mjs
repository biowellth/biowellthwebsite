#!/usr/bin/env node
// CORE_CONSENT_V3_ROUTE -- the upload consent call must select consent-accept's append-only path.
//
// consent-accept dispatches on the PRESENCE of consent_type: absent, it takes the legacy path,
// which only UPDATEs the mutable profiles.consent_accepted_at column; present, it takes handleV3,
// which inserts an append-only consent_events row carrying notice_sha256 of the exact notice text
// and THEN mirrors profiles for core. The version stays v1, the one core notice counsel has
// approved, whose text is byte-identical to the checkbox the user ticks (sha256
// a529f321cd043c3ea66f8a7679abc12c7c447a586cf4ad307b980410313043b0).
//
// THE APP BLOCK IS THE LAST BARE <script>, NOT THE FIRST.
//
//   node scripts/test-core-consent-route.mjs
import { readFileSync } from "node:fs";

const HTML = readFileSync(process.env.DASH || "dashboard.html", "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(a === b, `${m}  (got ${JSON.stringify(a)})`);

console.log("CORE_CONSENT_V3_ROUTE");

// ── the app block, located the way the other scripts locate it ───────────────
const lines = HTML.split("\n");
const opens = lines.map((l, i) => (l.trim() === "<script>" ? i : -1)).filter((i) => i >= 0);
const closes = lines.map((l, i) => (l.trim() === "</script>" ? i : -1)).filter((i) => i >= 0);
const s = opens[opens.length - 1];
const e = closes.filter((c) => c > s)[0];
ok(s != null && e != null, "REACHABILITY: the app script block was located");
const SRC = lines.slice(s + 1, e).join("\n");

// ── 1. the CORE call carries consent_type "core" ─────────────────────────────
const CORE_CALL = 'sb.functions.invoke("consent-accept", { body:{ consent_type: "core", consent_version: "v1" } })';
ok(SRC.includes(CORE_CALL), "the core call sends consent_type 'core' and consent_version 'v1'");
eq((SRC.match(/invoke\("consent-accept"/g) || []).length, 1,
   "there is exactly ONE sb.functions.invoke of consent-accept");
// the legacy body shape must be gone, or the call silently takes the legacy path
eq((SRC.match(/body:\{ consent_version: "v1" \}/g) || []).length, 0,
   "the legacy body shape (no consent_type) appears nowhere");
// CONTROL: the matcher can fire -- the same search against the shape that IS present
eq((SRC.match(/body:\{ consent_type: "core", consent_version: "v1" \}/g) || []).length, 1,
   "CONTROL: the same matcher finds the new shape, so its zero above is a real zero");

// the version must stay v1: v3 core is NOT approved and the server refuses it with 409
ok(!/consent_type: "core", consent_version: "v3"/.test(SRC),
   "the core call does NOT send v3, which is unapproved and would 409");

// ── 2. the Sana call is unchanged ────────────────────────────────────────────
// Sana posts with fetch(), not functions.invoke, and names its own version constant.
ok(SRC.includes('consent_type: type, consent_version: SANA_CONSENT_VERSION'),
   "the Sana call still sends its own consent_type and SANA_CONSENT_VERSION");
ok(/const SANA_CONSENT_VERSION\s*=/.test(SRC), "SANA_CONSENT_VERSION is still defined");
eq((SRC.match(/functions\/v1\/consent-accept/g) || []).length, 1,
   "the Sana fetch to consent-accept is still present, exactly once");
ok(SRC.includes("SANA_CONSENT_TEXT_APPROVED"),
   "the Sana client-side approval gate is untouched");

// ── 3. a refused consent blocks progress ─────────────────────────────────────
// The upload flow must not reach storage when consent-accept errors. Asserted on the
// source order: the throw sits between the invoke and the storage upload, inside a try
// whose catch returns.
const iInvoke = SRC.indexOf(CORE_CALL);
const iThrow = SRC.indexOf("if(consentRes.error) throw consentRes.error;", iInvoke);
const iCatch = SRC.indexOf("uploadRowFail(CONSENT_FALLBACK_COPY); return;", iInvoke);
const iUpload = SRC.indexOf('sb.storage.from("reports").upload(', iInvoke);
ok(iThrow > iInvoke, "the error check follows the invoke");
ok(iCatch > iThrow, "the catch that aborts follows the error check");
ok(iUpload > iCatch, "the storage upload comes AFTER the abort path, so a refusal cannot reach it");
ok(SRC.includes("CONSENTED = true;"),
   "CONSENTED is set only on the success path");
const between = SRC.slice(iInvoke, iUpload);
// ANCHORED TO LINE START, so a COMMENTED-OUT guard does not satisfy this. A bare
// includes() of the statement text passes while the line reads "// if(...) throw ...",
// which is exactly how a swallowed refusal would ship.
const GUARD_LIVE = /^[ \t]*if\(consentRes\.error\) throw consentRes\.error;/m;
ok(GUARD_LIVE.test(between),
   "the error guard is LIVE between the invoke and the upload, not commented out");
ok(!/^[ \t]*\/\/[ \t]*if\(consentRes\.error\)/m.test(SRC),
   "the error guard is not commented out anywhere");
// CONTROL: the same anchored matcher must FAIL on a commented copy, so it can fire.
ok(!GUARD_LIVE.test("    // if(consentRes.error) throw consentRes.error;"),
   "CONTROL: the anchored matcher rejects a commented-out guard");
ok(GUARD_LIVE.test("    if(consentRes.error) throw consentRes.error;"),
   "CONTROL: the anchored matcher accepts a live guard");
eq((between.match(/catch\(_\)\{[\s\S]*?uploadRowFail\(CONSENT_FALLBACK_COPY\); return;/g) || []).length, 1,
   "the catch aborts with a return rather than falling through");

// ── 4. the shown notice text is unchanged ────────────────────────────────────
// If this line ever drifts from consent-versions.ts the stored sha stops describing what
// she read. Pinned verbatim.
ok(HTML.includes("I agree to BioWellth reading my report to prepare my wellness interpretation. I have read the "),
   "the consent checkbox text is unchanged");
eq((HTML.match(/I agree to BioWellth reading my report/g) || []).length, 1,
   "it appears exactly once");

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
