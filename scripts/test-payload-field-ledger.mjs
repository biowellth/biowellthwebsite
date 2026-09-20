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
// INTERNAL — diagnostics and plumbing. These must NEVER reach her screen.
const INTERNAL = {
  "user_id": "identity, joined on; never displayed",
  "generated_at": "diagnostic timestamp for the interpretation run",
  "model_used": "diagnostic — which model produced this payload",
  "prompt_version": "diagnostic — which prompt pair produced this payload",
  "engine_input_snapshot": "audit record so a rescore can be paired with its inputs",
  "internal_metadata": "named internal; the whole block is an audit trail",
  "internal_metadata.compression_ratio": "audit trail",
  "internal_metadata.confounders_active": "audit trail; the user-facing version is the confounder note",
  "internal_metadata.cycle_day_at_interpretation": "audit trail",
  "internal_metadata.missing_data_notes": "audit trail",
  "internal_metadata.priorities_generated": "audit trail",
  "internal_metadata.total_markers_analysed": "audit trail; marker_counts is the rendered version",
  "internal_metadata.warnings_triggered": "audit trail",
  "foundations.framing_mode": "an authoring-mode switch for the model, not copy",
  "cluster_patterns[].pattern_id": "internal Doc B identifier",
  "cluster_patterns[].priority_ids": "internal linkage between a pattern and its priorities",
};

// UNRENDERED-KNOWN — written, invisible, and arguably should be visible. This is the backlog, in
// the repo rather than in a chat, so shipping a renderer for one is a ledger edit that reads as
// progress. Nothing here is fixed by this pass.
const UNRENDERED_KNOWN = {
  "narrative_headline.verdict": "her one-line personalised band verdict; two comments say it is no longer read",
  "confounder_summary": "the whole block is invisible",
  "confounder_summary.active_confounders": "what was working against this draw",
  "confounder_summary.patterns_deferred": "which patterns were held back and why",
  "confounder_summary.retest_recommendation": "the earliest valid retest with rationale, shown nowhere",
  "provider_discussion_points": "the whole block is invisible",
  "provider_discussion_points[].point": "what to raise with her doctor; 217 raw hits, zero readers",
  "provider_discussion_points[].urgency": "how soon to raise it",
  "provider_discussion_points[].supporting_markers": "which markers back the point",
  "cluster_patterns": "the whole block is invisible",
  "cluster_patterns[].pattern_name": "the human name of a cross-system pattern",
  "cluster_patterns[].explanation": "why those findings belong together",
  "cluster_patterns[].sequencing_advice": "what to address first",
  "priorities[].technical_layer": "the advisor-facing audit narrative; found in this state a pass ago",
  "priorities[].technical_layer.reasoning": "the clinical audit trail for a medical advisor",
  "priorities[].technical_layer.confidence": "how certain the read is",
  "priorities[].technical_layer.confounders_considered": "what was weighed and discarded",
  "priorities[].technical_layer.doc_b_patterns_active": "which Doc B patterns fired",
  "priorities[].technical_layer.alternative_differentials": "what else it could be and why less likely",
  "priorities[].provider_followup_flag": "whether this warrants seeing a doctor, and it is invisible",
  "systems[].display_group": "which pill a system rolls up into",
  "foundations.levers[].measured_signal": "the marker a lever is anchored to",
};

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
const reasonless = [...Object.entries(INTERNAL), ...Object.entries(UNRENDERED_KNOWN)]
  .filter(([, r]) => !r || r.trim().length < 10).map(([f]) => f);
ok("LEDGER-5: every declaration carries a reason", reasonless.length === 0, reasonless.join(", "));

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
ok("R3-3c: dropping the stripping would silently mark a declared-invisible field as rendered",
  [...Object.keys(UNRENDERED_KNOWN)].some((f) => readsIn(RAWCODE, leafOf(f)) > 0 && readsIn(CODE, leafOf(f)) === 0));

// R3-4: a nested field rendered nowhere is caught even though its PARENT is read. This is the
// shape that hid confounder_note for months.
ok("R3-4: a nested field is caught even when its parent IS read",
  reads("narrative_headline") > 0 && reads("narrative_headline.verdict") === 0 &&
  "narrative_headline.verdict" in UNRENDERED_KNOWN);

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
