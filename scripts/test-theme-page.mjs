#!/usr/bin/env node
// THEME_PAGE_V1 -- "Everything else, by theme" moved out of the dashboard scroll and into its own
// overlay page on 2026-09-23, reached from a third row in the Browse everything card.
//
// WHAT IS ACTUALLY AT RISK HERE, and why every assertion is in a browser rather than a regex.
// The move is three separate things that can each break alone: a row that must exist IN ORDER
// between two others, a tap that must open the right overlay, and a block of markup that must
// still render its six cards in its new home while no longer adding to the page scroll. A source
// scan can see the first and is blind to the other two.
//
// Every fixture is SYNTHETIC apart from the marker shapes, which carry no values.
//
//   node scripts/test-theme-page.mjs
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9200 + Math.floor(Math.random() * 300);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m))
                       : (fail++, console.log("  FAIL " + m));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };

if (!existsSync(CHROME)) { console.log("  FAIL TP-0: Chrome is not at " + CHROME); fail++; done(1); }

// ── a payload with markers in four themes, so the six cards have something to count ──
const mk = (id, sys) => ({ marker_id: id, display_name: id, system_id: sys, value: 1,
  unit: "ng/mL", canonical_unit: "ng/mL", normalized_value: 1, status: "normal",
  band: "optimal", is_cycle_gated: false });
const PAY = {
  panel_date: "2026-08-05",
  vitality: { composite: 70, band: { key: "steady", label: "Steady" },
              display: { mode: "normal", show_composite: true }, deferred: [], deferred_reasons: {},
              pills: { "Energy & Blood": { score: 70 } } },
  systems: [
    { system_id: "iron_status", display_name: "Iron", status: "watch",
      markers: [mk("ferritin", "iron_status"), mk("hemoglobin", "iron_status")] },
    { system_id: "thyroid", display_name: "Thyroid", status: "normal", markers: [mk("tsh", "thyroid")] },
    { system_id: "metabolic", display_name: "Metabolic", status: "normal",
      markers: [mk("fasting_glucose", "metabolic"), mk("hba1c", "metabolic")] },
    { system_id: "liver", display_name: "Liver", status: "normal", markers: [mk("alt", "liver")] },
  ],
  priorities: [], quietly_working: [], longitudinal: null,
  // THE GAPS ROW IS GATED ON RD_GAPS_SHOWN, which renderCoverageGap only sets once it has
  // actually drawn clusters. With coverage_gap null the third row never renders and the
  // "three rows, themes in the middle" assertion below would be testing a two-row card.
  coverage_gap: { ids: ["vitamin_d"], by_system: { vitamins: ["vitamin_d"] }, direction_only: [] },
};

// ── 1. the row, at source. Order is the part a browser cannot show was INTENDED. ──
console.log("THEME PAGE -- the row exists, in order, at source");
{
  const app = extractApp(HTML);
  const i = app.indexOf('kind:"markers"'), j = app.indexOf('kind:"themes"'), k = app.indexOf('kind:"gaps"');
  ok(i > -1 && j > -1 && k > -1, "TP-1: all three row kinds are declared  (markers " + (i>-1) + ", themes " + (j>-1) + ", gaps " + (k>-1) + ")");
  ok(i < j && j < k, "TP-2: themes is declared AFTER markers and BEFORE gaps");
  ok(app.indexOf('heading:"By theme"') > -1, "TP-3: its title is By theme");
  ok(app.indexOf('sub:"Grouped by how it shows up in daily life"') > -1, "TP-4: and its subtitle");
  ok(/dataset\.kind === "themes"\)\{ openThemesView\(\); return; \}/.test(app),
     "TP-5: tapping it calls openThemesView, the same shape the other two rows use");
  // CONTROL. The two original rows are untouched, so TP-1..TP-5 are an addition and not a rewrite.
  ok(app.indexOf('heading:"What to test next"') > -1 && app.indexOf('sub:"Gaps worth exploring"') > -1,
     "TP-6 CONTROL: the What to test next row is unchanged");
  ok(app.indexOf('sub:"Every value, range, and history"') > -1,
     "TP-7 CONTROL: the All N markers row is unchanged");
}

// ── the browser half ──
const STUB = `<script>
window.__errs=[];addEventListener("error",e=>window.__errs.push(String(e.message)));
const PROF={full_name:"Synthetic Tester",dob:"1990-01-01",age_affirmed_at:"2026-01-01T00:00:00Z",consent_accepted_at:"2026-01-01T00:00:00Z",supp_b12:null,supp_folate:null,confounders:{}};
const one={data:PROF,error:null};
const chain=()=>{const c={};for(const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"])c[k]=()=>c;
c.maybeSingle=async()=>one;c.single=async()=>one;c.then=(f)=>Promise.resolve({data:[],error:null}).then(f);return c;};
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:"t",user:{id:"00000000-0000-4000-8000-000000000001",email:"harness@example.com"}}}}),getUser:async()=>({data:{user:{id:"00000000-0000-4000-8000-000000000001"}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({})},from:()=>chain(),functions:{invoke:async()=>({data:null,error:null})},storage:{from:()=>({createSignedUrl:async()=>({data:null}),upload:async()=>({data:null,error:null})})},rpc:async()=>one})};
<\/script>`;
const DRIVER = `<script>
(async()=>{await new Promise(r=>setTimeout(r,900));const res={threw:false};
try{window.__rdSeries={};window.__allReports=[{id:"r1",collected_on:"2026-08-05"}];window.__doneReportIds=new Set(["r1"]);
window.showView("dashboard");await window.renderDashboard(${JSON.stringify(PAY)},"r1");}
catch(e){res.threw=true;res.message=e.message;}
const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
const fixedAnc=(el)=>{for(let n=el;n&&n!==document.documentElement;n=n.parentElement){
  if(getComputedStyle(n).position==="fixed") return n.id||"(unnamed)";} return null;};
res.heightBeforeTap=document.documentElement.scrollHeight;
res.rows=qa("#rail-browse .rail-row").map(b=>b.dataset.kind);
res.rowText=qa("#rail-browse .rail-row").map(b=>b.querySelector(".rail-row-h").innerText.trim()+" | "+b.querySelector(".rail-row-sub").innerText.trim());
const tw=q("#theme-wrap");
res.themeWrapCount=qa("#theme-wrap").length;
res.themeWrapFixedAnc=tw?fixedAnc(tw):"no el";
res.controlPriosFixedAnc=q("#prios-wrap")?fixedAnc(q("#prios-wrap")):"no el";
res.hiddenBefore=q("#view-themes")?q("#view-themes").classList.contains("hidden"):null;
const row=qa("#rail-browse .rail-row").find(b=>b.dataset.kind==="themes");
res.rowFound=!!row; if(row) row.click();
await new Promise(r=>setTimeout(r,400));
res.hiddenAfter=q("#view-themes")?q("#view-themes").classList.contains("hidden"):null;
res.cards=qa("#view-themes #theme-grid .theme-card").map(c=>c.dataset.theme);
res.cardsAnywhere=qa("#theme-grid .theme-card").length;
// textContent, not innerText. .section-label carries text-transform:uppercase, so innerText
// returns the RENDERED case and would pin a CSS rule rather than the copy.
res.heading=q("#view-themes #theme-wrap .section-label")?q("#view-themes #theme-wrap .section-label").textContent.trim():null;
res.headingRendered=q("#view-themes #theme-wrap .section-label")?q("#view-themes #theme-wrap .section-label").innerText.trim():null;
res.zThemes=q("#view-themes")?getComputedStyle(q("#view-themes")).zIndex:null;
res.zMarkers=q("#view-markers")?getComputedStyle(q("#view-markers")).zIndex:null;
const back=q("#themes-back"); res.backFound=!!back; if(back) back.click();
await new Promise(r=>setTimeout(r,300));
res.hiddenAfterBack=q("#view-themes")?q("#view-themes").classList.contains("hidden"):null;
res.errs=window.__errs;window.__result=res;window.__done=true;})();
<\/script>`;

let SERVE = "";
const server = createServer((req, res) => {
  if (req.url.startsWith("/ranges-slim.json")) {
    res.writeHead(200, { "content-type": "application/json" }); res.end(readFileSync("ranges-slim.json")); return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(SERVE);
});
await new Promise(r => server.listen(PORT, r));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + (PORT + 1),
  "--user-data-dir=/private/tmp/theme-page-" + process.pid, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL TP-8: Chrome never opened a debugging port"); fail++; chrome.kill(); server.close(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
async function run(pageHtml) {
  SERVE = pageHtml.replace(CDN, STUB).replace("</body>", DRIVER + "</body>");
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/page?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 45; i++) {
    await sleep(300);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify(window.__result) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) return JSON.parse(v.result.value);
  }
  return null;
}

console.log("THEME PAGE -- in a real browser");
const r = await run(HTML);
if (!r) { console.log("  FAIL TP-8: the page never finished"); fail++; }
else {
  ok(!r.threw, "TP-8: renderDashboard threw nothing" + (r.threw ? " -> " + r.message : ""));
  ok(r.errs.length === 0, "TP-8b: no page errors  (" + JSON.stringify(r.errs) + ")");
  eq(JSON.stringify(r.rows), JSON.stringify(["markers", "themes", "gaps"]),
     "TP-9: the Browse everything card renders three rows, themes in the middle");
  ok(r.rowText[1] === "By theme | Grouped by how it shows up in daily life",
     "TP-10: the middle row reads as briefed  (" + JSON.stringify(r.rowText[1]) + ")");
  // THE MOVE ITSELF. A fixed ancestor is what takes it out of the document scroll.
  eq(r.themeWrapCount, 1, "TP-11: there is exactly ONE #theme-wrap, so it moved rather than copied");
  eq(r.themeWrapFixedAnc, "view-themes", "TP-12: it now sits inside the fixed #view-themes, so it is out of the dashboard scroll");
  // CONTROL. A section that DID stay in the scroll has no fixed ancestor, so TP-12 is not
  // passing because every element reports one.
  eq(r.controlPriosFixedAnc, null, "TP-13 CONTROL: #prios-wrap is still in the scroll, with no fixed ancestor");
  // THE TAP.
  ok(r.rowFound, "TP-14: the By theme row is present to tap");
  eq(r.hiddenBefore, true, "TP-15: the theme page starts hidden");
  eq(r.hiddenAfter, false, "TP-16: and the tap opens it");
  // THE CONTENT, in its new home.
  eq(JSON.stringify(r.cards),
     JSON.stringify(["energy", "cycle_hormones", "metabolic", "inflammation", "nutrients", "organ_function"]),
     "TP-17: all six theme cards render INSIDE the new home, in order");
  eq(r.cardsAnywhere, 6, "TP-18: and six is the total on the page, so none were left behind");
  eq(r.heading, "Everything else, by theme", "TP-19: the block keeps its own heading, unchanged in the markup");
  eq(r.headingRendered, "EVERYTHING ELSE, BY THEME",
     "TP-19b: and its .section-label styling came with it, so it renders as it did before");
  // STACKING. The theme panel hands off to the markers view, so it must sit below it.
  ok(Number(r.zThemes) < Number(r.zMarkers),
     "TP-20: the theme page stacks BELOW the markers view, so its See-all hand-off lands on top  (" +
     r.zThemes + " < " + r.zMarkers + ")");
  ok(r.backFound && r.hiddenAfterBack === true, "TP-21: Back closes it again");
}

// ── THE MUTANT. Valid JS: the themes row is dropped from ROWS. ──
console.log("MUTANT -- the third row is removed");
const ROW_SRC = '    { kind:"themes",';
ok(HTML.indexOf(ROW_SRC) !== -1, "TP-22: the themes row was LOCATED in the shipped source, so the mutant is a real removal");
const mutantHtml = HTML.replace(/    \{ kind:"themes",[\s\S]*?heading:"By theme", sub:"Grouped by how it shows up in daily life" \},\n/, "");
ok(mutantHtml.length < HTML.length, "TP-23: the mutant is shorter, so the removal took effect");
try { new Function(extractApp(mutantHtml, "the mutant")); }
catch (e) { console.log("  FAIL TP-24: the mutant is not valid JavaScript (" + e.message + ")"); fail++; chrome.kill(); server.close(); done(1); }
ok(true, "TP-24: the mutant is valid JavaScript, so its red is behaviour and not syntax");
const m = await run(mutantHtml);
if (!m) { console.log("  FAIL TP-25: the mutant page never finished"); fail++; }
else {
  eq(JSON.stringify(m.rows), JSON.stringify(["markers", "gaps"]),
     "TP-25: with the row gone only two rows render, so TP-9 can fail");
  ok(!m.rowFound, "TP-26: and there is nothing to tap, so TP-14 and TP-16 can fail");
}

chrome.kill(); server.close();
done(fail ? 1 : 0);
