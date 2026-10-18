#!/usr/bin/env node
// LEFTOVERS_PALETTE_V1 -- no teal and no Plus Jakarta Sans renders anywhere on the site.
//
// WHAT IS PINNED. Every visible element (and its ::before / ::after) in every state below, at 1440
// and at 390, has no computed font-family containing "Plus Jakarta", and no computed color,
// background, border, outline, box-shadow, fill or stroke equal to one of the five old teal values
// (#0C8E6B, #097A5B, #B8E4D4, #E3F5EE, #F0F9F5, as rgb or rgba).
//   dashboard.html  upload (date of birth gate, draw card), companion with no panel, processing,
//                   processing failure, pending, interim, dashboard with clarify cards, the daily
//                   card, Sana and the report picker, the clarify acknowledgement, the Sana consent
//                   card, the markers, trends, gaps, themes and systems overlays, the system modal,
//                   the account modal, the delete confirm, the tester gate, every reveal beat
//   review.html     login, two-factor, queue, detail
//   terms.html, privacy.html, science.html, index.html, login.html, signup.html
//
// WHY COMPUTED STYLE. The teal tokens are still declared by name (--teal and friends now hold olive
// and sage), so a source grep for "--teal" proves nothing about what paints. Only the computed value
// says whether a teal pixel can reach the screen.
//
// CONTROLS. Each state must sweep a real number of elements, so a state that failed to render cannot
// pass by being empty. Two mutants must fail: dashboard.html with --teal put back to #0C8E6B in
// :root, and terms.html with its headings put back on Plus Jakarta. ROOT=path runs the same suite
// against another checkout (it fails on 009e0f1, the commit before this change).
//
// Every fixture is synthetic. No stored row, no real user id. All network outside 127.0.0.1 is
// refused, so fonts never load; computed font-family is the declared stack either way.
//
//   node scripts/test-leftovers-palette.mjs        (CHROME=/path/to/chrome, ROOT=/path/to/checkout)
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = process.env.ROOT || ".";
// Same default as the other browser suites in this folder. The override changes which binary runs,
// never what is asserted.
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9700 + Math.floor(Math.random() * 200);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };
if (!existsSync(CHROME)) { console.log("  FAIL LP-0: Chrome is not at " + CHROME); fail++; done(1); }

// dashboard.html is signed in (signed out it redirects to /login); review.html is signed out and its views are
// shown directly. Nothing is stored. Table reads come from window.__STUBDATA so the daily card has a pool.
const STUB = (signedIn) => `<script>
window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message)));
const noRows = { data: null, error: null };
const chain = (t) => { const c = {}; for (const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"]) c[k] = () => c;
  const rows = () => ((window.__STUBDATA || {})[t] || []);
  c.maybeSingle = async () => ({ data: rows()[0] || null, error: null }); c.single = async () => ({ data: rows()[0] || null, error: null });
  c.then = (f) => Promise.resolve({ data: rows(), error: null }).then(f); return c; };
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: ${signedIn ? '{ access_token: "t", user: { id: "00000000-0000-4000-8000-000000000003", email: "harness@example.com" } }' : 'null'} } }),
          getUser: async () => ({ data: { user: ${signedIn ? '{ id: "00000000-0000-4000-8000-000000000003" }' : 'null'} } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}),
          mfa: { listFactors: async () => ({ data: { totp: [] } }), getAuthenticatorAssuranceLevel: async () => ({ data: {} }) } },
  from: (t) => chain(t), functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null }), upload: async () => ({ data: null, error: null }) }) },
  rpc: async () => noRows }) };
<\/script>`;

// The sweep, run in the page. Returns one record per state: element count, and every teal or Plus
// Jakarta hit as "element property value".
const SWEEP = `
window.__TEAL = ["12, 142, 107", "9, 122, 91", "184, 228, 212", "227, 245, 238", "240, 249, 245", "#0c8e6b", "#097a5b", "#b8e4d4", "#e3f5ee", "#f0f9f5"];
window.__sweep = (sels) => {
  const props = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "boxShadow", "fill", "stroke", "backgroundImage", "fontFamily"];
  const roots = sels.map(s => document.querySelector(s)).filter(Boolean);
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  let n = 0; const hits = [];
  for (const root of roots) for (const el of [root, ...root.querySelectorAll("*")]) {
    if (!vis(el)) continue;
    for (const ps of [null, "::before", "::after"]) {
      const cs = getComputedStyle(el, ps);
      if (ps && (cs.content === "none" || cs.content === "normal" || cs.display === "none")) continue;
      n++;
      const id = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\\s+/).join(".") : "") + (ps || "");
      for (const p of props) {
        if (/^border(\\w+)Color$/.test(p) && parseFloat(cs["border" + p.slice(6, -5) + "Width"]) === 0) continue;
        if (p === "outlineColor" && (cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) === 0)) continue;
        if ((p === "fill" || p === "stroke") && !(el instanceof SVGElement)) continue;
        const v = String(cs[p]);
        if (p === "fontFamily" ? /Plus Jakarta/i.test(v) : window.__TEAL.some(t => v.toLowerCase().includes(t))) hits.push(id + " " + p + " " + v);
      }
      if (el instanceof SVGElement) for (const a of ["fill", "stroke", "font-family"]) { const at = (el.getAttribute(a) || "").toLowerCase();
        if (at && (/plus jakarta/.test(at) || window.__TEAL.some(t => at.includes(t)))) hits.push(id + " @" + a + " " + at); }
    }
  }
  return { n, hits };
};
window.__res = {}; window.__S = (name, sels) => { window.__res[name] = window.__sweep(sels); };
const __w = (ms) => new Promise(r => setTimeout(r, ms));
`;

// ── synthetic fixture ──
const mk = (id, name, sys, v, unit, status, band) => ({ marker_id: id, display_name: name, value: v, unit, canonical_unit: unit,
  normalized_value: v, status, band, system_id: sys, date: "2026-07-15" });
const SYSTEMS = [
  { system_id: "vitamins", display_name: "Vitamins", status: "flag", summary: "Synthetic summary.",
    markers: [mk("vitamin_d_25oh_total", "Vitamin D", "vitamins", 18, "ng/mL", "low", "low"), mk("vitamin_b12", "Vitamin B12", "vitamins", 412, "pg/mL", "optimal", "optimal")] },
  { system_id: "iron_status", display_name: "Iron", status: "watch", summary: "Synthetic summary.",
    markers: [mk("ferritin", "Ferritin", "iron_status", 42, "ng/mL", "suboptimal", "suboptimal_low")] },
  { system_id: "metabolic", display_name: "Metabolic", status: "optimal", summary: "Synthetic summary.",
    markers: [mk("hba1c", "HbA1c", "metabolic", 5.2, "%", "optimal", "optimal")] },
  { system_id: "sex_hormones", display_name: "Sex hormones", status: "not_scored", summary: "Synthetic summary.",
    markers: [mk("17_oh_progesterone", "17-OH progesterone", "sex_hormones", 1.4, "ng/mL", "life_stage_reference", null), mk("amh", "AMH", "sex_hormones", 2.1, "ng/mL", "not_scored", null)] },
  { system_id: "inflammation", display_name: "Inflammation", status: "flag", summary: "Synthetic summary.",
    markers: [mk("hs_crp", "hs-CRP", "inflammation", 4.1, "mg/L", "high", "high")] },
];
const pt = (d, v, s) => ({ collected_on: d, normalized_value: v, status: s });
const SERIES = { vitamin_d_25oh_total: [pt("2026-01-15", 24, "low"), pt("2026-07-15", 18, "low")], ferritin: [pt("2026-01-15", 60, "optimal"), pt("2026-07-15", 42, "suboptimal")],
  vitamin_b12: [pt("2026-01-15", 298, "suboptimal"), pt("2026-07-15", 412, "optimal")], hs_crp: [pt("2026-01-15", 0.8, "optimal"), pt("2026-07-15", 4.1, "high")] };
const lm = (id, name, unit, pv, cv, st, extra) => Object.assign({ marker_id: id, display_name: name, unit, prior_value: pv, current_value: cv, current_status: st, severity: 2 }, extra || {});
const pr = (rank, head, sys, mid, name, st) => ({ rank, priority_id: "p" + rank, headline: head, system_id: sys, severity: "moderate",
  primary_markers: [{ marker_id: mid, display_name: name, value: 1, unit: "u", flag_status: st }],
  why_this_matters: "A synthetic reason.", the_connection: "c", action_layer: { primary_lever: "lever" }, trajectory_promise: "t" });
const P = {
  panel_date: "2026-07-15",
  vitality: { composite: 71, visibility: 82, band: { key: "steady", label: "Steady" }, display: { show_composite: true },
    pills: { hormones: { display_name: "Hormones", coverFactor: 0.4 }, energy: { display_name: "Energy", coverFactor: 0.95 } } },
  systems: SYSTEMS,
  priorities: [pr(1, "Your vitamin D is running low", "vitamins", "vitamin_d_25oh_total", "Vitamin D", "flag"), pr(2, "Your iron stores are on the low side", "iron_status", "ferritin", "Ferritin", "watch"),
               pr(3, "Inflammation is up", "inflammation", "hs_crp", "hs-CRP", "flag")],
  // QW_SAFETY_ANY_V1 (2026-10-18): ordinary markers on each entry, because a markerless entry is now
  // dropped and the strength cards would leave this sweep without failing it.
  quietly_working: [{ finding: "Your blood sugar control is steady.", markers: ["glucose"] }, { finding: "A second quiet win.", markers: ["hdl"] }],
  foundations: { lead: "Lead line.", closing: "Closing line.", levers: [{ display_name: "Morning sunlight", action: "Synthetic action.", appears_in_priority_ids: ["p1"] }] },
  coverage_gap: { ids: ["free_t3", "homocysteine"], by_system: { thyroid: ["free_t3"], methylation: ["homocysteine"] }, direction_only: [] },
  longitudinal: { baseline_panel_date: "2026-01-15", resolved: [lm("vitamin_b12", "Vitamin B12", "pg/mL", 298, 412, "optimal")],
    persistent_open: [lm("vitamin_d_25oh_total", "Vitamin D", "ng/mL", 24, 18, "flag")], newly_crossed: [lm("hs_crp", "hs-CRP", "mg/L", 0.8, 4.1, "flag", { salience: "notable" })],
    counts: { resolved: 1, steady_healthy: 3 } },
};

// One driver per page. Each walks its states and sets window.__done.
const DRIVERS = {
  "dashboard.html": `(async () => { try {
    const P = ${JSON.stringify(P)}, SR = ${JSON.stringify(SERIES)};
    await __w(900); document.body.classList.add("ready");
    for (const id of ["age-modal", "onb2-modal"]) { const m = document.getElementById(id); m && m.classList.remove("show"); }
    const tg = document.getElementById("tester-gate"); tg && tg.classList.add("hidden");
    showView("upload"); document.getElementById("dob-gate").style.display = "block"; await __w(100); __S("upload-prefile", ["#view-upload", ".topbar"]);
    document.getElementById("dob-gate").style.display = "none"; document.getElementById("up-prefile").classList.add("hidden"); document.getElementById("up-postfile").classList.remove("hidden");
    document.getElementById("ad-about").classList.remove("hidden"); document.getElementById("cyc-lens").classList.remove("hidden"); await __w(100); __S("upload-drawcard", ["#view-upload"]);
    showView("companion"); await __w(100); __S("companion-nopanel", ["#view-companion", ".topbar"]);
    showView("processing"); await __w(100); __S("processing", ["#view-processing"]);
    try { pcRenderFailure("00000000-0000-4000-8000-0000000000aa", "retryable"); } catch (e) {} await __w(100); __S("processing-fail", ["#view-processing"]);
    showView("pending"); await __w(100); __S("pending", ["#view-pending"]);
    showView("interim"); renderInterim({ systems: P.systems }, 60000); await __w(100); __S("interim", ["#view-interim"]);
    window.__rdSeries = SR; PROFILE = {};
    window.__STUBDATA = { action_pool: [{ action_id: "a1", priority_marker_id: "vitamin_d_25oh_total", base_text: "Spend ten minutes outside before noon.", phase_notes: null },
      { action_id: "a3", priority_marker_id: null, base_text: "Go to bed at the same time as yesterday.", phase_notes: null }] };
    window.__clarifyByReport = new Map([["r1", [{ kind: "marker", marker_id: "vitamin_b12" }, { kind: "confounder", confounder_id: "true_fasting_at_draw", question: "Was this blood test done fasting?" }]]]);
    await renderDashboard(P, "r1"); showView("dashboard");
    const pk = document.getElementById("report-picker"); pk.innerHTML = '<option value="r1">15 Jul 2026</option><option value="r0">15 Jan 2026</option>'; pk.classList.remove("hidden");
    await __w(1500);
    try { renderClarify("r1"); } catch (e) {}
    try { sanaMountChat(); sanaAppendChipTurn("Why is my vitamin D flagged?", "A synthetic answer."); } catch (e) {}
    await __w(500); __S("dashboard", ["#view-dashboard", ".topbar"]);
    window.__res.dashboard.seen = ["#clarify .clarify-opt", "#daily-card", ".companion", "#report-picker"].filter(s => document.querySelector(s));
    const co = document.querySelector("#clarify .clarify-opt"); co && co.click(); await __w(400); __S("dashboard-clarify-ack", ["#clarify-wrap", "#clarify", "#daily-card", ".companion"]);
    try { sanaAskConsent(); } catch (e) {} await __w(300); __S("sana-consent-card", [".companion", "#sana-consent"]);
    for (const [name, fn, root] of [["markers", () => openMarkersView(window.__rdPayload), "#view-markers"], ["trends", () => openTrendsView(), "#view-trends"],
        ["gaps", () => openGapsView(), "#view-gaps"], ["themes", () => openThemesView(), "#view-themes"], ["systems", () => openSystemsView(), "#view-systems"]]) {
      fn(); await __w(250); __S("overlay-" + name, [root]); document.querySelector(root).classList.add("hidden"); }
    openSystem(window.__rdPayload, window.__rdPayload.systems[0]); await __w(300); __S("system-modal", ["#sm-card"]);
    document.getElementById("sys-modal").classList.remove("show");
    document.getElementById("btn-account").click(); await __w(300); __S("account-modal", ["#account-modal"]);
    const dO = document.getElementById("del-open"); dO && dO.click(); await __w(200); __S("delete-confirm", ["#account-modal"]);
    document.getElementById("account-modal").classList.add("hidden");
    tg.classList.remove("hidden"); tg.setAttribute("aria-hidden", "false"); await __w(200); __S("tester-gate", ["#tester-gate"]); tg.classList.add("hidden");
    buildDeck(P, "r1", false); showView("reveal");
    const nB = document.querySelectorAll("#rd-deck .card").length;
    for (let i = 0; i < nB; i++) { await __w(1200); __S("reveal-b" + (i + 1), ["#view-reveal"]);
      const pc = document.querySelector("#rd-deck .card.active .prio-card");
      if (pc) { pc.click(); await __w(400); __S("reveal-prio-modal", ["#view-reveal"]); document.getElementById("rd-priomodal").classList.remove("show"); }
      if (i < nB - 1) document.getElementById("rd-next").click(); }
  } catch (e) { window.__threw = String(e && e.stack || e); } window.__done = true; })();`,
  "review.html": `(async () => { try { await __w(600);
    for (const v of ["view-login", "view-mfa", "view-queue", "view-detail"]) {
      show(v); document.getElementById("signout").classList.remove("hidden");
      if (v === "view-queue") document.getElementById("queue-list").innerHTML = '<div class="q-row"><span>Synthetic report</span><span class="pill">2 h</span></div>';
      if (v === "view-detail") { const c = document.getElementById("flag-count"); c.className = "count none"; c.textContent = "No flags";
        document.getElementById("flag-codes").innerHTML = '<span class="chip">synthetic</span><span class="chip out">out</span>';
        const m = document.getElementById("act-msg"); m.className = "msg ok"; m.textContent = "Approved."; }
      await __w(100); __S("review-" + v.slice(5), ["body"]); }
  } catch (e) { window.__threw = String(e && e.stack || e); } window.__done = true; })();`,
};
const STATIC = ["terms.html", "privacy.html", "science.html", "index.html", "login.html", "signup.html"];
for (const pg of STATIC) DRIVERS[pg] = `(async () => { await __w(600);
  document.querySelectorAll(".reveal,.fade,[data-reveal]").forEach(e => e.classList.add("in", "visible", "shown"));
  __S("${pg.replace(".html", "")}", ["body"]); window.__done = true; })();`;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
let override = {};   // path -> html, for the mutants
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, ""); if (!p) p = "index.html"; if (!extname(p)) p += ".html";
  const f = join(ROOT, p);
  if (!override[p] && !existsSync(f)) { res.writeHead(404); return res.end(); }
  if (p.endsWith(".html") && DRIVERS[p]) {
    let html = override[p] || readFileSync(f, "utf8");
    html = html.includes(CDN) ? html.replace(CDN, STUB(p === "dashboard.html")) : html;
    html = html.replace("</body>", "<script>" + SWEEP + DRIVERS[p] + "<\/script></body>");
    res.writeHead(200, { "content-type": TYPES[".html"] }); return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));

const profile = "/tmp/leftovers-palette-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--remote-debugging-port=" + (PORT + 1), "--user-data-dir=" + profile,
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL LP-0c: Chrome never opened a debugging port"); fail++; server.close(); chrome.kill(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);

async function run(page, width) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/" + page + "?t=" + Date.now() }, sessionId);
  for (let i = 0; i < 160; i++) { await sleep(250);
    const v = await send("Runtime.evaluate", { expression: "window.__done ? JSON.stringify({ res: window.__res, threw: window.__threw || null }) : ''", returnByValue: true }, sessionId);
    if (v.result && v.result.value) return JSON.parse(v.result.value); }
  return null;
}

// Floors sit under the measured counts (dashboard about 295 at 390, processing 4, pending 3), so a state that
// rendered nothing fails while normal layout differences between widths do not.
const MIN = { "dashboard": 200, "overlay-": 20, "reveal-": 20, "review-": 10 };
const minFor = (s) => MIN[s] || MIN[Object.keys(MIN).find(k => k.endsWith("-") && s.startsWith(k))] || 3;
let total = 0, states = 0;
console.log("SWEEP -- " + ROOT);
for (const width of [1440, 390]) for (const page of Object.keys(DRIVERS)) {
  const r = await run(page, width);
  ok(r && !r.threw, "LP-1 " + page + " " + width + ": the driver finished" + (r && r.threw ? "  threw " + r.threw.split("\n")[0] : ""));
  if (!r) continue;
  for (const [st, { n, hits, seen }] of Object.entries(r.res)) {
    states++; total += hits.length;
    ok(n >= minFor(st), "LP-2 CONTROL " + page + " " + st + " " + width + ": " + n + " elements swept (expect " + minFor(st) + " or more)");
    ok(hits.length === 0, "LP-3 " + page + " " + st + " " + width + ": no teal and no Plus Jakarta" + (hits.length ? "  " + hits.length + " hits, e.g. " + hits.slice(0, 3).join(" | ") : ""));
    if (seen) ok(seen.length === 4, "LP-4 CONTROL dashboard " + width + ": clarify cards, the daily card, Sana and the picker are on screen (" + seen.join(", ") + ")");
  }
  if (page === "dashboard.html") ok(Object.keys(r.res).filter(k => k.startsWith("reveal-b")).length >= 5, "LP-5 CONTROL dashboard " + width + ": the reveal deck walked at least five beats");
}
ok(states >= 2 * 36, "LP-6 CONTROL: " + states + " states swept across both widths (expect 72 or more)");
console.log("  total hits: " + total);

console.log("\nMUTANTS -- one teal or one Plus Jakarta put back must be caught");
const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
const terms = readFileSync(join(ROOT, "terms.html"), "utf8");
const M1 = dash.replace("--teal:var(--olive);", "--teal:#0C8E6B;");
const M2 = terms.replace("h1,h2,h3{font-family:'Fraunces',Georgia,serif;", "h1,h2,h3{font-family:'Plus Jakarta Sans',sans-serif;");
if (M1 === dash || M2 === terms) {
  ok(false, "LP-7 control: the mutants could not be applied (this checkout predates LEFTOVERS_PALETTE_V1)");
} else {
  override = { "dashboard.html": M1 };
  const a = await run("dashboard.html", 1440);
  const ah = a ? Object.values(a.res).reduce((s, x) => s + x.hits.length, 0) : 0;
  ok(ah > 0, "LP-8 MUTANT --teal back to #0C8E6B in dashboard.html :root: caught (" + ah + " hits)");
  override = { "terms.html": M2 };
  const b = await run("terms.html", 1440);
  const bh = b ? Object.values(b.res).reduce((s, x) => s + x.hits.length, 0) : 0;
  ok(bh > 0, "LP-9 MUTANT terms.html headings back on Plus Jakarta: caught (" + bh + " hits)");
  override = {};
}

ws.close(); chrome.kill(); server.close();
done(fail ? 1 : 0);
