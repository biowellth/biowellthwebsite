#!/usr/bin/env node
// PAYLOAD_FIELD_LEDGER_V1 — the guard that catches the NEXT invisible field.
//
// Six fields were found written by supa and read by nothing: narrative_headline.confounder_note
// (rendered this evening, after months invisible), narrative_headline.verdict,
// retest_recommendation, the confounder_summary block, patterns_deferred and active_confounders.
// Nothing caught any of them. A field can be added to Call B's schema, generated on every report,
// stored, and never rendered, and no test anywhere notices.
//
// This renders nothing and fixes none of the six. It declares them, and it fails on the seventh.
//
//   node scripts/test-payload-field-ledger.mjs     (or SUPA_INDEX=path/to/index.ts)
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DASH = process.env.DASH || join(HERE, "..", "dashboard.html");
const SNAPSHOT = join(HERE, "payload-fields.snapshot.json");
const SUPA_INDEX = process.env.SUPA_INDEX ||
  "/Users/aditipillai/Desktop/biowellth-backend-supa/supabase/functions/process-report-worker/index.ts";

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label + (detail ? "\n         " + detail : "")); }
};
const eq = (label, got, want) => ok(label + "  (" + JSON.stringify(got) + ")", got === want,
  got === want ? "" : "got " + JSON.stringify(got) + " want " + JSON.stringify(want));

console.log("payload field ledger");

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE FIELD LIST, DERIVED — never typed.
//
// SOURCE: the Call B OUTPUT SCHEMA block inside INTERPRETATION_PROMPT in supa's index.ts, UNION
// the explicit keys assembled beside `...resB` where the stored payload is built. Both are needed
// and neither alone is faithful:
//   - the schema alone misses vitality, engine_input_snapshot, longitudinal, coverage_gap,
//     marker_counts, warnings and the version stamps, which the worker adds after Call B returns;
//   - the assembly alone misses everything inside `...resB`, which is the whole narrative payload.
// A STORED PAYLOAD would miss any optional field absent from that report, and the UNION ACROSS
// STORED PAYLOADS would miss a field that has been added to the schema but has not yet appeared on
// a report — which is exactly the case this guard exists to catch. So the schema is the only source
// that can see the seventh field on the day it is written.
//
// TWO SCHEMAS CARRY THE SAME HEADER. TRANSCRIPTION_PROMPT has its own "# OUTPUT SCHEMA", and it
// describes Call A's INPUT to interpretation, not the payload. Anchoring on the first match yields
// 21 fields instead of 86. The anchor below is the interpretation prompt's full header line.
function deriveFromSupa(path) {
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  const hdr = lines.findIndex((l) => l.startsWith("# OUTPUT SCHEMA — return ONE JSON object"));
  if (hdr < 0) return { error: "Call B OUTPUT SCHEMA header not found" };
  let open = -1;
  for (let i = hdr; i < lines.length; i++) if (lines[i] === "{") { open = i; break; }
  let close = -1;
  for (let i = open + 1; i < lines.length; i++) if (lines[i] === "}") { close = i; break; }
  if (open < 0 || close < 0) return { error: "schema block braces not found" };

  const fields = new Set();
  const stack = [];
  for (let i = open + 1; i < close; i++) {
    const rawLine = lines[i], t = rawLine.trim();
    if (!t || t.startsWith("//")) continue;
    const ind = rawLine.length - rawLine.trimStart().length;
    while (stack.length && stack[stack.length - 1].ind >= ind) stack.pop();
    const m = t.match(/^"([A-Za-z0-9_]+)"\s*:/);
    if (!m) continue;
    fields.add([...stack.map((s) => s.name), m[1]].join("."));
    if (t.endsWith("{") || t.endsWith("[") || t.endsWith("[{")) {
      stack.push({ name: m[1] + (t.endsWith("{") ? "" : "[]"), ind });
    }
  }
  const pa = src.indexOf("const payload: any = {");
  const paEnd = src.indexOf("\n  };", pa);
  const engineKeys = pa < 0 ? [] : [...src.slice(pa, paEnd).matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1]);
  engineKeys.forEach((k) => fields.add(k));
  return {
    fields: [...fields].sort(), schemaLine: open + 1, closeLine: close + 1,
    // CHARS, not bytes: the file carries multi-byte em dashes, so String.length is smaller than
    // the byte count. Printing it as "bytes" would put a wrong number beside a real one.
    engineKeys: engineKeys.length, chars: src.length,
  };
}

const live = existsSync(SUPA_INDEX) ? deriveFromSupa(SUPA_INDEX) : { error: "supa index.ts not present" };
const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const SOURCE_MODE = live.error ? "snapshot" : "live";
const FIELDS = live.error ? snapshot.fields : live.fields;

console.log("  source: " + SOURCE_MODE +
  (live.error ? "  (" + live.error + ")"
              : "  supa index.ts " + live.chars + " chars, schema block lines " +
                live.schemaLine + ".." + live.closeLine + ", +" + live.engineKeys + " assembly keys"));

// The derivation must have actually run against the source, not returned a literal. If a future
// edit replaces it with a hardcoded array these bounds go missing and this goes red.
if (SOURCE_MODE === "live") {
  ok("SRC-1: the schema block was LOCATED in the live source, not assumed",
    Number.isInteger(live.schemaLine) && Number.isInteger(live.closeLine) &&
    live.closeLine > live.schemaLine + 50);
  ok("SRC-2: the assembly keys were parsed too", live.engineKeys >= 5);
  // THE SNAPSHOT IS A FALLBACK, NOT THE SOURCE. When supa is reachable the two must agree, so a
  // field added there goes red here on the next run rather than waiting for someone to notice.
  const a = JSON.stringify(live.fields), b = JSON.stringify(snapshot.fields);
  ok("SRC-3: the committed snapshot still matches the live schema", a === b,
    a === b ? "" : "snapshot is stale — regenerate it in the same commit as the supa change");
} else {
  console.log("  NOTE: supa is not on this machine, so the field list is the committed snapshot " +
    "and DRIFT CANNOT BE DETECTED on this run. The website has no CI, so the suite only ever runs " +
    "where supa is present; this branch exists so the guard degrades loudly rather than silently.");
}
ok("SRC-4: the field list is non-trivial", FIELDS.length > 50, "got " + FIELDS.length);

// ─────────────────────────────────────────────────────────────────────────────────────────────
// READS, WITH COMMENTS STRIPPED. A raw grep is worse than nothing here: provider_discussion_points
// [].point has 217 raw hits and zero real readers, and narrative_headline.verdict has 42 raw hits
// across two comments that say it is NOT read any more.
const DASH_SRC = readFileSync(DASH, "utf8");
function stripComments(s) {
  const noBlock = s.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.split("\n").map((l) => l.replace(/(^|[^:"'\\])\/\/.*$/, "$1")).join("\n");
}
const CODE = stripComments(DASH_SRC);
const leafOf = (f) => f.split(".").pop().replace(/\[\]$/, "");
function readsIn(hay, key) {
  const e = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (hay.match(new RegExp("(\\." + e + "\\b|\\[\"" + e + "\"\\]|\\['" + e + "'\\])", "g")) || []).length;
}
const reads = (field) => readsIn(CODE, leafOf(field));

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE LEDGER. Membership is established by MEASUREMENT: anything with a real code read is RENDERED
// and is not listed. Everything else must appear below with a reason, or the guard fails.
//
// THE LEDGER. Membership starts from MEASUREMENT: anything with a real code read is RENDERED and
// is not listed. Everything else must appear below, and every entry carries a `note` saying why in
// one line plus a `basis` saying what kind of claim that note is:
//
//   measured-in-repo  the note is re-derived by an assertion below, from a file this guard reads
//   measured-offline  it was measured against stored payloads on a stated date; this guard has no
//                     payload or database access, so it CANNOT re-derive it and pins nothing
//   judged            a reading of the copy, not a measurement; no assertion pretends otherwise
//
// The three are kept apart on purpose. A judgement dressed as an assertion is the failure this
// whole guard exists to prevent, one level up.

// INTERNAL — diagnostics, plumbing, and fields ruled never-to-render. These must not reach her screen.
const INTERNAL = {
  "user_id":                      { note: "identity, joined on; never displayed", basis: "judged" },
  "generated_at":                 { note: "diagnostic timestamp for the interpretation run", basis: "judged" },
  "model_used":                   { note: "diagnostic - which model produced this payload", basis: "judged" },
  "prompt_version":               { note: "diagnostic - which prompt pair produced this payload", basis: "judged" },
  "engine_input_snapshot":        { note: "audit record so a rescore can be paired with its inputs", basis: "judged" },
  // MOVED OUT 2026-09-22, both of them, because the DOCTOR SUMMARY reads them. internal_metadata
  // was "named internal; the whole block is an audit trail" and cycle_day_at_interpretation was
  // "audit trail". The block is still an audit trail; one leaf of it stopped being only that the
  // moment a document printed the cycle day beside the draw date. The entries are deleted rather
  // than re-noted because a field with reads is RENDERED by measurement, and LEDGER-6 is what
  // forced this edit rather than letting the stale note stand.
  "internal_metadata.compression_ratio":            { note: "audit trail", basis: "judged" },
  "internal_metadata.confounders_active":           { note: "audit trail; the user-facing version is the confounder note", basis: "judged" },
  "internal_metadata.missing_data_notes":           { note: "audit trail", basis: "judged" },
  "internal_metadata.priorities_generated":         { note: "audit trail", basis: "judged" },
  "internal_metadata.total_markers_analysed":       { note: "audit trail; marker_counts is the rendered version", basis: "judged" },
  "internal_metadata.warnings_triggered":           { note: "audit trail", basis: "judged" },
  "foundations.framing_mode":     { note: "an authoring-mode switch for the model, not copy", basis: "judged" },
  "cluster_patterns[].pattern_id":  { note: "internal Doc B identifier", basis: "judged" },
  "cluster_patterns[].priority_ids":{ note: "internal linkage between a pattern and its priorities", basis: "judged" },

  // RECLASSIFIED 2026-09-20 from unrendered-known, after the copy was retrieved and read.
  "narrative_headline.verdict": {
    note: "a compression of narrative_headline.lead, which renders: same drivers in the same order, 202 chars against 700 on the report carrying both; deriveVerdict replaced it deliberately and says so",
    basis: "judged",
  },
  "systems[].display_group": {
    note: "free text the model invents per run - 50 distinct values across 22 systems, six names for the cardiovascular pill and eight for immune - so it is unusable as a key, and the dashboard already groups by vitality.pills and keys on system_id",
    basis: "measured-in-repo",
  },
  "foundations.levers[].measured_signal": {
    note: "Call B emits the key on every lever element and never populates it - JSON null on all 72 elements across 21 payloads, measured 2026-09-20 - so it is a dead field, not a rendering gap",
    basis: "measured-offline",
  },
  "priorities[].technical_layer": {
    note: "an audit trail written for an engineer or advisor, not for her",
    basis: "judged",
  },
  "priorities[].technical_layer.reasoning": {
    note: "names marker_id, USER_CONTEXT and the upstream transcription call in its own prose",
    basis: "judged",
  },
  "priorities[].technical_layer.confidence":                { note: "advisor-facing audit field", basis: "judged" },
  "priorities[].technical_layer.confounders_considered":    { note: "advisor-facing audit field", basis: "judged" },
  "priorities[].technical_layer.doc_b_patterns_active":     { note: "internal Doc B pattern ids", basis: "judged" },
  "priorities[].technical_layer.alternative_differentials": { note: "advisor-facing audit field", basis: "judged" },
};

// UNRENDERED-KNOWN — written, invisible, and ruled worth making visible. This is the backlog, in
// the repo rather than in a chat, so shipping a renderer for one is a ledger edit that reads as
// progress. Nothing here is fixed by this pass.
const UNRENDERED_KNOWN = {
  "confounder_summary": {
    note: "the parent block of three backlog fields; invisible in full",
    basis: "judged",
  },
  "confounder_summary.active_confounders": {
    note: "BLOCKED: raw enum keys such as acute_stress_within_2_weeks and not_fasting; needs mapping to prose before it could render",
    basis: "judged",
  },
  "confounder_summary.patterns_deferred": {
    note: "prose saying which systems were held back and what would let them be read; nothing on screen says this",
    basis: "judged",
  },
  "confounder_summary.retest_recommendation": {
    note: "the earliest valid retest with its rationale, shown nowhere",
    basis: "judged",
  },
  // UNBLOCKED 2026-09-22 by a READER, not by a copy change. This entry said the block was
  // "BLOCKED: written in the third person for a clinician, so it needs a Call B copy change
  // before it can render to her". That reasoning was right and its conclusion was too narrow:
  // third-person clinician copy needs a clinician READER, not a rewrite. The doctor summary is
  // addressed to one, so `point` and `urgency` render there verbatim, guarded on prevalence
  // language and on words that would tell a clinician what to order, prescribe or diagnose.
  // They are gone from this list because they are measured as read; the health report still
  // renders none of them, and for the health report the original reasoning stands.
  "provider_discussion_points[].supporting_markers": { note: "which markers back the point; the doctor summary prints the point and its urgency and does NOT print this, because a question reads as a question and loses that the moment marker ids are stapled to it", basis: "judged" },
  "cluster_patterns": {
    note: "the cross-system story; the parent of three backlog fields",
    basis: "judged",
  },
  "cluster_patterns[].pattern_name":      { note: "the human name of a cross-system pattern", basis: "judged" },
  "cluster_patterns[].explanation":       { note: "why those findings belong together; overlaps priorities[].the_connection, which renders, but spans several priorities where that one is pairwise", basis: "judged" },
  "cluster_patterns[].sequencing_advice": { note: "what order to work in, and nothing on screen tells her that", basis: "judged" },

  // NOT RULED ON. This was in the unrendered-known list before this pass and the reclassification
  // did not name it either way, so it stays where it was rather than being moved by default.
  "priorities[].provider_followup_flag": {
    note: "whether a finding warrants seeing a doctor, and it is invisible; awaiting a ruling",
    basis: "judged",
  },
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE RECLASSIFICATION, RE-DERIVED WHERE IT CAN BE.
//
// Four fields moved to INTERNAL this pass. Only ONE of the four reasons is re-derivable here, and
// the other three say so rather than pinning a claim the guard cannot check.
//
//   display_group      measurable in this repo, and asserted below
//   measured_signal    NOT measurable: the claim is that its value is JSON null on every lever
//                      element, which lives in stored payloads. This guard reads three files -
//                      supa's index.ts, the snapshot, and dashboard.html - and has no payload or
//                      database access. The measurement is dated in the note and must be re-run
//                      against the database, not here.
//   verdict            a reading of two pieces of copy side by side. A judgement.
//   technical_layer    a reading of who the prose addresses. A judgement.
//
// The two judgements deliberately carry NO assertion. An assertion over a string the author also
// wrote proves the author wrote it, and that is evidence-shaped noise.
ok("RECLASS-1: display_group is not read, and the dashboard groups by the engine's pills instead",
  readsIn(CODE, "display_group") === 0 && readsIn(CODE, "pills") > 0 && readsIn(CODE, "system_id") > 0,
  "display_group=" + readsIn(CODE, "display_group") + " pills=" + readsIn(CODE, "pills") +
  " system_id=" + readsIn(CODE, "system_id"));

// A note whose basis says "measured-in-repo" is a PROMISE that an assertion re-derives it. Nothing
// enforced that, so deleting the assertion left the claim standing with nothing behind it - the
// exact shape this guard exists to catch, one level up. This reads the guard's own source and
// requires an ok(...) naming each such field.
const SELF = readFileSync(fileURLToPath(import.meta.url), "utf8");
const promised = [...Object.entries(INTERNAL), ...Object.entries(UNRENDERED_KNOWN)]
  .filter(([, r]) => r.basis === "measured-in-repo").map(([f]) => f);
// The check must name the FIELD, not merely find some assertion. A first version accepted any line
// containing "RECLASS", which meant deleting the one assertion that mattered left the suite green
// - proven by deleting it and watching 23 pass. This requires the field's own leaf to appear inside
// an ok(...) that also calls readsIn, which is what re-deriving it looks like.
const okLines = SELF.split("\n").filter((l) => l.trimStart().startsWith("ok(") || l.includes("readsIn(CODE"));
const unbacked = promised.filter((f) => {
  const leaf = leafOf(f);
  return !okLines.some((l) => l.includes(leaf) && l.includes("readsIn"));
});
ok("RECLASS-0: every measured-in-repo claim has an assertion behind it", unbacked.length === 0,
  unbacked.join(", "));
ok("RECLASS-0b: and there is at least one such claim, so the check above is not vacuous",
  promised.length > 0, "promised: " + promised.length);

ok("RECLASS-2: the four reclassified fields are all INTERNAL now, none left in the backlog",
  ["narrative_headline.verdict", "systems[].display_group", "foundations.levers[].measured_signal",
   "priorities[].technical_layer"].every((f) => f in INTERNAL && !(f in UNRENDERED_KNOWN)));

// Read through a helper rather than indexing directly. A direct INTERNAL["x"].basis THROWS when a
// field is moved out of the class, and a thrown assertion is not a failed one: the runner records
// no failure, it records one fewer test. That is the quiet direction, so these resolve to
// undefined and go red instead.
const decl = (f) => INTERNAL[f] || UNRENDERED_KNOWN[f] || {};
const declIn = (f, obj) => (obj[f] || {});

ok("RECLASS-3: the measured-offline claim is LABELLED as unverifiable here, not pinned",
  declIn("foundations.levers[].measured_signal", INTERNAL).basis === "measured-offline" &&
  String(declIn("foundations.levers[].measured_signal", INTERNAL).note || "").includes("2026-09-20"),
  "a claim this guard cannot check must carry its measurement date");

ok("RECLASS-4: neither judgement pretends to be measured",
  declIn("narrative_headline.verdict", INTERNAL).basis === "judged" &&
  declIn("priorities[].technical_layer", INTERNAL).basis === "judged",
  "verdict basis=" + decl("narrative_headline.verdict").basis +
  " technical_layer basis=" + decl("priorities[].technical_layer").basis);

// Leaf-name collisions. Reads are measured by LEAF because that is what a property access looks
// like, and `nh.lead` cannot be attributed to narrative_headline by grep without alias tracking.
// Where two fields share a leaf, one being read marks both as read, which WEAKENS the guard. The
// known set is pinned so a NEW collision goes red and gets looked at rather than inherited.
const AMBIGUOUS_LEAVES = ["closing", "display_name", "lead", "system_id"];

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE GUARD.
function violations(fieldList, internal, unrendered, code) {
  const out = [];
  for (const f of fieldList) {
    const key = leafOf(f).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const n = (code.match(new RegExp("(\\." + key + "\\b|\\[\"" + key + "\"\\]|\\['" + key + "'\\])", "g")) || []).length;
    if (n > 0) continue;
    if (Object.prototype.hasOwnProperty.call(internal, f)) continue;
    if (Object.prototype.hasOwnProperty.call(unrendered, f)) continue;
    out.push(f);
  }
  return out;
}

const RENDERED = FIELDS.filter((f) => reads(f) > 0);
const undeclared = violations(FIELDS, INTERNAL, UNRENDERED_KNOWN, CODE);

console.log("  fields " + FIELDS.length + " = rendered " + RENDERED.length +
  " + internal " + Object.keys(INTERNAL).length +
  " + unrendered-known " + Object.keys(UNRENDERED_KNOWN).length +
  " + UNDECLARED " + undeclared.length);

ok("LEDGER-1: every field supa writes is rendered, or declared with a reason",
  undeclared.length === 0, undeclared.length ? "undeclared: " + undeclared.join(", ") : "");

// KNOWN-POSITIVE for the live path. LEDGER-1 passes today because the true answer is zero, and a
// zero that is correct is indistinguishable from a check that was never wired up — a hardcoded
// empty result survives every assertion above. This runs the SAME function over the SAME field
// list with an EMPTY ledger and requires it to report every declared-invisible field, so the
// machinery is proven to compute over the real list rather than merely returning nothing.
//
// RESIDUAL, AND STATED RATHER THAN PAPERED OVER: this proves violations() works and that the
// ledger is exhaustive. It cannot prove that the `undeclared` line above is wired to it, because
// with zero real violations both a live call and a hardcoded [] give the same answer. That hole
// closes itself the first time a field is genuinely undeclared, which is one run later than ideal.
eq("LEDGER-1b: KNOWN-POSITIVE, an empty ledger reports every declared-invisible field",
  violations(FIELDS, {}, {}, CODE).length,
  Object.keys(INTERNAL).length + Object.keys(UNRENDERED_KNOWN).length);

eq("LEDGER-2: the three classes account for every field",
  RENDERED.length + Object.keys(INTERNAL).length + Object.keys(UNRENDERED_KNOWN).length,
  FIELDS.length);

// A ledger entry for a field that no longer exists is rot: it reads as a considered decision and
// covers nothing. Either the field was renamed or it was removed, and both need a human.
const stale = [...Object.keys(INTERNAL), ...Object.keys(UNRENDERED_KNOWN)].filter((f) => !FIELDS.includes(f));
ok("LEDGER-3: no ledger entry names a field that is not in the field list", stale.length === 0,
  stale.length ? "stale: " + stale.join(", ") : "");

// A field cannot be both.
const both = Object.keys(INTERNAL).filter((f) => f in UNRENDERED_KNOWN);
ok("LEDGER-4: no field is declared twice", both.length === 0, both.join(", "));

// Every declaration carries a reason. An empty string is a declaration nobody has thought about.
const BASES = ["measured-in-repo", "measured-offline", "judged"];
const reasonless = [...Object.entries(INTERNAL), ...Object.entries(UNRENDERED_KNOWN)]
  .filter(([, r]) => !r || typeof r.note !== "string" || r.note.trim().length < 10).map(([f]) => f);
ok("LEDGER-5: every declaration carries a note", reasonless.length === 0, reasonless.join(", "));

const badBasis = [...Object.entries(INTERNAL), ...Object.entries(UNRENDERED_KNOWN)]
  .filter(([, r]) => !r || !BASES.includes(r.basis)).map(([f]) => f);
ok("LEDGER-5b: every declaration states what KIND of claim its note is", badBasis.length === 0,
  badBasis.join(", "));

// Declared-invisible must actually BE invisible. If a renderer ships for one of these and the
// ledger is not edited, this goes red and the entry gets moved rather than quietly lying.
const nowRendered = [...Object.keys(INTERNAL), ...Object.keys(UNRENDERED_KNOWN)].filter((f) => reads(f) > 0);
ok("LEDGER-6: nothing declared invisible is actually being read", nowRendered.length === 0,
  nowRendered.length ? "now rendered, move it: " + nowRendered.join(", ") : "");

// Leaf collisions, pinned.
const byLeaf = {};
for (const f of FIELDS) (byLeaf[leafOf(f)] ||= []).push(f);
const ambiguous = Object.keys(byLeaf).filter((k) => byLeaf[k].length > 1).sort();
eq("LEDGER-7: the set of ambiguous leaf names has not grown",
  JSON.stringify(ambiguous), JSON.stringify(AMBIGUOUS_LEAVES));

// ─────────────────────────────────────────────────────────────────────────────────────────────
// R3 — PROVE IT CATCHES THE THING IT EXISTS FOR.
const PLANT = "narrative_headline.sparkline_caption";

ok("R3-1: a NEW field rendered nowhere and undeclared is CAUGHT, and named",
  (() => { const v = violations([...FIELDS, PLANT], INTERNAL, UNRENDERED_KNOWN, CODE);
           return v.length === 1 && v[0] === PLANT; })());

ok("R3-2: the same field declared INTERNAL is accepted",
  violations([...FIELDS, PLANT], { ...INTERNAL, [PLANT]: "synthetic, for the guard's own proof" },
    UNRENDERED_KNOWN, CODE).length === 0);

// R3-3: without comment stripping, a comment-only mention counts as a read and the guard goes
// blind. narrative_headline.verdict is mentioned twice, in two // comments that say it is NOT
// read. Measured against the UNSTRIPPED source it looks rendered.
const RAWCODE = DASH_SRC;
eq("R3-3a: verdict has zero reads in the STRIPPED source", readsIn(CODE, "verdict"), 0);
ok("R3-3b: and non-zero in the UNSTRIPPED source, so stripping is load-bearing",
  readsIn(RAWCODE, "verdict") > 0, "raw reads: " + readsIn(RAWCODE, "verdict"));
// Across BOTH declared-invisible classes, not just the backlog. The field that demonstrates this
// (the verdict, 42 raw hits in two comments) moved to INTERNAL on 2026-09-20, and an assertion
// pinned to one class would have gone red for a reclassification rather than for a defect.
const DECLARED_INVISIBLE = [...Object.keys(INTERNAL), ...Object.keys(UNRENDERED_KNOWN)];
ok("R3-3c: dropping the stripping would silently mark a declared-invisible field as rendered",
  DECLARED_INVISIBLE.some((f) => readsIn(RAWCODE, leafOf(f)) > 0 && readsIn(CODE, leafOf(f)) === 0));

// R3-4: a nested field rendered nowhere is caught even though its PARENT is read. This is the
// shape that hid confounder_note for months.
// The class it is declared in is not the point; being DECLARED at all, while its parent renders,
// is. This is the shape that hid confounder_note for months.
ok("R3-4: a nested field is caught even when its parent IS read",
  reads("narrative_headline") > 0 && reads("narrative_headline.verdict") === 0 &&
  DECLARED_INVISIBLE.includes("narrative_headline.verdict"));

// R3-5: top-level-only checking would MISS it, which is why nesting is not optional.
ok("R3-5: a top-level-only guard would have missed confounder_note's whole class",
  FIELDS.filter((f) => f.includes(".") && !f.includes("[]")).length > 10);

console.log("  runtime: " + Math.round(performance.now()) + " ms");

if (process.env.WRITE_SNAPSHOT === "1" && SOURCE_MODE === "live") {
  writeFileSync(SNAPSHOT, JSON.stringify({ source: "supa index.ts Call B OUTPUT SCHEMA + payload assembly", fields: live.fields }, null, 1) + "\n");
  console.log("  snapshot rewritten");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
