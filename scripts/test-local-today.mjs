#!/usr/bin/env node
// LOCAL_TODAY_TEST_V1 -- the viewer's LOCAL calendar date, through localCalendarDay, at the three
// places that compare against "today" or print an instant as a day. Functions are extracted from the
// shipped dashboard.html (same technique as test-dob-gate.mjs) and run in a child process per time
// zone (TZ=...), with the clock frozen at a chosen instant. Every value is invented.
//
//   LT-p  the period-date picker: initCycleCapture's lmp.max, and collectCycle's "no later than
//         today" filter on lmp_date_before_draw.
//         Kolkata at local 03:00 (before 05:30, so the UTC date is yesterday): today is pickable.
//         New_York at local 21:00 (the UTC date is tomorrow): tomorrow is not allowed.
//   LT-d  dobAgeYears / dobIsAdult: the under-18 gate flips exactly on the LOCAL 18th birthday.
//         Day before, day of, day after, under New_York, Kolkata and Kiritimati, each at a local
//         hour where the UTC date is different, through the gate's path (no `on`, frozen clock)
//         and through an explicit `on`.
//   LT-v  rvFmtDate: created_at (a timestamp, "Added") prints the LOCAL day; collected_on and
//         lmp_date_before_draw (stored calendar days) print as stored in every zone.
//
// CONTROLS in the same run: each child reports its resolved time zone and offset, and the same
// instant must give different answers in different zones (picker max, vault "Added" day), so a
// zone that silently fell back to the machine's would go red. The frozen clock is checked too.
//
// MUTANTS, each restoring the UTC behaviour at one place, each must go RED:
//   M-p  the two picker sites back to new Date().toISOString().slice(0,10)
//   M-d  dobAgeYears back to the UTC getters
//   M-v  rvFmtDate back to the UTC getters
//   M-h  the shared helper itself on UTC getters (proves the picker and the gate both read it)
// A mutant whose anchor does not match is a harness failure, never a pass.
//
//   node scripts/test-local-today.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const FILE = process.env.DASH || "dashboard.html";
const SELF = fileURLToPath(import.meta.url);

const MUTANTS = {
  p: [
    ["lmp.max = localCalendarDay();", "lmp.max = new Date().toISOString().slice(0,10);"],
    ["const today = localCalendarDay();\n    if(lmpV", "const today = new Date().toISOString().slice(0,10);\n    if(lmpV"],
  ],
  d: [
    ["const today = localCalendarDay(on || undefined);\n  if(!today) return null;\n  const ry = +today.slice(0, 4), rm = +today.slice(5, 7), rd = +today.slice(8, 10);",
     "const ref = on ? new Date(on) : new Date();\n  const ry = ref.getUTCFullYear(), rm = ref.getUTCMonth() + 1, rd = ref.getUTCDate();"],
  ],
  v: [
    ['return fmtCalendarDay(iso, "en-GB", { day:"numeric", month:"long", year:"numeric" }) || "";',
     'const d = new Date(iso); if(isNaN(d)) return "";\n  return d.getUTCDate() + " " + ["January","February","March","April","May","June","July","August","September","October","November","December"][d.getUTCMonth()] + " " + d.getUTCFullYear();'],
  ],
  h: [
    ['return t.getFullYear() + "-" + p(t.getMonth() + 1) + "-" + p(t.getDate());',
     'return t.getUTCFullYear() + "-" + p(t.getUTCMonth() + 1) + "-" + p(t.getUTCDate());'],
  ],
};

// Per zone: instants chosen so the LOCAL date and the UTC date differ.
const BIRTH = "2008-10-02";   // 18th birthday 2026-10-02
const ZONES = {
  "America/New_York": {       // UTC-4 in October; local 22:00 / 21:00 is the next UTC day
    offset: 240, pickerNow: "2026-10-02T01:00:00Z", today: "2026-10-01", tomorrow: "2026-10-02",
    dob: ["2026-10-02T02:00:00Z", "2026-10-03T02:00:00Z", "2026-10-04T02:00:00Z"],
    added: { "2026-10-02T01:00:00.123456+00:00": "1 October 2026", "2026-10-01T20:00:00Z": "1 October 2026" },
  },
  "Asia/Kolkata": {           // UTC+5:30; local 03:00 is the previous UTC day
    offset: -330, pickerNow: "2026-10-01T21:30:00Z", today: "2026-10-02", tomorrow: "2026-10-03",
    dob: ["2026-09-30T21:30:00Z", "2026-10-01T21:30:00Z", "2026-10-02T21:30:00Z"],
    added: { "2026-10-02T01:00:00.123456+00:00": "2 October 2026", "2026-10-01T20:00:00Z": "2 October 2026" },
  },
  "Pacific/Kiritimati": {     // UTC+14; local 08:00 is the previous UTC day
    offset: -840, pickerNow: "2026-10-01T18:00:00Z", today: "2026-10-02", tomorrow: "2026-10-03",
    dob: ["2026-09-30T18:00:00Z", "2026-10-01T18:00:00Z", "2026-10-02T18:00:00Z"],
    added: { "2026-10-02T01:00:00.123456+00:00": "2 October 2026", "2026-10-01T20:00:00Z": "2 October 2026" },
  },
};
const STORED = "2026-04-01", STORED_WANT = "1 April 2026";

function extract(html, name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(html);
  if (!m) throw new Error("not found: " + name);
  let i = html.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < html.length; j++) {
    if (html[j] === "{") depth++;
    else if (html[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced braces: " + name);
  return html.slice(m.index, end);
}

// ── CHILD: one zone, one variant. Prints one JSON line.
if (process.env.LT_CHILD) {
  let html = readFileSync(FILE, "utf8");
  const mut = process.env.LT_MUTANT;
  if (mut) for (const [from, to] of MUTANTS[mut]) {
    const n = html.split(from).length - 1;
    if (n !== 1) { console.log(JSON.stringify({ anchorMiss: from.slice(0, 60), count: n })); process.exit(0); }
    html = html.replace(from, () => to);
  }
  const z = ZONES[process.env.TZ];
  const RealDate = Date; let NOW = 0;
  class FrozenDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
    static now() { return NOW; }
  }
  const els = {};
  const document = { getElementById: (id) => els[id] || null };
  const cycSel = { declined: false };
  const names = ["localCalendarDay", "fmtCalendarDay", "rvFmtDate", "dobAgeYears", "dobIsAdult", "initCycleCapture", "collectCycle"];
  const body = names.map((n) => extract(html, n)).join("\n") + "\nreturn {" + names.join(",") + "};";
  const F = new Function("Date", "document", "cycSel", "cycInRange", "clientTimeZone", body)(
    FrozenDate, document, cycSel, () => null, () => null);
  const at = (iso) => { NOW = RealDate.parse(iso); };
  const out = { zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                offset: new RealDate(z.pickerNow).getTimezoneOffset() };
  at(z.pickerNow); out.frozen = new FrozenDate().toISOString() === new RealDate(z.pickerNow).toISOString();
  // picker
  els["cyc-lmp"] = { max: "", value: "", addEventListener() {} };
  F.initCycleCapture(); out.max = els["cyc-lmp"].max;
  els["cyc-lmp"].value = z.today;    out.keepToday = F.collectCycle().lmp_date_before_draw === z.today;
  els["cyc-lmp"].value = z.tomorrow; out.dropTomorrow = !("lmp_date_before_draw" in F.collectCycle());
  // dob, through the gate's path (no `on`) and with an explicit `on`
  out.dobGate = z.dob.map((iso) => { at(iso); return [F.dobIsAdult(BIRTH), F.dobAgeYears(BIRTH)]; });
  at("2000-01-01T12:00:00Z");   // the clock somewhere else entirely: only `on` may decide
  out.dobOn = z.dob.map((iso) => [F.dobIsAdult(BIRTH, iso), F.dobAgeYears(BIRTH, iso)]);
  // vault
  out.added = Object.keys(z.added).map((iso) => F.rvFmtDate(iso));
  out.stored = F.rvFmtDate(STORED);
  console.log(JSON.stringify(out));
  process.exit(0);
}

// ── PARENT
let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const J = JSON.stringify;
function child(tz, mutant) {
  const env = { ...process.env, TZ: tz, LT_CHILD: "1", DASH: FILE };
  if (mutant) env.LT_MUTANT = mutant; else delete env.LT_MUTANT;
  const r = spawnSync(process.execPath, [SELF], { env, encoding: "utf8" });
  try { return JSON.parse(r.stdout.trim().split("\n").pop()); }
  catch (e) { return { crashed: (r.stderr || "").slice(0, 300) }; }
}
// Each check returns true when that section is right in that zone.
const checkP = (z, r) => r.max === z.today && r.keepToday && r.dropTomorrow;
const WANT_D = [[false, 17], [true, 18], [true, 18]];
const checkD = (z, r) => J(r.dobGate) === J(WANT_D) && J(r.dobOn) === J(WANT_D);
const checkV = (z, r) => J(r.added) === J(Object.values(z.added)) && r.stored === STORED_WANT;

const real = {};
for (const tz of Object.keys(ZONES)) {
  const z = ZONES[tz], r = child(tz); real[tz] = r;
  console.log("\n" + tz);
  ok(!r.crashed && !r.anchorMiss, "LT-0 " + tz + ": child ran  (" + J(r.crashed || r.anchorMiss || "") + ")");
  // By offset, not name: ICU may report an alias (Asia/Kolkata resolves as Asia/Calcutta).
  ok(r.offset === z.offset, "LT-c CONTROL " + tz + ": the child runs at this zone's offset  (got " + J(r.offset) + " as " + J(r.zone) + ")");
  ok(r.frozen === true, "LT-c2 CONTROL " + tz + ": the frozen clock reads the chosen instant");
  ok(r.max === z.today, "LT-p1 " + tz + ": the picker's max is the local day  (got " + J(r.max) + ", want " + J(z.today) + ")");
  ok(r.keepToday === true, "LT-p2 " + tz + ": a period that started today is kept");
  ok(r.dropTomorrow === true, "LT-p3 " + tz + ": a period date of tomorrow is dropped");
  ok(J(r.dobGate) === J(WANT_D), "LT-d1 " + tz + ": gate path: day before 17 / refused, day of 18 / admitted, day after 18  (got " + J(r.dobGate) + ")");
  ok(J(r.dobOn) === J(WANT_D), "LT-d2 " + tz + ": with an explicit reference instant, the same  (got " + J(r.dobOn) + ")");
  ok(J(r.added) === J(Object.values(z.added)), "LT-v1 " + tz + ": created_at prints the local day it was added  (got " + J(r.added) + ")");
  ok(r.stored === STORED_WANT, "LT-v2 " + tz + ": a stored calendar day prints as stored  (got " + J(r.stored) + ")");
}

console.log("\nCONTROLS across zones -- the zone is live, not a constant");
const offs = Object.values(real).map((r) => r.offset);
ok(new Set(offs).size === offs.length, "LT-x1: three different UTC offsets  (got " + J(offs) + ")");
ok(real["America/New_York"].max !== real["Asia/Kolkata"].max, "LT-x2: the picker's max differs between New_York and Kolkata");
ok(real["America/New_York"].added[0] !== real["Asia/Kolkata"].added[0], "LT-x3: the same created_at prints different days in New_York and Kolkata");

console.log("\nMUTANTS -- the UTC behaviour restored at one place must go RED");
const red = (mutant, check, label) => {
  const zonesRed = [];
  for (const tz of Object.keys(ZONES)) {
    const r = child(tz, mutant);
    if (r.anchorMiss || r.crashed) { ok(false, "M-" + mutant + ": harness  (" + J(r.anchorMiss || r.crashed) + ")"); return; }
    if (!check(ZONES[tz], r)) zonesRed.push(tz);
  }
  ok(zonesRed.length > 0, "M-" + mutant + ": " + label + " goes red  (red in " + J(zonesRed) + ")");
};
red("p", checkP, "the picker on the UTC date");
red("d", checkD, "dobAgeYears on the UTC date");
red("v", checkV, "rvFmtDate on UTC getters");
red("h", checkP, "the shared helper on UTC (picker)");
red("h", checkD, "the shared helper on UTC (age gate)");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
