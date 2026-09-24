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
// CONSENT_V2_V4_DARK, amended 2026-09-24. The version is no longer a literal in the call: it is
// CORE_CONSENT_VERSION, which is "v1" while CORE_CONSENT_V2_ENABLED is false. So the property
// "the core call sends consent_type core and v1" is asserted in two halves: the call's shape, and
// the flag-off VALUE of the constant, evaluated from the shipped source rather than read by eye.
const CORE_CALL = 'sb.functions.invoke("consent-accept", { body:{ consent_type: "core", consent_version: CORE_CONSENT_VERSION } })';
ok(SRC.includes(CORE_CALL), "the core call sends consent_type 'core' and consent_version CORE_CONSENT_VERSION");
const constSrc = (name) => { const m = new RegExp("^const " + name + " = [^\\n]*;$", "m").exec(SRC); return m ? m[0] : null; };
const fnSrc = (name) => {
  const at = SRC.indexOf("function " + name + "(");
  if (at < 0) return null;
  let d = 0, j = SRC.indexOf("{", at);
  for (; j < SRC.length; j++) { if (SRC[j] === "{") d++; else if (SRC[j] === "}" && --d === 0) break; }
  return SRC.slice(at, j + 1);
};
const FLAGS_SRC = ["CORE_CONSENT_V2_ENABLED", "CORE_CONSENT_VERSION", "SANA_CONSENT_VERSION", "SANA_CONSENT_V4_ENABLED"]
  .map(constSrc);
ok(FLAGS_SRC.every(Boolean), "REACHABILITY: the four consent version constants were located");
const flagOff = new Function(FLAGS_SRC.join("\n") + "\n" + fnSrc("consentVersionFor") +
  "\nreturn { v2: CORE_CONSENT_V2_ENABLED, v4: SANA_CONSENT_V4_ENABLED, core: CORE_CONSENT_VERSION, " +
  "forCore: consentVersionFor('core'), forSana: consentVersionFor('sana') };")();
eq(JSON.stringify([flagOff.v2, flagOff.v4]), "[false,false]", "both new consent flags are false in the committed file");
eq(flagOff.core, "v1", "with the flags off the core call sends v1");
eq((SRC.match(/invoke\("consent-accept"/g) || []).length, 1,
   "there is exactly ONE sb.functions.invoke of consent-accept");
// the legacy body shape must be gone, or the call silently takes the legacy path
eq((SRC.match(/body:\{ consent_version: "v1" \}/g) || []).length, 0,
   "the legacy body shape (no consent_type) appears nowhere");
// CONTROL: the matcher can fire -- the same search against the shape that IS present
// CONSENT_V2_V4_DARK, amended 2026-09-24: the shape now names CORE_CONSENT_VERSION, whose flag-off
// value is asserted "v1" above.
eq((SRC.match(/body:\{ consent_type: "core", consent_version: CORE_CONSENT_VERSION \}/g) || []).length, 1,
   "CONTROL: the same matcher finds the new shape, so its zero above is a real zero");

// the version must stay v1: v3 core is NOT approved and the server refuses it with 409
ok(!/consent_type: "core", consent_version: "v3"/.test(SRC),
   "the core call does NOT send v3, which is unapproved and would 409");

// ── 2. the Sana call is unchanged ────────────────────────────────────────────
// Sana posts with fetch(), not functions.invoke, and names its own version constant.
// CONSENT_V2_V4_DARK, amended 2026-09-24. consentPost used to send SANA_CONSENT_VERSION for EVERY
// type, which broke the Account panel's core withdrawal. It now sends the version its caller
// chose with consentVersionFor(type). The property kept: with the flags off, Sana sends v3.1.
ok(SRC.includes("consent_type: type, consent_version: version"),
   "consentPost sends the version its caller chose");
eq((SRC.match(/consentPost\((?:[^()]|\([^()]*\))*\)/g) || []).filter((c) => !c.startsWith("consentPost(type, action, version")).sort().join(" | "),
   ["consentPost(\"sana\", action, consentVersionFor(\"sana\"))", "consentPost(type, \"withdrawn\", consentVersionFor(type))"].sort().join(" | "),
   "every consentPost caller passes consentVersionFor for its own type");
eq(flagOff.forSana, "v3.1", "with the flags off the Sana call sends v3.1");
eq(flagOff.forCore, "v1", "with the flags off a core withdrawal sends v1, not the Sana version");
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
// CONSENT_V2_V4_DARK, amended 2026-09-24. The file now also carries CORE_CONSENT_V2_TEXT, whose
// opening words are the same, in the SCRIPT. What she sees with the flag off is the markup, so the
// once-only property is asserted on the markup with every <script> block removed. The v2 string's
// own once-only and hash checks live in test-consent-v2-v4.mjs.
const MARKUP = HTML.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
ok(MARKUP.length > 10000 && MARKUP.includes('id="consent-row"'),
   "REACHABILITY: the flag-off markup was located and holds the consent row");
eq((MARKUP.match(/I agree to BioWellth reading my report/g) || []).length, 1,
   "it appears exactly once in the flag-off markup");
ok(MARKUP.includes("I agree to BioWellth reading my report to prepare my wellness interpretation. I have read the "),
   "and that one occurrence is the v1 text");

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
