#!/usr/bin/env node
// SCORE_POPOVER_V1 -- the coverage explanation moved out of the hero and into the
// "What's this?" popover on 2026-09-23. These pin the SHIPPED functions, extracted from
// dashboard.html, plus the rendered popover in a real browser.
//
// TWO AXES, AND THE WHOLE POINT IS THAT THEY ARE SEPARATE. A HELD PILL is one of the seven
// groups the composite is built from. A DEFERRED SYSTEM is one of the engine's twenty-two,
// held back from marker-level scoring. Measured on both stored non-keeper payloads, all seven
// pills scored while sex_hormones was deferred, so a single sentence welding the two together
// would have said "counts 7 of 7 systems" and then named one as left out. Each fixture below
// exercises one axis alone, and the third exercises neither.
//
// Every fixture is SYNTHETIC. No stored payload, no name, no lab value.
//
//   node scripts/test-score-popover.mjs
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9700 + Math.floor(Math.random() * 200);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };

// ── the shipped functions, extracted ─────────────────────────────────────────
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
// A one-line `const NAME = ...;` declaration, asserted to be one line rather than assumed.
function extractConstLine(name) {
  const re = new RegExp("^const\\s+" + name + "\\s*=.*;\\s*$", "m");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a one-line const in " + FILE + ": " + name);
  return m[0];
}
// A `const NAME = [ ... ];` array block.
function extractConstArray(name) {
  const re = new RegExp("^const\\s+" + name + "\\s*=\\s*\\[", "m");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a const array in " + FILE + ": " + name);
  let i = HTML.indexOf("[", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "[") depth++;
    else if (HTML[j] === "]") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  if (end < 0) throw new Error("unbalanced brackets: " + name);
  return HTML.slice(m.index, end) + ";";
}
function extractConstBlock(name) {
  const re = new RegExp("^const\\s+" + name + "\\s*=\\s*\\{", "m");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found as a const object in " + FILE + ": " + name);
  let i = HTML.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  return HTML.slice(m.index, end + 1);
}
const SRC = [
  // confounderAnswered reads PER_DRAW_CONFOUNDER_KEYS, which is derived from BC_CONFOUNDERS.
  // Both are EXTRACTED rather than retyped, so a key added to the app reaches this test with
  // no edit here and a hand-copied list cannot drift out of step with the page.
  extractConstArray("BC_CONFOUNDERS"), extractConstLine("PER_DRAW_CONFOUNDER_KEYS"),
  extract("isSuppressed"), extract("capitalise"), extract("confounderAnswered"),
  extractConstBlock("REPORT_DEFER_REASON"), extract("deferReasonIsSentence"),
  extractConstBlock("REPORT_SYS_NAME_FALLBACK"),
  extract("reportSysName"), extract("reportJoinNames"),
  extract("coverageSentence"), extract("deferralSentences"),
  "return { cov: coverageSentence, def: deferralSentences, REASON: REPORT_DEFER_REASON };"
].join("\n");
let api = null;
try { api = new Function("PROFILE", "window", SRC)({ confounders: {} }, { __rdReportConf: {} }); }
catch (e) { console.log("  FAIL SP-0: the shipped functions did not load (" + e.message + ")"); fail++; done(1); }
const { cov, def, REASON } = api;

// ── fixtures ─────────────────────────────────────────────────────────────────
const pill = (score) => ({ score, refusal_reason: null });
// TWO HELD PILLS, no deferral. Exercises line a alone.
const HELD = { vitality: { display: { mode: "normal", show_composite: true },
  deferred: [], deferred_reasons: { thyroid: "fasting_unknown" },
  pills: { "Energy & Blood": pill(80), "Heart & Metabolism": pill(70), "Hormones": pill(75),
           "Inflammation & Immunity": pill(60), "Liver, Kidney & Detox": pill(null),
           "Thyroid": pill(null), "Vitamins & Minerals": pill(55) } },
  systems: [] };
// A DEFERRED SYSTEM, zero held pills. Exercises line b alone.
const DEFERRED = { vitality: { display: { mode: "normal", show_composite: true },
  deferred: ["sex_hormones"], deferred_reasons: { sex_hormones: "cycle_day_unknown" },
  pills: { "Energy & Blood": pill(80), "Heart & Metabolism": pill(70), "Hormones": pill(75),
           "Inflammation & Immunity": pill(60), "Liver, Kidney & Detox": pill(65),
           "Thyroid": pill(72), "Vitamins & Minerals": pill(55) } },
  systems: [{ system_id: "sex_hormones", display_name: "Sex hormones", markers: [] }] };
// NEITHER.
const CLEAN = { vitality: { display: { mode: "normal", show_composite: true },
  deferred: [], deferred_reasons: {},
  pills: { "Energy & Blood": pill(80), "Heart & Metabolism": pill(70), "Hormones": pill(75),
           "Inflammation & Immunity": pill(60), "Liver, Kidney & Detox": pill(65),
           "Thyroid": pill(72), "Vitamins & Minerals": pill(55) } },
  systems: [] };

console.log("SCORE POPOVER -- the two axes, each on its own");
{
  const a = cov(HELD), b = def(HELD);
  ok(a.indexOf("Based on 5 of the 7 systems behind your vitality score.") === 0,
     "SP-1: two held pills produce the coverage sentence, counts intact  (" + JSON.stringify(a) + ")");
  ok(/is waiting on one answer\.$/.test(a),
     "SP-2: and its fasting tail moved unchanged with it");
  eq(b.length, 0, "SP-3: with nothing deferred there is no second line");
}
{
  const a = cov(DEFERRED), b = def(DEFERRED);
  eq(a, "", "SP-4: zero held pills produce NO coverage sentence, even with a deferral");
  eq(b.length, 1, "SP-5: the deferred system produces exactly one line");
  eq(b[0], "Sex hormones were not counted toward this score. Hormone results are held until phase-specific ranges have been reviewed.",
     "SP-6: and it carries the founder-approved reason verbatim");
  ok(b[0].indexOf("7 of 7") === -1 && b[0].indexOf("counts") === -1,
     "SP-7: it never states a system count, which is the contradiction this split exists to avoid");
}
{
  const a = cov(CLEAN), b = def(CLEAN);
  eq(a, "", "SP-8: neither axis, no coverage sentence");
  eq(b.length, 0, "SP-9: neither axis, no deferral line");
}
// CONTROLS. Without these every "" above could be a function that returns "" for everything.
ok(cov(HELD) !== "", "SP-10 CONTROL: coverageSentence CAN return a sentence, so SP-4 and SP-8 mean something");
ok(def(DEFERRED).length > 0, "SP-11 CONTROL: deferralSentences CAN return a line, so SP-3 and SP-9 mean something");

console.log("REASON TABLE -- one sentence, one home");
{
  eq(REASON.cycle_day_unknown, "Hormone results are held until phase-specific ranges have been reviewed.",
     "SP-12: the table carries the approved sentence");
  const app = extractApp(HTML);
  eq((app.match(/a single draw needs the day of your cycle to read these correctly/g) || []).length, 0,
     "SP-13: the OLD cycle-day phrase is gone from the app block");
  ok((app.match(/Hormone results are held until phase-specific ranges have been reviewed/g) || []).length >= 1,
     "SP-14 CONTROL: the NEW one is present, so SP-13 is not passing on an empty scan");
  ok((app.match(/these read best from a fasting draw/g) || []).length >= 1,
     "SP-15 CONTROL: the fasting reasons are untouched, so SP-13 did not empty the table");
}

// ── the browser half. The hero line, the popover order, and the mutant. ──────
const STUB = `<script>
window.__errs=[];addEventListener("error",e=>window.__errs.push(String(e.message)));
const one={data:{full_name:"Synthetic Tester",dob:"1990-01-01",consent_accepted_at:"2026-01-01T00:00:00Z",age_affirmed_at:"2026-01-01T00:00:00Z",confounders:{}},error:null};
const chain=()=>{const c={};for(const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"])c[k]=()=>c;
c.maybeSingle=async()=>one;c.single=async()=>one;c.then=(f)=>Promise.resolve({data:[],error:null}).then(f);return c;};
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:"t",user:{id:"00000000-0000-4000-8000-000000000001",email:"harness@example.com"}}}}),getUser:async()=>({data:{user:{id:"00000000-0000-4000-8000-000000000001"}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},from:()=>chain(),functions:{invoke:async()=>({data:null,error:null})},storage:{from:()=>({createSignedUrl:async()=>({data:null}),upload:async()=>({data:null,error:null})})},rpc:async()=>one})};
<\/script>`;
const PAY = (v) => Object.assign({ panel_date: "2026-08-05", priorities: [], quietly_working: [],
  coverage_gap: null, systems: v.systems || [] }, { vitality: v.vitality });
const driver = (p) => `<script>
(async()=>{await new Promise(r=>setTimeout(r,800));const res={threw:false};
try{window.__rdSeries={};window.__allReports=[{id:"r1",collected_on:"2026-08-05"}];window.__doneReportIds=new Set(["r1"]);
await window.renderDashboard(${JSON.stringify(p)},"r1");window.showView("dashboard");}
catch(err){res.threw=true;res.name=err.name;res.message=err.message;}
const q=s=>document.querySelector(s);
const cl=q("#coverage-line"), pop=q("#score-info-pop");
res.heroHidden=cl?cl.classList.contains("hidden"):null;
res.heroText=cl?cl.textContent.trim():null;
res.heroPaints=cl?(getComputedStyle(cl).display!=="none"&&cl.getBoundingClientRect().height>0):null;
res.blocks=(pop?pop.textContent:"").split("\\n\\n").map(x=>x.trim()).filter(Boolean);
res.ws=pop?getComputedStyle(pop).whiteSpace:null;
res.errs=window.__errs;window.__result=res;window.__done=true;})();
<\/script>`;

if (!existsSync(CHROME)) { console.log("  FAIL SP-16: Chrome is not at " + CHROME); fail++; done(1); }

// THE MUTANT. Valid JS: the hero clear is replaced with a write, restoring the retired line.
const HERO_CLEAR = '    const covEl = $("coverage-line");\n    if(covEl){ covEl.textContent = ""; covEl.classList.add("hidden"); }';
const HERO_MUT   = '    const covEl = $("coverage-line");\n    if(covEl){ const t = coverageSentence(p); if(t){ covEl.textContent = t; covEl.classList.remove("hidden"); } }';
ok(HTML.indexOf(HERO_CLEAR) !== -1, "SP-16: the hero clear was LOCATED in the shipped source, so the mutant is a real change");
const mutantHtml = HTML.replace(HERO_CLEAR, HERO_MUT);
try { new Function(extractApp(mutantHtml, "the mutant")); }
catch (e) { console.log("  FAIL SP-17: the mutant is not valid JavaScript (" + e.message + ")"); fail++; done(1); }
ok(true, "SP-17: the mutant is valid JavaScript, so its red is behaviour and not syntax");

let SERVE = "";
const server = createServer((req, res) => {
  if (req.url.startsWith("/ranges-slim.json")) {
    res.writeHead(200, { "content-type": "application/json" }); res.end(readFileSync("ranges-slim.json")); return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(SERVE);
});
await new Promise(r => server.listen(PORT, r));
const profile = "/private/tmp/score-popover-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1),
  "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL SP-18: Chrome never opened a debugging port"); fail++; chrome.kill(); server.close(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
async function run(pageHtml, fixture) {
  SERVE = pageHtml.replace(CDN, STUB).replace("</body>", driver(PAY(fixture)) + "</body>");
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) return JSON.parse(v.result.value);
  }
  return null;
}

console.log("SCORE POPOVER -- in a real browser");
const rHeld = await run(HTML, HELD);
if (!rHeld) { console.log("  FAIL SP-18: the held-pill page never finished"); fail++; }
else {
  ok(!rHeld.threw, "SP-18: renderDashboard threw nothing on the held-pill fixture");
  eq(rHeld.heroText, "", "SP-19: the hero coverage line is EMPTY");
  ok(rHeld.heroHidden, "SP-20: and hidden");
  ok(!rHeld.heroPaints, "SP-21: and paints nothing");
  ok(rHeld.blocks.length >= 2 && rHeld.blocks[0].indexOf("Based on 5 of the 7 systems") === 0,
     "SP-22: the coverage sentence is the FIRST block of the popover  (" + rHeld.blocks.length + " blocks)");
  ok(rHeld.blocks[rHeld.blocks.length - 1].indexOf("This is your vitality score") === 0,
     "SP-23: and the signed explainer is still last");
  eq(rHeld.ws, "pre-line", "SP-24: the popover keeps the blank line between blocks");
}
const rDef = await run(HTML, DEFERRED);
if (rDef) {
  eq(rDef.heroText, "", "SP-25: deferral fixture also leaves the hero line empty");
  ok(rDef.blocks[0].indexOf("Sex hormones were not counted toward this score.") === 0,
     "SP-26: the deferral line leads the popover  (" + JSON.stringify(rDef.blocks[0].slice(0, 48)) + ")");
  ok(rDef.blocks[0].indexOf("Based on") === -1, "SP-27: with no held pill there is no coverage sentence above it");
}
const rClean = await run(HTML, CLEAN);
if (rClean) {
  eq(rClean.heroText, "", "SP-28: neither axis, hero still empty");
  eq(rClean.blocks.length, 1, "SP-29: neither axis, the popover is the signed explainer alone");
  ok(rClean.blocks[0].indexOf("This is your vitality score") === 0, "SP-30: and that is what it is");
}

console.log("MUTANT -- the hero line is restored");
const mHeld = await run(mutantHtml, HELD);
if (!mHeld) { console.log("  FAIL SP-31: the mutant page never finished"); fail++; }
else {
  ok(mHeld.heroText.indexOf("Based on 5 of the 7 systems") === 0,
     "SP-31: with the clear replaced the hero line RETURNS, so SP-19 can fail");
  ok(!mHeld.heroHidden, "SP-32: and it is visible again, so SP-20 can fail");
}

chrome.kill(); server.close();
done(fail ? 1 : 0);
