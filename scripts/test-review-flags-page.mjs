#!/usr/bin/env node
// REVIEW_FLAGS_V1 -- the /review redesign (supa docs/followups-2026-09-25.md item 7), exercised on the
// page's REAL script in a vm, against a fake review-action and a DOM that records what was rendered.
//
//   F-1  a count of open flags at the top, by code
//   F-2  markers out of range first; unscored and in range folded below, not deleted
//   F-3  each prose field shows the markers it names with their bands, inline
//   F-4  flagged sentences are highlighted with their flag code; unflagged ones are not
//   F-5  the engine's free-text flags stay readable, and the raw review_flags are still shown as stored
//   F-6  against an OLDER review-action (no rank, no named, no sentences, no summary) the page still renders
//   F-7  the client's fallback bandRank matches review-action's (the RA-1 vector in supa)
// Every value is invented.
//
//   node scripts/test-review-flags-page.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const PAGE = readFileSync(process.env.REVIEW || "review.html", "utf8");
const JS = (PAGE.match(/<script>\n([\s\S]*?)<\/script>/) || [])[1] || "";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
ok(JS.length > 5000, "CONTROL: the page script located (" + JS.length + " chars)");

// ── a DOM that keeps a tree ──────────────────────────────────────────────────────────────────────
function mkEl(tag) {
  const cls = new Set(); const kids = []; let text = "";
  const e = {
    tagName: String(tag || "div").toUpperCase(), dataset: {}, value: "", style: {}, disabled: false, type: "",
    get className() { return [...cls].join(" "); }, set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
    classList: { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; }, contains: (c) => cls.has(c) },
    get textContent() { return text + kids.map((k) => k.textContent).join(""); },
    set textContent(v) { text = String(v); kids.length = 0; },
    appendChild(k) { kids.push(k); return k; }, get children() { return kids; },
    addEventListener() {}, querySelectorAll() { return []; },
  };
  return e;
}
const walk = (e, f) => { f(e); for (const k of e.children || []) walk(k, f); };
const find = (root, pred) => { const out = []; walk(root, (e) => { if (pred(e)) out.push(e); }); return out; };
const hasClass = (e, c) => e.classList && e.classList.contains(c);

function boot(detail) {
  const ids = {};
  const document = {
    getElementById: (id) => (ids[id] = ids[id] || mkEl("div")),
    createElement: (t) => mkEl(t), createTextNode: (t) => { const n = mkEl("#text"); n.textContent = t; return n; },
    querySelectorAll: () => [],
  };
  const sb = {
    functions: { invoke: async () => ({ data: detail, error: null }) },
    auth: { getSession: async () => ({ data: { session: null } }), signInWithPassword: async () => ({}), signOut: async () => ({}) },
  };
  const ctx = { document, supabase: { createClient: () => sb }, console: { log() {}, error() {}, warn() {} }, setTimeout, JSON, Array, String, Number, Math, Object, Promise, Set, Map };
  ctx.window = ctx;
  vm.createContext(ctx);
  new vm.Script(JS).runInContext(ctx);
  return { ctx, $: (id) => document.getElementById(id) };
}

const FLAG_TSH = { code: "prose_band_conflict", field_path: "narrative_headline.lead", marker_id: "tsh", band: "suboptimal_high", claimed_class: "normal", claim: "in a completely comfortable place", sentence_hash: "aaaa0001", sensitive_system: false };
const FLAG_TIN = { code: "prose_band_conflict", field_path: "priorities[0].why_this_matters", marker_id: "tin", band: "optimal", claimed_class: "high", claim: "above that interval", sentence_hash: "aaaa0002", sensitive_system: true };
const FLAG_DX = { code: "diagnostic_claim", field_path: "priorities[0].why_this_matters", kind: "rule_out", sentence_hash: "aaaa0003" };
const FREE = "engine deferred metabolic but model narration did not";
const DETAIL = {
  ok: true,
  report: { report_id: "r-1", hours_waiting: 2, collected_on: "2024-07-01", lab_name: "Lab" },
  markers: [
    { marker_key: "tsh", display_name: "TSH", value: 4.1, unit: "mIU/L", band: "suboptimal_high", rank: 2, sensitive_system: false },
    { marker_key: "ferritin", display_name: "Ferritin", value: 60, unit: "ng/mL", band: "optimal", rank: 4, sensitive_system: false },
    { marker_key: "zinc", display_name: "Zinc", value: null, unit: "", band: null, rank: 3, sensitive_system: false },
    { marker_key: "tin", display_name: "Tin", value: 1.2, unit: "ug/L", band: "optimal", rank: 4, sensitive_system: true },
    { marker_key: "hb", display_name: "Hemoglobin", value: 11, unit: "g/dL", band: "low", rank: 1, sensitive_system: false },
  ],
  narrative: [
    { path: "narrative_headline.lead", text: "TSH is in a completely comfortable place. Ferritin is solid.",
      named: [{ marker_id: "tsh", display_name: "TSH", band: "suboptimal_high", sensitive_system: false }, { marker_id: "ferritin", display_name: "Ferritin", band: "optimal", sensitive_system: false }],
      sentences: [{ text: "TSH is in a completely comfortable place. ", hash: "aaaa0001", flags: [FLAG_TSH] }, { text: "Ferritin is solid.", hash: "aaaa0009", flags: [] }] },
    { path: "priorities[0].why_this_matters", text: "Tin came back above that interval. This isn't a sign of kidney disease.",
      named: [{ marker_id: "tin", display_name: "Tin", band: "optimal", sensitive_system: true }],
      sentences: [{ text: "Tin came back above that interval. ", hash: "aaaa0002", flags: [FLAG_TIN] }, { text: "This isn't a sign of kidney disease.", hash: "aaaa0003", flags: [{ code: "diagnostic_claim", kind: "rule_out" }] }] },
    { path: "systems[0].summary_line", text: "Nothing named here.", named: [], sentences: [{ text: "Nothing named here.", hash: "aaaa0010", flags: [] }] },
  ],
  review_flags: [FREE, FLAG_TSH, FLAG_TIN, FLAG_DX],
  flag_summary: { open: 4, by_code: { prose_band_conflict: 2, diagnostic_claim: 1, free_text: 1 }, coded: [FLAG_TSH, FLAG_TIN, FLAG_DX], free_text: [FREE] },
  history: [],
};

// ── the redesigned page ──────────────────────────────────────────────────────────────────────────
{
  const b = boot(DETAIL);
  await b.ctx.openDetail({ report_id: "r-1" });
  console.log("F-1  the open-flag count at the top");
  ok(b.$("flag-count").textContent === "4 open flags", "F-1: the count reads 4 open flags (" + b.$("flag-count").textContent + ")");
  ok(/2 prose and band/.test(b.$("flag-codes").textContent) && /1 diagnostic claim/.test(b.$("flag-codes").textContent) && /1 engine note/.test(b.$("flag-codes").textContent), "F-1: and counts each code");
  ok(find(b.$("flag-list"), (e) => hasClass(e, "flagrow")).length === 3, "F-1: each coded flag is listed with its field path");

  console.log("F-2  out of range first, the rest folded");
  const host = b.$("markers");
  const tables = find(host, (e) => e.tagName === "TABLE");
  const details = find(host, (e) => e.tagName === "DETAILS");
  ok(tables.length === 2 && details.length === 1, "F-2: one table shown, one folded inside details");
  const firstRows = find(tables[0], (e) => e.tagName === "TR").slice(1).map((r) => r.children[0].textContent);
  ok(JSON.stringify(firstRows) === JSON.stringify(["Hemoglobin", "TSH"]), "F-2: the shown table is out of range first, then borderline (" + firstRows.join(",") + ")");
  const foldedRows = find(details[0], (e) => e.tagName === "TR").slice(1).map((r) => r.children[0].textContent);
  ok(foldedRows.length === 3 && foldedRows[0] === "Zinc", "F-2: unscored then in range are folded, none deleted (" + foldedRows.join(",") + ")");
  ok(foldedRows.includes("Tin (safety class)"), "F-2: a safety-class marker is labelled");

  console.log("F-3  named markers with bands, inline, per field");
  const nar = b.$("narrative");
  const chips = find(nar, (e) => hasClass(e, "chip")).map((c) => c.textContent);
  ok(chips.includes("TSH · suboptimal_high") && chips.includes("Ferritin · optimal") && chips.includes("Tin · optimal"), "F-3: each field shows its markers' bands (" + chips.join(" | ") + ")");
  ok(find(nar, (e) => hasClass(e, "chip") && hasClass(e, "sens")).length === 1, "F-3: the safety-class chip is marked");

  console.log("F-4  flagged sentences highlighted with their code");
  const flagged = find(nar, (e) => hasClass(e, "sent") && hasClass(e, "flagged")).map((e) => e.textContent.trim());
  ok(JSON.stringify(flagged) === JSON.stringify(["TSH is in a completely comfortable place.", "Tin came back above that interval.", "This isn't a sign of kidney disease."]), "F-4: exactly the three flagged sentences are highlighted");
  const plain = find(nar, (e) => hasClass(e, "sent") && !hasClass(e, "flagged")).map((e) => e.textContent.trim());
  ok(plain.includes("Ferritin is solid."), "F-4: CONTROL, an unflagged sentence in a flagged field is shown plain");
  const codes = find(nar, (e) => hasClass(e, "fcode")).map((e) => e.textContent);
  ok(codes.some((c) => c.startsWith("prose_band_conflict") && /prose says normal/.test(c)) && codes.some((c) => c.startsWith("diagnostic_claim") && /rules a condition out/.test(c)), "F-4: each highlight carries its code and what it means");
  ok(codes.some((c) => /safety class, never substitute a band word/.test(c)), "F-4: the tin flag says it is a safety class");
  ok(find(nar, (e) => e.tagName === "TEXTAREA").length === 3, "F-4: every field is still editable");
  ok(find(nar, (e) => hasClass(e, "sents")).length === 2, "F-4: a field with no flag gets no preview box");

  console.log("F-5  free text readable; raw flags still shown as stored");
  ok(b.$("free-flags").textContent === FREE, "F-5: the engine's free-text flag is shown as readable text");
  ok(b.$("flags").textContent === JSON.stringify(DETAIL.review_flags, null, 2), "F-5: review_flags is still dumped exactly as stored");
}

// ── an older review-action ───────────────────────────────────────────────────────────────────────
{
  const OLD = JSON.parse(JSON.stringify(DETAIL));
  delete OLD.flag_summary;
  for (const m of OLD.markers) { delete m.rank; delete m.sensitive_system; }
  OLD.narrative = OLD.narrative.map((f) => ({ path: f.path, text: f.text }));
  OLD.review_flags = [FREE];
  const b = boot(OLD);
  let threw = null;
  try { await b.ctx.openDetail({ report_id: "r-1" }); } catch (e) { threw = e; }
  console.log("F-6  an older review-action still renders");
  ok(!threw, "F-6: no throw" + (threw ? " -> " + threw : ""));
  const rows = find(find(b.$("markers"), (e) => e.tagName === "TABLE")[0] || mkEl("x"), (e) => e.tagName === "TR").slice(1).map((r) => r.children[0].textContent);
  ok(JSON.stringify(rows) === JSON.stringify(["Hemoglobin", "TSH"]), "F-6: the client ranks by band when no rank is sent (" + rows.join(",") + ")");
  ok(find(b.$("narrative"), (e) => e.tagName === "TEXTAREA").length === 3 && find(b.$("narrative"), (e) => hasClass(e, "sents")).length === 0, "F-6: fields render as plain editable text");
  ok(/not summarised/.test(b.$("flag-count").textContent), "F-6: the count says it has no summary rather than claiming zero");
}

console.log("F-7  the fallback bandRank matches review-action's");
{
  const b = boot(DETAIL);
  const vector = ["critical_high", "high", "deficient", "positive_ungraded", "suboptimal_high", "borderline_low", null, "optimal", "negative", "mystery_band"];
  const got = vector.map((x) => b.ctx.bandRank(x));
  ok(JSON.stringify(got) === JSON.stringify([0, 1, 1, 1, 2, 2, 3, 4, 4, 1]), "F-7: same ranks as supa review-annotate.test.ts RA-1 (" + got.join(",") + ")");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
