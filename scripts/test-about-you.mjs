#!/usr/bin/env node
// ABOUT_YOU_V1 — the once-only, skippable About-you pop-up.
//
// Extracts the SHIPPED functions and constants from dashboard.html and runs them
// against small stubs, the technique scripts/test-onb2-writefail.mjs uses, so what
// is tested is what ships. Every write the code attempts is recorded by the stub.
//
// WHAT THIS PINS, by change:
//   1  opens only when about_you_status is null AND no earlier gate is open; skip and
//      close write 'skipped'; finishing writes 'completed'; a completed status is never
//      downgraded by a later close; never reopens on the next boot or after an upload;
//      no dob screen; the resume chip never shows.
//
//   node scripts/test-about-you.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log("  ok   " + name); }
                            else { fail++; console.log("  FAIL " + name); } };

/** `function NAME(` or `async function NAME(`, brace matched. Throws when absent. */
function extract(name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found: " + name);
  let i = HTML.indexOf("{", m.index), depth = 0;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) return HTML.slice(m.index, j + 1); }
  }
  throw new Error("unbalanced: " + name);
}
/** `const NAME = <literal>;` with bracket matching over [], {} and (). */
function extractConst(name) {
  const at = HTML.indexOf("const " + name + " =");
  if (at < 0) throw new Error("const not found: " + name);
  let depth = 0, inStr = null;
  for (let j = HTML.indexOf("=", at) + 1; j < HTML.length; j++) {
    const ch = HTML[j];
    if (inStr) { if (ch === "\\") { j++; continue; } if (ch === inStr) inStr = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inStr = ch; continue; }
    if ("[{(".includes(ch)) depth++;
    else if ("]})".includes(ch)) depth--;
    else if (ch === ";" && depth === 0) return HTML.slice(at, j + 1);
  }
  throw new Error("unterminated const: " + name);
}
function run(src, ctx, ret) {
  const names = Object.keys(ctx);
  return new Function(...names, src + "\n; return " + ret + ";")(...names.map((n) => ctx[n]));
}
/** A class list that behaves, so show/hidden assertions measure something. */
function el(initial = []) {
  const set = new Set(initial);
  return { classList: { add: (c) => set.add(c), remove: (c) => set.delete(c),
                        contains: (c) => set.has(c), toggle: (c, on) => (on === undefined ? (set.has(c) ? set.delete(c) : set.add(c)) : on ? set.add(c) : set.delete(c)) },
           setAttribute() {}, textContent: "", _set: set };
}

// ── fixtures ────────────────────────────────────────────────────────────────
const COPY_SRC = extractConst("ONB2_COPY");
const SCREENS_SRC = extractConst("ONB2_SCREENS");
const SCREENS = run(COPY_SRC + "\n" + SCREENS_SRC, {}, "ONB2_SCREENS");
const COPY = run(COPY_SRC, {}, "ONB2_COPY");

// ── CHANGE 1: once only, skippable ─────────────────────────────────────────
t("C1-FLAG: ONBOARDING_ENABLED is true", /\nconst ONBOARDING_ENABLED = true;/.test(HTML));
t("C1-INTRO: the first screen's intro is the approved copy",
  COPY.intro === "A few things about you, so we can read your results in the context of your life. About two minutes, and you can skip anything.");
t("C1-SKIPCOPY: every screen's skip control reads Skip for now", COPY.skip === "Skip for now");
{
  const card = extract("onb2CardHtml");
  t("C1-SKIPBTN: the card renders the skip control from ONB2_COPY.skip on every screen",
    card.includes('class="onb2-skip">\' + onb2Esc(ONB2_COPY.skip)'));
}
t("C1-NODOB: the dob screen is absent from the flow", SCREENS.length > 0 && !SCREENS.some((s) => s.id === "dob" || s.key === "dob"));
t("C1-NODOB control: the flow has screens to search", SCREENS.some((s) => s.id === "preg"));

// onb2Open against stubs
const OPEN_SRC = [extract("onb2GatesClear"), extract("onb2Open")].join("\n");
async function openWith({ status, fresh, dobGate = false, tester = false, age = false, consented = true, force = false }) {
  const modal = el(), track = el(), tg = el(tester ? [] : ["hidden"]), am = el(age ? ["show"] : []);
  const log = { reads: 0, built: false };
  const ctx = {
    ONBOARDING_ENABLED: true, CONSENTED: consented, DOB_GATE_OPEN: dobGate,
    PROFILE: { about_you_status: status },
    USER: { id: "00000000-0000-4000-8000-00000000a001" },
    ONB2_SCREENS: SCREENS, ONB2_STORED_COLS: "about_you_status",
    onb2: { idx: 0, ans: {}, stored: {}, open: false, cards: [], hist: [], firstIdx: 0 },
    onb2Prefill: () => ({}), onb2BuildTrack: () => { log.built = true; },
    requestAnimationFrame: () => {},
    document: { getElementById: (id) => ({ "onb2-modal": modal, "onb2-track": track, "tester-gate": tg, "age-modal": am })[id] || null },
    sb: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      log.reads++; return { data: { about_you_status: fresh === undefined ? status : fresh }, error: null };
    } }) }) }) },
  };
  const open = run(OPEN_SRC, ctx, "onb2Open");
  await open(force ? { force: true } : undefined);
  return { shown: modal.classList.contains("show"), open: ctx.onb2.open, log, cards: ctx.onb2.cards };
}
{
  const a = await openWith({ status: null });
  t("C1-OPEN-1: opens when about_you_status is null and no gate is open", a.shown && a.open);
  t("C1-OPEN-1b: the track it opens holds no dob card", a.cards.length > 0 && !a.cards.some((s) => s.id === "dob"));
  t("C1-OPEN-2: does not open when status is skipped",   !(await openWith({ status: "skipped" })).shown);
  t("C1-OPEN-3: does not open when status is completed", !(await openWith({ status: "completed" })).shown);
  t("C1-OPEN-4: a fresh read showing completed (another device) keeps it closed",
    !(await openWith({ status: null, fresh: "completed" })).shown);
  t("C1-GATE-DOB: does not open while the DOB gate is open", !(await openWith({ status: null, dobGate: true })).shown);
  t("C1-GATE-TESTER: does not open while the tester agreement shows", !(await openWith({ status: null, tester: true })).shown);
  t("C1-GATE-AGE: does not open while the age affirmation shows", !(await openWith({ status: null, age: true })).shown);
  t("C1-GATE-CONSENT: does not open without consent", !(await openWith({ status: null, consented: false })).shown);
  t("C1-FORCE-1: force opens despite a skipped status", (await openWith({ status: "skipped", force: true })).shown);
  t("C1-FORCE-2: force never overrides a gate", !(await openWith({ status: "skipped", force: true, dobGate: true })).shown);
}
// A click handler passes an Event. It must not count as force.
{
  const src = extract("onb2Open");
  t("C1-FORCE-3: force is an explicit { force: true }, never a truthy argument such as a click event",
    /opts\.force === true/.test(src));
}

// onb2Dismiss: skip and close
const DISMISS_SRC = extract("onb2Dismiss");
async function dismissWith({ stored, profile, writeOk = true }) {
  const writes = []; let closed = 0;
  const ctx = {
    onb2: { open: true, stored: stored || {} },
    PROFILE: profile || {},
    onb2Write: async (p) => { writes.push(p); return writeOk; },
    onb2Close: () => { closed++; },
    console: { error() {} },
  };
  await run(DISMISS_SRC, ctx, "onb2Dismiss")();
  return { writes, closed };
}
{
  const a = await dismissWith({ stored: { about_you_status: null } });
  t("C1-SKIP-1: skip or close writes about_you_status skipped", a.writes.length === 1 && a.writes[0].about_you_status === "skipped");
  t("C1-SKIP-2: with a timestamp and nothing else",
    Object.keys(a.writes[0] || {}).sort().join(",") === "about_you_at,about_you_status" && !isNaN(Date.parse(a.writes[0].about_you_at)));
  t("C1-SKIP-3: and closes", a.closed === 1);
  const b = await dismissWith({ stored: { about_you_status: "completed" } });
  t("C1-SKIP-4: a completed status is never downgraded by a later close", b.writes.length === 0 && b.closed === 1);
  const c = await dismissWith({ stored: {}, writeOk: false });
  t("C1-SKIP-5: a refused skipped write still closes, so the pop-up never traps her", c.closed === 1);
}
{
  const wire = extract("onb2WireCard");
  t("C1-WIRE-1: Skip for now is wired to dismiss", /\.onb2-skip"\); if\(sk\) sk\.onclick = onb2Dismiss;/.test(wire));
  t("C1-WIRE-2: the close control is wired to dismiss", /\.onb2-x"\); if\(cx\) cx\.onclick = onb2Dismiss;/.test(wire));
}
// finishing writes completed (the gate itself is pinned in test-onb2-writefail.mjs)
{
  const fin = extract("onb2Finish");
  t("C1-FINISH: finishing writes about_you_status completed with a timestamp",
    /onb2Write\(\{ about_you_status: "completed", about_you_at: new Date\(\)\.toISOString\(\) \}\)/.test(fin));
}
// never reopens after an upload: handleFile no longer calls onb2Open
{
  const hf = extract("handleFile");
  t("C1-UPLOAD: handleFile never calls onb2Open", hf.length > 1000 && !/onb2Open\s*\(/.test(hf));
  t("C1-UPLOAD control: the extracted handleFile is the real one", /pollForResult\(reportId\)/.test(hf));
}
// never reopens on the next boot: PROFILE.about_you_status comes from the boot read
t("C1-BOOT: loadProfile reads about_you_status, which is what keeps the next boot closed",
  /async function loadProfile\(\)[\s\S]{0,600}about_you_status"\)\.eq\("id", USER\.id\)/.test(HTML));
// the resume chip never shows
{
  const chipEl = el([]);
  const ctx = { document: { getElementById: () => chipEl }, ONBOARDING_ENABLED: true, CONSENTED: true };
  await run(extract("onb2ResumeChip"), ctx, "onb2ResumeChip")();
  t("C1-CHIP: onb2ResumeChip only ever hides the chip", chipEl.classList.contains("hidden"));
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
