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

// ── CHANGE 2: the screens ───────────────────────────────────────────────────
// A small DOM stand-in, enough for the markup onb2CardHtml emits: nested elements
// with attributes and classes, and querySelector/All over compound selectors
// (.cls, [attr], [attr="v"]) with the descendant combinator. Real enough that the
// SHIPPED onb2WireCard binds to it exactly as it does in a browser.
const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function parseHTML(html) {
  const root = mkNode("root", {}); let cur = root;
  const VOID = new Set(["input", "br", "img"]);
  const re = /<(\/?)([a-zA-Z0-9]+)((?:\s+[a-zA-Z0-9-]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) { cur.text += decode(m[5]); continue; }
    const [, close, tag, attrStr] = m;
    if (close) { if (cur.parent) cur = cur.parent; continue; }
    const attrs = {}; const ar = /([a-zA-Z0-9-]+)(?:="([^"]*)")?/g; let a;
    while ((a = ar.exec(attrStr))) attrs[a[1]] = a[2] === undefined ? "" : decode(a[2]);
    const n = mkNode(tag.toLowerCase(), attrs); n.parent = cur; cur.children.push(n);
    if (!VOID.has(n.tag) && !m[4]) cur = n;
  }
  return root;
}
function mkNode(tag, attrs) {
  const cls = new Set((attrs.class || "").split(/\s+/).filter(Boolean));
  const n = { tag, attrs, children: [], parent: null, text: "", value: attrs.value || "",
    classList: { contains: (c) => cls.has(c), add: (c) => cls.add(c), remove: (c) => cls.delete(c) },
    getAttribute: (k) => (k in attrs ? attrs[k] : null), focus() {},
    querySelectorAll: (sel) => qsa(n, sel), querySelector: (sel) => qsa(n, sel)[0] || null };
  return n;
}
function matchSimple(n, s) {
  const parts = s.match(/(^[a-z0-9]+)|\.[a-zA-Z0-9_-]+|\[[^\]]+\]/g) || [];
  return parts.every((p) => {
    if (p[0] === ".") return n.classList.contains(p.slice(1));
    if (p[0] === "[") { const mm = p.slice(1, -1).match(/^([^=]+)(?:="(.*)")?$/);
      return mm[2] === undefined ? mm[1] in n.attrs : n.attrs[mm[1]] === mm[2]; }
    return n.tag === p;
  });
}
function qsa(root, sel) {
  const steps = sel.trim().match(/(?:[^\s"\[]+|\[[^\]]*\])+/g);
  const all = []; (function walk(x) { for (const c of x.children) { all.push(c); walk(c); } })(root);
  return all.filter((n) => {
    if (!matchSimple(n, steps[steps.length - 1])) return false;
    let i = steps.length - 2, p = n.parent;
    while (i >= 0 && p && p !== root.parent) { if (matchSimple(p, steps[i])) i--; p = p.parent; }
    return i < 0;
  });
}
const click = (b) => { if (!b || !b.onclick) throw new Error("no handler bound"); return b.onclick(); };

// The shipped screen machinery, run together.
const CARD_SRC = [extractConst("ONB2_AMEN_REASONS"), extractConst("ONB2_ADD_MAX"),
  extract("onb2Esc"), extract("onb2BuildOrder"), extract("onb2InPath"), extract("onb2Count"),
  extract("onb2CardHtml"), extract("onb2WireCard"), extract("onb2Patch"), extract("onb2Int"),
  extract("onb2CleanEntry"), extract("onb2GroupValue"), extract("onb2FindGroup"), extract("onb2SideWrites"),
  extract("onb2Prefill"), extract("deriveMenstrualFrom"), extract("onb2DeriveMenstrual")].join("\n");
function screenHarness(ans = {}) {
  const log = { rpc: [] };
  const onb2 = { idx: 0, ans, stored: {}, open: true, cards: SCREENS.slice(), hist: [], firstIdx: 0, order: [] };
  const holder = { el: null };
  const ctx = {
    ONB2_COPY: COPY, ONB2_SCREENS: SCREENS, onb2, PROFILE: {}, USER: { id: "u" },
    onb2Ack: () => {}, onb2Seeds: () => {}, onb2Advance: () => {}, onb2Dismiss: () => {}, onb2GoBack: () => {},
    onb2Recard: (k) => render(k),
    document: { querySelector: () => null },
    sb: { rpc: async (name, args) => { log.rpc.push({ name, args }); return { error: null }; } },
  };
  const api = run(CARD_SRC, ctx,
    "{ onb2CardHtml, onb2WireCard, onb2Patch, onb2SideWrites, onb2Prefill, onb2InPath, onb2GroupValue }");
  function render(k) {
    holder.el = parseHTML(api.onb2CardHtml(onb2.cards[k], k));
    api.onb2WireCard(holder.el, onb2.cards[k], k);
    return holder.el;
  }
  const idxOf = (id) => onb2.cards.findIndex((s) => s.id === id);
  return { api, onb2, log, ctx, idxOf, open: (id) => render(idxOf(id)), el: () => holder.el,
           patch: (id) => api.onb2Patch(onb2.cards[idxOf(id)]) };
}
const chip = (el, groupKey, label) =>
  qsa(el, '[data-group="' + groupKey + '"] .onb2-chip').find((b) => b.text.trim() === label);
const own = (el, groupKey) => qsa(el, '[data-group="' + groupKey + '"] .onb2-own').map((b) => b.text.replace(/\s*×\s*$/, "").trim());
const typeAndAdd = (el, key, text) => {
  const inp = el.querySelector('[data-add="' + key + '"]'); inp.value = text; inp.oninput && inp.oninput();
  click(el.querySelector('[data-addbtn="' + key + '"]'));
};

t("C2-ORDER: screens in order preg, life, cyc, hbc (or its postmenopause form), diet, cond, meds",
  SCREENS.map((s) => s.id).join(",") === "preg,life,cyc,hbc,hbc-ht,diet,cond,meds");
t("C2-NOGOAL: the goal screen is gone", !SCREENS.some((s) => s.id === "goal" || s.key === "health_goals"));
{
  const cond = SCREENS.find((s) => s.id === "cond"), meds = SCREENS.find((s) => s.id === "meds");
  const labels = (g) => g.opts.map((o) => o[0]).join("|");
  t("C2-COND-OPTS: conditions chips as specified",
    labels(cond.groups[0]) === "Thyroid condition|PCOS|Anemia or low iron|Diabetes or prediabetes|High blood pressure|High cholesterol|None of these" &&
    cond.groups[0].key === "known_conditions");
  t("C2-SYMP-OPTS: symptoms chips as specified",
    labels(cond.groups[1]) === "Fatigue or low energy|Poor sleep|Hair loss|Brain fog|Low mood or anxiety|Mood swings|Bloating|Heavy periods|None of these" &&
    cond.groups[1].key === "symptoms");
  t("C2-MEDS-OPTS: medicines chips, label and helper as specified",
    labels(meds.groups[0]) === "Thyroid medicine|Metformin or diabetes medicine|Blood pressure medicine|Cholesterol medicine|Acid reflux medicine|Antidepressant or anxiety medicine|Steroids|None of these" &&
    meds.groups[0].key === "medications" && meds.groups[0].label === "Medicines you take regularly" &&
    meds.groups[0].help === "The type of medicine is enough.");
  t("C2-SUPP-OPTS: supplements chips as specified, stored with the draw card's tokens",
    labels(meds.groups[1]) === "Iron|Vitamin B12|Folate|Vitamin D|Omega 3|Multivitamin|Probiotic|Biotin|None of these" &&
    meds.groups[1].opts.map((o) => o[1]).join("|") === "iron|b12|folate|vitamin_d|omega3|multivitamin|probiotic|biotin|none of these" &&
    meds.groups[1].label === "Supplements you take");
  // The tokens are the ones the draw card's BC_SUPPLEMENTS already stored.
  const bc = run(extractConst("BC_SUPPLEMENTS"), {}, "BC_SUPPLEMENTS").map((s) => s.v);
  t("C2-SUPP-TOKENS: every supplements token already existed in BC_SUPPLEMENTS",
    meds.groups[1].opts.every((o) => bc.indexOf(o[1]) >= 0));
}
// amenorrhea sub-question
{
  const h = screenHarness({});
  let el = h.open("cyc");
  t("C2-AMEN-1: the reason question is absent before a cycle answer", !el.querySelector(".onb2-reason"));
  t("C2-AMEN-1 control: the cycle options rendered", qsa(el, ".onb2-opt[data-i]").length === 5);
  click(qsa(el, ".onb2-opt[data-i]").find((b) => b.text === "I don't get periods right now"));
  el = h.el();
  const rs = qsa(el, ".onb2-reason").map((b) => b.text);
  t("C2-AMEN-2: \"I don't get periods right now\" reveals Is there a reason you know of?",
    rs.join("|") === "Hormonal contraception|Breastfeeding|A medical reason or treatment|Not sure" &&
    /Is there a reason you know of\?/.test(qsa(el, ".onb2-sub").map((x) => x.text).join(" ")));
  click(qsa(el, ".onb2-reason").find((b) => b.text === "Breastfeeding"));
  const p = h.patch("cyc");
  t("C2-AMEN-3: it writes amenorrhea_reason with the draw card's token", p.cycle_status === "amenorrheic" && p.amenorrhea_reason === "breastfeeding");
  click(qsa(h.el(), ".onb2-opt[data-i]").find((b) => b.text === "Regular"));
  t("C2-AMEN-4: the reason disappears for any other answer", !h.el().querySelector(".onb2-reason"));
  t("C2-AMEN-5: and any other answer clears amenorrhea_reason", h.patch("cyc").amenorrhea_reason === null);
}
// postmenopause: hormone therapy, never contraception
{
  const h = screenHarness({ life_stage: "postmenopause" });
  const hbc = SCREENS.find((s) => s.id === "hbc"), ht = SCREENS.find((s) => s.id === "hbc-ht");
  t("C2-HT-1: after menopause the hbc screen is replaced by the hormone therapy question",
    !h.api.onb2InPath(hbc) && h.api.onb2InPath(ht) && ht.q === "Are you using hormone therapy right now?");
  const el = h.open("hbc-ht");
  t("C2-HT-2: Yes, No, Not sure", qsa(el, ".onb2-opt[data-i]").map((b) => b.text).join("|") === "Yes|No|Not sure");
  click(qsa(el, ".onb2-opt[data-i]").find((b) => b.text === "Not sure"));
  const p = h.patch("hbc-ht");
  t("C2-HT-3: writes hormone_therapy_status not_sure and no contraception column",
    p.hormone_therapy_status === "not_sure" && Object.keys(p).join(",") === "hormone_therapy_status");
  const pre = screenHarness({ life_stage: "premenopause" });
  t("C2-HT-4: before menopause the contraception screen stays", pre.api.onb2InPath(hbc) && !pre.api.onb2InPath(ht));
  const preg = screenHarness({ life_stage: "postmenopause", preg: true });
  t("C2-HT-5: the pregnancy branch keeps the contraception screen", preg.api.onb2InPath(hbc) && !preg.api.onb2InPath(ht));
}
t("C2-DIET: diet no longer carries the B12 or folate sub-question",
  !("supps" in SCREENS.find((s) => s.id === "diet")) && screenHarness({ vegetarian_status: "Vegan" }).patch("diet").supp_b12 === undefined);
// each chip group: None exclusive, Add your own appended
for (const [screen, key, none, a, b] of [
  ["cond", "known_conditions", "None of these", "PCOS", "High cholesterol"],
  ["cond", "symptoms", "None of these", "Poor sleep", "Heavy periods"],
  ["meds", "medications", "None of these", "Steroids", "Thyroid medicine"],
  ["meds", "supplements", "None of these", "Iron", "Vitamin D"],
]) {
  const h = screenHarness({});
  let el = h.open(screen);
  click(chip(el, key, a)); click(chip(h.el(), key, b));
  t(`C2-${key}-1: chips are multi-select`, chip(h.el(), key, a).classList.contains("sel") && chip(h.el(), key, b).classList.contains("sel"));
  typeAndAdd(h.el(), key, "   something she typed   ");
  t(`C2-${key}-2: Add your own appends her entry, trimmed`, own(h.el(), key).join("|") === "something she typed");
  click(chip(h.el(), key, "None of these"));
  t(`C2-${key}-3: None of these clears every other chip and entry`,
    chip(h.el(), key, "None of these").classList.contains("sel") && !chip(h.el(), key, a).classList.contains("sel") &&
    own(h.el(), key).length === 0);
  click(chip(h.el(), key, a));
  t(`C2-${key}-4: choosing another chip clears None of these`,
    !chip(h.el(), key, "None of these").classList.contains("sel") && chip(h.el(), key, a).classList.contains("sel"));
  click(chip(h.el(), key, "None of these")); typeAndAdd(h.el(), key, "mine");
  t(`C2-${key}-5: adding an entry clears None of these`,
    !chip(h.el(), key, "None of these").classList.contains("sel") && own(h.el(), key).join("|") === "mine");
  typeAndAdd(h.el(), key, "x".repeat(260));
  t(`C2-${key}-6: an entry is capped at 200 characters`, own(h.el(), key).some((s) => s.length === 200) && !own(h.el(), key).some((s) => s.length > 200));
  const inp = h.el().querySelector('[data-add="' + key + '"]');
  t(`C2-${key}-7: the Add your own box is a text input with a 200 limit`, inp && inp.attrs.type === "text" && inp.attrs.maxlength === "200");
}
t("C2-16PX: the Add your own input is 16px", /\.onb2-add-in\{[^}]*font-size:16px/.test(HTML));
// what each screen writes
{
  const h = screenHarness({});
  h.open("cond");
  click(chip(h.el(), "known_conditions", "High blood pressure")); typeAndAdd(h.el(), "known_conditions", "Endometriosis");
  const p = h.patch("cond");
  t("C2-COND-W: conditions write the chip label and her entry, and untouched symptoms write nothing",
    JSON.stringify(p.known_conditions) === '["High blood pressure","Endometriosis"]' && !("symptoms" in p));
}
{
  const h = screenHarness({});
  h.open("meds");
  click(chip(h.el(), "supplements", "Vitamin B12")); click(chip(h.el(), "supplements", "Biotin"));
  const p = h.patch("meds");
  t("C2-SUPP-1: a chosen B12 is true and an unchosen folate is false, with a stamp",
    p.supp_b12 === true && p.supp_folate === false && !isNaN(Date.parse(p.supp_status_updated_at)));
  t("C2-SUPP-2: Biotin never enters supplements[]", JSON.stringify(p.supplements) === '["b12"]');
  await h.api.onb2SideWrites(SCREENS.find((s) => s.id === "meds"));
  t("C2-BIOTIN-1: Biotin goes to set_confounder biotin_supplementation true",
    h.log.rpc.length === 1 && h.log.rpc[0].name === "set_confounder" &&
    h.log.rpc[0].args.p_key === "biotin_supplementation" && h.log.rpc[0].args.p_value === true);
  const h2 = screenHarness({}); h2.open("meds");
  click(chip(h2.el(), "supplements", "Folate"));
  await h2.api.onb2SideWrites(SCREENS.find((s) => s.id === "meds"));
  const p2 = h2.patch("meds");
  t("C2-BIOTIN-2: an answered group without Biotin writes it false", h2.log.rpc[0] && h2.log.rpc[0].args.p_value === false);
  t("C2-SUPP-3: folate chosen, B12 not", p2.supp_folate === true && p2.supp_b12 === false);
  const h3 = screenHarness({}); h3.open("meds");
  click(chip(h3.el(), "supplements", "None of these"));
  await h3.api.onb2SideWrites(SCREENS.find((s) => s.id === "meds"));
  const p3 = h3.patch("meds");
  t("C2-SUPP-4: None of these makes B12, folate and Biotin false",
    p3.supp_b12 === false && p3.supp_folate === false && h3.log.rpc[0].args.p_value === false &&
    JSON.stringify(p3.supplements) === '["none of these"]');
}
{
  const h = screenHarness({});
  h.open("meds");
  const inp = h.el().querySelector('[data-add="medications"]'); inp.value = "  an inhaler "; inp.oninput();
  const p = h.patch("meds");
  t("C2-DRAFT: text left in Add your own without pressing Add is still saved", JSON.stringify(p.medications) === '["an inhaler"]');
}
{
  const h = screenHarness({ context_note: "  she wrote this " });
  t("C2-NOTE: the last field writes context_note, trimmed", h.patch("meds").context_note === "she wrote this");
  t("C2-NOTE-2: the meds screen's last field is the keep-in-mind box",
    /Anything else you want us to keep in mind/.test(qsa(h.open("meds"), ".onb2-sub").map((x) => x.text).join(" ")));
}
// an empty screen writes nothing
for (const id of ["preg", "life", "cyc", "hbc", "hbc-ht", "diet", "cond", "meds"]) {
  const h = screenHarness({});
  t(`C2-EMPTY-${id}: an untouched screen writes nothing`, Object.keys(h.patch(id)).length === 0);
}
{
  const h = screenHarness({});
  await h.api.onb2SideWrites(SCREENS.find((s) => s.id === "meds"));
  t("C2-EMPTY-rpc: an untouched meds screen sends no set_confounder", h.log.rpc.length === 0);
}
// prefill from stored values
{
  const h = screenHarness({});
  const a = h.api.onb2Prefill({
    pregnant_or_postpartum_within_6_months: false, life_stage: "perimenopause", cycle_status: "amenorrheic",
    amenorrhea_reason: "medical", typical_cycle_length_days: 30, typical_period_duration_days: 6,
    hormonal_contraception: "ceased_within_12_months", hormonal_contraception_ceased_at: "2026-03-01",
    hormone_therapy_status: "no", vegetarian_status: "Vegan", known_conditions: ["PCOS", "typed one"],
    symptoms: ["None of these"], medications: ["Steroids"], supplements: ["iron", "b12"],
    confounders: { biotin_supplementation: true }, context_note: "a note" });
  t("C2-PREFILL-1: single-choice screens prefill",
    a.preg === false && a.life_stage === "perimenopause" && a.cycle_status === "amenorrheic" && a.amen_reason === "medical" &&
    a.cycle_len === "30" && a.period_dur === "6" && a.hormonal_contraception === "ceased_within_12_months" &&
    a.ceased_ym === "2026-03" && a.hormone_therapy_status === "no" && a.vegetarian_status === "Vegan");
  t("C2-PREFILL-2: chip groups prefill, typed entries included, Biotin from confounders",
    JSON.stringify(a.known_conditions) === '["PCOS","typed one"]' && JSON.stringify(a.symptoms) === '["None of these"]' &&
    JSON.stringify(a.medications) === '["Steroids"]' && JSON.stringify(a.supplements) === '["iron","b12","biotin"]' &&
    a.context_note === "a note");
  const h2 = screenHarness(a);
  const el = h2.open("cond");
  t("C2-PREFILL-3: a prefilled screen renders what she told us",
    chip(el, "known_conditions", "PCOS").classList.contains("sel") && own(el, "known_conditions").join("|") === "typed one");
  t("C2-PREFILL-4: nothing stored prefills nothing", Object.keys(h.api.onb2Prefill({})).length === 0);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
