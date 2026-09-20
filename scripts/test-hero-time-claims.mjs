#!/usr/bin/env node
// HERO_TIME_V1 -- the hero's claims about WHEN, extracted from dashboard.html so the suite
// exercises shipped source rather than a copy that can drift. Same technique as test-dob-gate.mjs.
//
// THE LOAD-BEARING PROPERTY is that the page never claims a reading is current when it is not.
// Measured on the stored panels: 19 of 21 were more than a year old at upload, the oldest by 756
// days. So "Right now" and a tick reading "today" were false on nearly every real panel, and the
// only safe default when a date cannot be read is to make NO claim about when.
//
// Dates are read in UTC on purpose. A date-only panel_date parses as UTC midnight, so formatting it
// in the viewer's timezone renames the month anywhere west of Greenwich: in this repo under EDT,
// "2025-03-01" formats as February 2025. These tests pin the UTC answer.
//
//   node scripts/test-hero-time-claims.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

function extract(name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found in " + FILE + ": " + name);
  let i = HTML.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced braces: " + name);
  return HTML.slice(m.index, end);
}
// `const NAME = { ... };` and `const NAME = [ ... ];` blocks, brace/bracket matched.
function extractBlock(name) {
  const re = new RegExp("const\\s+" + name + "\\s*=\\s*[\\{\\[]");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a block const in " + FILE + ": " + name);
  const open = HTML[m.index + m[0].length - 1], close = open === "{" ? "}" : "]";
  let i = m.index + m[0].length - 1, depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === open) depth++;
    else if (HTML[j] === close) { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced block: " + name);
  return HTML.slice(m.index, end) + ";";
}
function extractLine(name) {
  const re = new RegExp("^const\\s+" + name + "\\s*=.*;\\s*$", "m");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a one-line const in " + FILE + ": " + name);
  return m[0];
}

globalThis.PROFILE = null;   // the nameless case, which the comment at buildHeroSummary calls the common one
const src = [
  extractLine("SENSITIVE_MARKER_IDS"), extractLine("SENSITIVE_SYSTEMS"),
  extractBlock("SAFETY_CLASS"), extractBlock("BAND_CLAUSE"), extractBlock("MARKER_PHRASE"),
  extractBlock("HT_MON_SHORT"), extractBlock("HT_MON_LONG"), extractLine("HERO_FRESH_DAYS"),
  extract("esc"), extract("firstName"), extract("capitalise"), extract("fmtPanelDate"),
  extract("heroDateParts"), extract("heroPanelAgeDays"), extract("heroLeadClause"),
  extract("heroOpenerClause"), extract("heroOpenerWithName"),
  extract("prioritySensitive"), extract("sensitiveVerdict"), extract("verdictPhrases"),
  extract("joinPhrases"), extract("trajectoryFragment"), extract("buildHeroSummaryHTML"),
  extract("heroTrajectoryModel"), extract("heroTrajectorySVG"),
  ";globalThis.__parts = heroDateParts; globalThis.__age = heroPanelAgeDays;",
  ";globalThis.__lead = heroLeadClause; globalThis.__opener = heroOpenerClause;",
  ";globalThis.__named = heroOpenerWithName; globalThis.__hero = buildHeroSummaryHTML;",
  ";globalThis.__model = heroTrajectoryModel; globalThis.__svg = heroTrajectorySVG;",
  ";globalThis.__FRESH = HERO_FRESH_DAYS;",
].join("\n");
new Function(src)();
const parts = globalThis.__parts, age = globalThis.__age, lead = globalThis.__lead;
const opener = globalThis.__opener, named = globalThis.__named, hero = globalThis.__hero;
const model = globalThis.__model, draw = globalThis.__svg, FRESH = globalThis.__FRESH;

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

// A single-panel model whose one point carries `date`, so the tick has something to name.
const singleModel = (date) => model({
  ferritin: { system_id: "iron", display_name: "Ferritin",
              points: [{ value: 12, date: date, unit: "ng/mL", cycleGated: false }] },
  tsh:      { system_id: "thyroid", display_name: "TSH",
              points: [{ value: 2.0, date: date, unit: "uIU/mL", cycleGated: false }] },
}, ["ferritin", "tsh"]);
const tickOf = (svg) => {
  const m = [...svg.matchAll(/<text class="ht-tick"[^>]*>([^<]*)<\/text>/g)].map(x => x[1]);
  return m;
};

console.log("TICK -- the dot names the draw month, never today");
{
  const svg = draw(singleModel("2025-03-01"), 630, null);
  const ticks = tickOf(svg);
  ok(ticks.includes("Mar 2025"), "TICK-1: the point's own date names the month  (ticks " + JSON.stringify(ticks) + ")");
  ok(!svg.includes("today"), "TICK-2: the word today is gone");
  ok(ticks.includes("next"), "TICK-3: the next-panel tick is untouched, so the tick row still renders");
}
{
  // No date on the point, so panel_date is the fallback.
  const svg = draw(singleModel(null), 630, "2024-11-20");
  const ticks = tickOf(svg);
  ok(ticks.includes("Nov 2024"), "TICK-4: panel_date is the fallback  (ticks " + JSON.stringify(ticks) + ")");
  ok(!svg.includes("today"), "TICK-5: still no today");
}
{
  // Neither, so no tick word at all. An unlabelled dot is honest; a guessed month is not.
  const svg = draw(singleModel(null), 630, null);
  const ticks = tickOf(svg);
  eq(ticks.length, 1, "TICK-6: only the next tick is drawn  (ticks " + JSON.stringify(ticks) + ")");
  eq(ticks[0], "next", "TICK-7: and it is the next-panel one");
  ok(!svg.includes("today"), "TICK-8: no today, no invented date");
}
{
  const p = parts("2025-03-01");
  eq(p && p.short, "Mar 2025", "TICK-9: a first-of-month date reads in UTC, not the viewer's timezone");
  eq(p && p.long, "March 2025", "TICK-10: and the long form matches");
  eq(parts(null), null, "TICK-11: no date is null, not a guess");
  eq(parts("not-a-date"), null, "TICK-12: an unreadable date is null too");
}

console.log("AGE -- the 90 day boundary, both sides");
{
  const NOW = "2026-09-20T12:00:00";
  eq(age("2026-09-20", NOW), 0, "AGE-1: a draw today is zero days old");
  eq(age("2026-06-22", NOW), 90, "AGE-2: 90 days is 90");
  eq(age("2026-06-21", NOW), 91, "AGE-3: and the day before is 91");
  eq(FRESH, 90, "AGE-4: the freshness threshold in the file is 90");
  eq(lead("2026-06-22", NOW), ". Right now ", "AGE-5: at exactly 90 days the sentence still says Right now");
  eq(lead("2026-06-21", NOW), ". As of your June 2026 panel, ", "AGE-6: at 91 days it names the panel instead");
  eq(lead("2025-03-01", NOW), ". As of your March 2025 panel, ", "AGE-7: an old panel names its own month");
  eq(lead(null, NOW), ". In this panel, ", "AGE-8: no panel_date makes no claim about when");
  eq(lead("", NOW), ". In this panel, ", "AGE-9: an empty panel_date is the same");
  eq(lead("not-a-date", NOW), ". In this panel, ", "AGE-10: and so is an unreadable one");
  ok(!lead("2026-06-21", NOW).includes(":"), "AGE-11: no colon in the lead clause");
  ok(!lead("2026-06-21", NOW).includes("—"), "AGE-12: and no em dash");
}

console.log("OPENER -- first panel says Overall, multi-panel is untouched");
{
  eq(opener("steady", true), "Overall, you are steady", "OPEN-1: first panel and steady");
  eq(opener("steady", false), "You are holding steady", "OPEN-2: multi-panel steady is unchanged");
  eq(opener("running_on_reserve", true), "You are running on reserve", "OPEN-3: first-panel running_on_reserve unchanged");
  eq(opener("running_strong", true), "You are running strong", "OPEN-4: first-panel running_strong unchanged");
  eq(opener("stretched_thin", true), "You are stretched thin", "OPEN-5: first-panel stretched_thin unchanged");
  eq(opener("nonsense_key", true), null, "OPEN-6: an unknown band key still returns null so the caller falls back");
  eq(named("Overall, you are steady", "Aditi"), "Aditi, you are steady",
     "OPEN-7: with a name the Overall is dropped rather than stacked");
  eq(named("You are holding steady", "Aditi"), "Aditi, you are holding steady",
     "OPEN-8: the other clauses keep today's name behaviour");
  eq(named("Overall, you are steady", ""), "Overall, you are steady", "OPEN-9: no name, no change");
}

// End to end through the live builder. Two priorities resolve two driver phrases, which is the
// minimum buildHeroSummaryHTML needs before it will return a sentence at all.
const payload = (bandKey, panelDate, longi) => ({
  panel_date: panelDate,
  vitality: { band: { key: bandKey, label: "x" } },
  longitudinal: longi,
  priorities: [
    { system_id: "iron",   primary_markers: [{ marker_id: "ferritin", position: "low" }] },
    { system_id: "liver",  primary_markers: [{ marker_id: "alt", position: "high" }] },
  ],
});
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
console.log("SENTENCE -- the whole hero line, through the shipped builder");
{
  const fresh = hero(payload("steady", daysAgo(30), null));
  ok(fresh !== null, "SENT-0: the fixture resolves a sentence, so the rest is not vacuous");
  ok(fresh.text.startsWith("Overall, you are steady"), "SENT-1: first panel opens with Overall  (" + fresh.text.slice(0, 40) + ")");
  ok(fresh.text.includes(". Right now "), "SENT-2: a 30 day old panel still says Right now");
  const old = hero(payload("steady", daysAgo(400), null));
  ok(old.text.includes(" panel, "), "SENT-3: a 400 day old panel names its panel  (" + old.text.slice(0, 70) + ")");
  ok(!old.text.includes("Right now"), "SENT-4: and drops Right now");
  const none = hero(payload("steady", null, null));
  ok(none.text.includes(". In this panel, "), "SENT-5: no panel_date makes no claim about when");
  const multi = hero(payload("steady", daysAgo(30), { baseline_panel_date: "2025-01-01", counts: { resolved: 2, newly_crossed: 1 } }));
  ok(multi.text.startsWith("You are holding steady"), "SENT-6: a multi-panel opener is unchanged  (" + multi.text.slice(0, 40) + ")");
  const res = hero(payload("running_on_reserve", daysAgo(30), null));
  ok(res.text.startsWith("You are running on reserve"), "SENT-7: first-panel running_on_reserve is unchanged");
  for (const [name, r] of [["fresh", fresh], ["old", old], ["none", none], ["multi", multi], ["reserve", res]]) {
    ok(!r.text.includes("today"), "SENT-8." + name + ": no today in the sentence");
    ok(!r.text.includes(":"), "SENT-9." + name + ": no colon");
    ok(!r.text.includes("—"), "SENT-10." + name + ": no em dash");
    ok(r.html.includes('<em class="hl">'), "SENT-11." + name + ": the driver emphasis markup survives");
  }
  // text and html must stay the same sentence apart from the <em> wraps.
  const strip = (h) => h.replace(/<\/?em[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
  eq(strip(old.html), old.text, "SENT-12: html and text are the same sentence once the emphasis is stripped");
}

console.log("KNOWN-POSITIVE CONTROLS -- the harness can actually fail");
{
  let threw = false;
  try { extract("thisFunctionDoesNotExist"); } catch (_) { threw = true; }
  ok(threw, "CTRL-1: extract() throws on a missing function, so a silent no-op is impossible");
  let threw2 = false;
  try { extractBlock("NOT_A_REAL_BLOCK"); } catch (_) { threw2 = true; }
  ok(threw2, "CTRL-2: extractBlock() throws too");
  ok(HTML.indexOf("today</text>") === -1, "CTRL-3: the literal today tick is gone from the file itself");
  ok(HTML.indexOf('". Right now "') > -1, "CTRL-4: and Right now still EXISTS in the file, so CTRL-3 is not matching an empty file");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
