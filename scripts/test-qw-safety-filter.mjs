#!/usr/bin/env node
// QW_SAFETY_ANY_V1 -- dropSuppressedQW drops a quietly_working entry when ANY of its markers belongs
// to heavy_metals, autoimmune or tumor_markers, or when it has no markers at all. The whole entry
// goes, never just the marker, because the prose may name it.
//
// The function under test is EXTRACTED from the shipped dashboard.html and executed, never copied
// here, so the test cannot pass against a second definition. A MUTANT (the shipped file with the old
// all-markers rule restored) must fail the mixed and markerless cases, proving they discriminate.
// The wiring check proves every surface that reads p.quietly_working routes through the filter.
//
// Every fixture is SYNTHETIC. No stored row, no real result, no user id.
//
//   node scripts/test-qw-safety-filter.mjs        DASH=path/to/dashboard.html
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const RAW = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (label, cond) => {
  if (cond) { pass++; console.log("  ok   " + label); }
  else { fail++; console.log("  FAIL " + label); }
};

// Brace-matched extraction of `function dropSuppressedQW(...){...}` plus its SENSITIVE_SYSTEMS const.
function extract(src) {
  const sens = src.match(/const SENSITIVE_SYSTEMS = new Set\(\[[^\]]*\]\);/);
  const start = src.indexOf("function dropSuppressedQW(");
  if (!sens || start < 0) return null;
  let i = src.indexOf("{", start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) break;
  }
  return new Function(sens[0] + "\n" + src.slice(start, i + 1) + "\nreturn dropSuppressedQW;")();
}

const PAYLOAD = { systems: [
  { system_id: "tumor_markers", markers: [{ marker_id: "synthetic_tumor_marker" }] },
  { system_id: "metabolic", markers: [{ marker_id: "glucose" }] },
] };
const CASES = [
  { name: "pure safety (floor id)",           entry: { finding: "s", markers: ["lead", "mercury"] },          keep: false },
  { name: "pure safety (payload.systems id)", entry: { finding: "s", markers: ["synthetic_tumor_marker"] },   keep: false },
  { name: "mixed safety + ordinary",          entry: { finding: "s", markers: ["ana", "glucose"] },           keep: false },
  { name: "mixed tumor + ordinary",           entry: { finding: "s", markers: ["glucose", "synthetic_tumor_marker"] }, keep: false },
  { name: "no markers field",                 entry: { finding: "s" },                                        keep: false },
  { name: "empty markers array",              entry: { finding: "s", markers: [] },                           keep: false },
  { name: "ordinary",                         entry: { finding: "s", markers: ["glucose", "ferritin"] },      keep: true },
];
const run = (fn) => CASES.map((c) => fn([c.entry], PAYLOAD).length === 1);

console.log("QW-1 shipped dropSuppressedQW");
const shipped = extract(RAW);
ok("QW-1.0 function and SENSITIVE_SYSTEMS extracted from " + FILE, typeof shipped === "function");
if (shipped) {
  const got = run(shipped);
  CASES.forEach((c, k) => ok("QW-1." + (k + 1) + " " + c.name + " -> " + (c.keep ? "kept" : "dropped"), got[k] === c.keep));
  const order = shipped([CASES[6].entry, CASES[2].entry, { finding: "t", markers: ["vitamin_d"] }], PAYLOAD);
  ok("QW-1.8 a list keeps only the ordinary entries, in order", order.length === 2 && order[0] === CASES[6].entry && order[1].finding === "t");
}

console.log("QW-2 mutant: the old all-markers / keep-markerless rule");
const MUT = RAW
  .replace("if(!mk.length) return false;", "if(!mk.length) return true;")
  .replace("return !mk.some(id => qwSuppIds.has(id));", "return !mk.every(id => qwSuppIds.has(id));");
ok("QW-2.0 mutant differs from shipped", MUT !== RAW);
const mutant = extract(MUT);
if (mutant) {
  const got = run(mutant);
  ok("QW-2.1 mutant keeps the mixed entry (case discriminates)", got[2] === true);
  ok("QW-2.2 mutant keeps the markerless entry (case discriminates)", got[4] === true && got[5] === true);
  ok("QW-2.3 control: mutant still drops pure safety and keeps ordinary", got[0] === false && got[6] === true);
}

console.log("QW-3 wiring: every read of p.quietly_working routes through dropSuppressedQW");
const reads = RAW.split("\n").map((l, n) => [n + 1, l])
  .filter(([, l]) => /\bp\.quietly_working\b/.test(l) && !/^\s*\/\//.test(l));
ok("QW-3.0 found the four render reads (snapshot, dashboard, companion, deck)", reads.length === 4);
for (const [n, l] of reads) ok("QW-3 line " + n + " calls dropSuppressedQW", l.includes("dropSuppressedQW("));

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
