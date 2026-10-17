#!/usr/bin/env node
// LANDING_PRODUCT_SHOTS_V1 -- the three dashboard screenshots in the home page's "What you get back"
// section, captured from dashboard.html rendering a SYNTHETIC panel.
//
// WHAT IT DOES. Serves this checkout on 127.0.0.1, boots dashboard.html signed in against the same
// stubbed supabase client the palette gate uses (scripts/test-leftovers-palette.mjs), renders the
// synthetic payload below, mounts Sana, and shoots three frames at deviceScaleFactor 2.
//   shot-01-dashboard  1440x900 viewport, the dashboard top           -> 1600px wide WebP
//   shot-02-trends     openTrendsView(), 1440 wide, top 410 CSS px    -> 1600px wide WebP
//   shot-03-mobile     390x844 viewport, the dashboard top             -> 780px wide WebP
// WebP is encoded at quality 82 by Chrome's own canvas encoder, so nothing beyond Chrome is needed.
// Output goes to assets/landing/. The PNGs stay in a temp folder and never enter the repo.
//
// NO REAL DATA, NO LIVE SITE. Nobody signs in. No account, no stored row and no real person's panel
// is touched. Chrome resolves every host except 127.0.0.1 to NOTFOUND, so the supabase CDN, Google
// Fonts and every other network call is refused. The CDN script tag is swapped for the stub, and the
// Google Fonts link for a local stylesheet built from two pinned npm packages
// (@fontsource-variable/fraunces@5.1.0, @fontsource/instrument-sans@5.1.0) that are installed into
// a temp folder, never the repo. FONTS_DIR=path reuses an existing install.
//
// WHAT IT REFUSES. Before writing anything it reads the visible text inside each cropped area and
// fails loudly if any of it contains "functional", a "Healthy N to N" range, or a heavy metal,
// autoimmune or tumour marker. Numeric ranges are not cleared for marketing, which is also why the
// full markers list is never shot. Nothing is written unless all three shots pass.
//
//   node scripts/capture-landing-shots.mjs            (CHROME=/path/to/chrome, ROOT=/path/to/checkout)
//   node scripts/capture-landing-shots.mjs --check    (assertions only, no fonts, nothing written)
//   MUTANT="some text" ... --check                    (plants that text in each crop; the run must fail)
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.env.ROOT || ".";
const CHECK = process.argv.includes("--check");
// Test-only. scripts/test-landing-shots.mjs plants banned text to prove the screen below fails loudly.
const MUTANT = process.env.MUTANT || "";
if (MUTANT && !CHECK) { console.error("  MUTANT is for --check runs only"); process.exit(1); }
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9500 + Math.floor(Math.random() * 200);
const CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
const OUT = join(ROOT, "assets", "landing");
const TMP = mkdtempSync(join(tmpdir(), "landing-shots-"));
const die = (m) => { console.error("\n  FAIL " + m + "\n"); try { chrome && chrome.kill(); server && server.close(); } catch (e) {} process.exit(1); };
if (!existsSync(CHROME)) die("Chrome is not at " + CHROME);

// ── fonts, pinned, installed outside the repo ──
const FONT_PKGS = ["@fontsource-variable/fraunces@5.1.0", "@fontsource/instrument-sans@5.1.0"];
let FONTS = null;
if (!CHECK) {
  FONTS = process.env.FONTS_DIR || join(TMP, "fonts");
  if (!existsSync(join(FONTS, "node_modules", "@fontsource-variable", "fraunces"))) {
    console.log("  installing " + FONT_PKGS.join(" ") + " into " + FONTS);
    mkdirSync(FONTS, { recursive: true });
    execFileSync("npm", ["install", "--silent", "--no-save", "--no-package-lock", "--prefix", FONTS, ...FONT_PKGS], { stdio: "inherit" });
  }
}
// Named exactly as the pages name them, so the declared stacks resolve to these files.
const face = (fam, style, weight, file) => `@font-face{font-family:'${fam}';font-style:${style};font-weight:${weight};font-display:block;src:url(/__fonts/${file}) format('woff2')}`;
const FONT_CSS = [
  ...["normal", "italic"].flatMap(s => ["latin", "latin-ext"].map(r => face("Fraunces", s, "100 900", "@fontsource-variable/fraunces/files/fraunces-" + r + "-opsz-" + s + ".woff2"))),
  ...["400", "500", "600"].flatMap(w => ["normal", "italic"].flatMap(s => ["latin", "latin-ext"].map(r => face("Instrument Sans", s, w, "@fontsource/instrument-sans/files/instrument-sans-" + r + "-" + w + "-" + s + ".woff2")))),
].join("\n");

// ── the stub, the same shape as test-leftovers-palette.mjs, signed in ──
const STUB = `<script>
window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message)));
const noRows = { data: null, error: null };
const chain = (t) => { const c = {}; for (const k of ["select","eq","neq","in","is","not","order","limit","gte","lte","filter","update","insert","upsert","delete"]) c[k] = () => c;
  const rows = () => ((window.__STUBDATA || {})[t] || []);
  c.maybeSingle = async () => ({ data: rows()[0] || null, error: null }); c.single = async () => ({ data: rows()[0] || null, error: null });
  c.then = (f) => Promise.resolve({ data: rows(), error: null }).then(f); return c; };
window.supabase = { createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: "t", user: { id: "00000000-0000-4000-8000-000000000003", email: "harness@example.com" } } } }),
          getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-000000000003" } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe(){} } } }), signOut: async () => ({}),
          mfa: { listFactors: async () => ({ data: { totp: [] } }), getAuthenticatorAssuranceLevel: async () => ({ data: {} }) } },
  from: (t) => chain(t), functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null }), upload: async () => ({ data: null, error: null }) }) },
  rpc: async () => noRows }) };
<\/script>`;

// ── the synthetic panel. Every value here is made up. ──
const D = "2026-07-15";
const mk = (id, name, sys, v, unit, status, band) => ({ marker_id: id, display_name: name, value: v, unit, canonical_unit: unit,
  normalized_value: v, status, band, system_id: sys, date: D });
const SYSTEMS = [
  { system_id: "vitamins", display_name: "Vitamins", status: "flag", summary: "Vitamin D is low on this panel.",
    markers: [mk("vitamin_d_25oh_total", "Vitamin D", "vitamins", 18, "ng/mL", "low", "low"),
              mk("vitamin_b12", "Vitamin B12", "vitamins", 680, "pg/mL", "optimal", "optimal"),
              mk("vitamin_b9_folate", "Folate", "vitamins", 11.2, "ng/mL", "optimal", "optimal")] },
  { system_id: "iron_status", display_name: "Iron", status: "watch", summary: "Iron stores are on the low side.",
    markers: [mk("ferritin", "Ferritin", "iron_status", 42, "ng/mL", "suboptimal", "suboptimal_low"),
              mk("hemoglobin", "Hemoglobin", "iron_status", 13.4, "g/dL", "optimal", "optimal")] },
  { system_id: "metabolic", display_name: "Metabolic", status: "optimal", summary: "Blood sugar control looks steady.",
    markers: [mk("hba1c", "HbA1c", "metabolic", 5.2, "%", "optimal", "optimal"),
              mk("fasting_glucose", "Fasting glucose", "metabolic", 86, "mg/dL", "optimal", "optimal")] },
  { system_id: "thyroid", display_name: "Thyroid", status: "optimal", summary: "Thyroid looks steady.",
    markers: [mk("tsh", "TSH", "thyroid", 1.9, "mIU/L", "optimal", "optimal")] },
  { system_id: "cardiovascular", display_name: "Heart and lipids", status: "watch", summary: "LDL is edging up.",
    markers: [mk("ldl_cholesterol", "LDL", "cardiovascular", 118, "mg/dL", "suboptimal", "suboptimal_high"),
              mk("hdl_cholesterol", "HDL", "cardiovascular", 58, "mg/dL", "optimal", "optimal")] },
];
const DATES = ["2025-07-15", "2026-01-15", "2026-07-15"];
const ser = (vals, sts) => vals.map((v, i) => ({ collected_on: DATES[i], normalized_value: v, status: sts[i] }));
const SERIES = {
  vitamin_d_25oh_total: ser([29, 24, 18], ["suboptimal", "low", "low"]),
  ferritin: ser([85, 60, 42], ["optimal", "optimal", "suboptimal"]),
  vitamin_b12: ser([640, 540, 680], ["optimal", "suboptimal", "optimal"]),
  ldl_cholesterol: ser([104, 109, 118], ["optimal", "optimal", "suboptimal"]),
};
const lm = (id, name, unit, pv, cv, st) => ({ marker_id: id, display_name: name, unit, prior_value: pv, current_value: cv, current_status: st, severity: 2 });
const pr = (rank, head, sys, mid, name, v, unit, st) => ({ rank, priority_id: "p" + rank, headline: head, system_id: sys, severity: "moderate",
  primary_markers: [{ marker_id: mid, display_name: name, value: v, unit, flag_status: st }],
  why_this_matters: "", the_connection: "", action_layer: {}, trajectory_promise: "" });
export const PAYLOAD = {
  panel_date: D,
  vitality: { composite: 74, visibility: 86, band: { key: "steady", label: "Steady" }, display: { show_composite: true } },
  systems: SYSTEMS,
  priorities: [pr(1, "Your vitamin D is running low", "vitamins", "vitamin_d_25oh_total", "Vitamin D", 18, "ng/mL", "flag"),
               pr(2, "Your iron stores are on the low side", "iron_status", "ferritin", "Ferritin", 42, "ng/mL", "watch")],
  longitudinal: { baseline_panel_date: "2026-01-15",
    resolved: [lm("vitamin_b12", "Vitamin B12", "pg/mL", 540, 680, "optimal")],
    persistent_open: [lm("vitamin_d_25oh_total", "Vitamin D", "ng/mL", 24, 18, "flag")],
    newly_crossed: [], counts: { resolved: 1, steady_healthy: 6 } },
};

// The visible-text reader, run in the page. Every text node (and ::before/::after content) whose box
// meets the crop rect and is actually painted. Over-inclusive on purpose: text under an overlay
// still counts, so the assertion can only err towards failing.
const READER = `window.__visibleText = (rootSel, crop) => {
  const root = document.querySelector(rootSel) || document.body; const out = [];
  const shown = (el) => { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false; } return true; };
  const meets = (r) => r.width > 0 && r.height > 0 && r.right > crop.x && r.left < crop.x + crop.w && r.bottom > crop.y && r.top < crop.y + crop.h;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.textContent.replace(/\\s+/g, " ").trim(); if (!t || !shown(n.parentElement)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); if ([...rg.getClientRects()].some(meets)) out.push(t); }
  for (const el of root.querySelectorAll("*")) for (const ps of ["::before", "::after"]) { const c = getComputedStyle(el, ps).content;
    if (c && c !== "none" && c !== "normal" && /[a-z0-9]/i.test(c) && shown(el) && meets(el.getBoundingClientRect())) out.push(c.replace(/^"|"$/g, "")); }
  return out.join(" | ");
};`;

const DRIVER = `(async () => { try {
  const w = (ms) => new Promise(r => setTimeout(r, ms));
  const P = ${JSON.stringify(PAYLOAD)}, SR = ${JSON.stringify(SERIES)};
  await w(900); document.body.classList.add("ready");
  // Kill animation and transition so every shot is a settled frame.
  const st = document.createElement("style");
  st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
  document.head.appendChild(st);
  // The age and onboarding modals and the tester gate, hidden as the palette gate hides them.
  for (const id of ["age-modal", "onb2-modal"]) { const m = document.getElementById(id); m && m.classList.remove("show"); }
  const tg = document.getElementById("tester-gate"); tg && tg.classList.add("hidden");
  window.__rdSeries = SR; PROFILE = { full_name: "Priya" };
  await renderDashboard(P, "r1"); showView("dashboard");
  await w(800);
  sanaMountChat();
  await document.fonts.ready; await w(1200);
  scrollTo(0, 0);
} catch (e) { window.__threw = String(e && e.stack || e); } window.__ready = true; })();`;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".css": "text/css" };
var server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, ""); if (!p) p = "index.html"; if (!extname(p) && !p.startsWith("__")) p += ".html";
  if (p === "__fonts.css") { res.writeHead(200, { "content-type": TYPES[".css"] }); return res.end(CHECK ? "" : FONT_CSS); }
  if (p.startsWith("__fonts/")) { const f = join(FONTS || "", "node_modules", p.slice(8)); if (!FONTS || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": TYPES[".woff2"] }); return res.end(readFileSync(f)); }
  if (p === "__encode.html") { res.writeHead(200, { "content-type": TYPES[".html"] }); return res.end("<!doctype html><canvas id=c></canvas>"); }
  const f = join(ROOT, p);
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  if (p === "dashboard.html") {
    let html = readFileSync(f, "utf8");
    if (!html.includes(CDN)) { res.writeHead(500); return res.end("no CDN tag"); }
    html = html.replace(CDN, STUB).replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet"\/>/, '<link href="/__fonts.css" rel="stylesheet"/>');
    html = html.replace("</body>", "<script>" + READER + DRIVER + "<\/script></body>");
    res.writeHead(200, { "content-type": TYPES[".html"] }); return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));

var chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--remote-debugging-port=" + (PORT + 1), "--user-data-dir=" + join(TMP, "profile"),
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) die("Chrome never opened a debugging port");
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId: S } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, S);
const ev = async (expr) => { const v = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, S);
  if (v.exceptionDetails) die("page threw: " + JSON.stringify(v.exceptionDetails).slice(0, 300)); return v.result && v.result.value; };

async function boot(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false }, S);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/dashboard.html?t=" + Date.now() }, S);
  for (let i = 0; i < 120; i++) { await sleep(250); if (await ev("!!window.__ready")) break; }
  const threw = await ev("window.__threw || null"); if (threw) die("the dashboard driver threw " + threw.split("\n")[0]);
  if (!(await ev("!!document.querySelector('#view-dashboard') && !document.querySelector('#view-dashboard').classList.contains('hidden')"))) die("the dashboard view is not on screen");
}

// Text that must never appear inside a shot. Each one fails the run, and nothing is written.
const BANNED = [
  [/functional/i, "the word functional"],
  [/Healthy\s+(below\s+|above\s+)?[\d.]+\s*(\S+\s+)?to\s+[\d.]+/i, "a Healthy N to N range"],
  [/\d[\d.]*\s*(?:-|–|to)\s*\d[\d.]*\s*(ng\/mL|pg\/mL|g\/dL|mg\/dL|mIU\/L|%)/i, "a numeric range"],
  [/heavy metal|\blead\b|mercury|aluminum|cadmium|arsenic/i, "a heavy metal"],
  [/autoimmun|\bANA\b|anti-?TPO|thyroglobulin antibod/i, "an autoimmune marker"],
  [/tumou?r|\bCA[ -]?125\b|\bCA[ -]?15|\bCA[ -]?19|\bCEA\b|\bAFP\b/i, "a tumour marker"],
];
export function screen(text) { return BANNED.filter(([re]) => re.test(text)).map(([, what]) => what); }

const shots = [];
async function shoot(name, width, height, crop, root, setup) {
  await boot(width, height);
  if (setup) { await ev(setup); await sleep(600); }
  if (MUTANT) await ev(`(() => { const d = document.createElement("p"); d.textContent = ${JSON.stringify(MUTANT)};
    const r = document.querySelector(${JSON.stringify(root)}) || document.body; r.prepend(d); })()`);
  const text = await ev("window.__visibleText(" + JSON.stringify(root) + ", " + JSON.stringify(crop) + ")");
  if (!text || text.length < 40) die(name + ": almost no visible text in the crop (" + (text || "").length + " chars), so the render failed");
  const bad = screen(text);
  console.log("  " + name + ": " + text.length + " chars of visible text read");
  if (bad.length) die(name + ": the visible text contains " + bad.join(", ") + "\n\n  " + text.slice(0, 1200));
  if (!/Priya|vitamin D/i.test(text) && name !== "shot-02-trends") die(name + ": the synthetic panel is not what is on screen");
  shots.push({ name, crop, width, height, text });
}

await shoot("shot-01-dashboard", 1440, 900, { x: 0, y: 0, w: 1440, h: 900 }, "body");
await shoot("shot-02-trends", 1440, 900, { x: 0, y: 0, w: 1440, h: 410 }, "#view-trends", "openTrendsView()");
await shoot("shot-03-mobile", 390, 844, { x: 0, y: 0, w: 390, h: 844 }, "body");

if (CHECK) { console.log("\n  --check: all three crops are clean. Nothing written."); ws.close(); chrome.kill(); server.close(); process.exit(0); }

// Re-boot each state and capture, then encode in the same Chrome.
const TARGET = { "shot-01-dashboard": 1600, "shot-02-trends": 1600, "shot-03-mobile": 780 };
mkdirSync(OUT, { recursive: true });
const pngs = {};
for (const s of shots) {
  await boot(s.width, s.height);
  if (s.name === "shot-02-trends") { await ev("openTrendsView()"); await sleep(600); }
  const { data } = await send("Page.captureScreenshot", { format: "png", clip: { x: s.crop.x, y: s.crop.y, width: s.crop.w, height: s.crop.h, scale: 1 }, captureBeyondViewport: false }, S);
  if (!data) die(s.name + ": no screenshot came back");
  const png = join(TMP, s.name + ".png"); writeFileSync(png, Buffer.from(data, "base64")); pngs[s.name] = data;
  console.log("  " + s.name + ".png -> " + png);
}
await send("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false }, S);
await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/__encode.html" }, S); await sleep(500);
for (const s of shots) {
  const tw = TARGET[s.name];
  const b64 = await ev(`(async () => { const img = new Image(); img.src = "data:image/png;base64,${pngs[s.name]}"; await img.decode();
    const tw = ${tw}, th = Math.round(img.naturalHeight * tw / img.naturalWidth); const c = document.getElementById("c"); c.width = tw; c.height = th;
    const x = c.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(img, 0, 0, tw, th);
    const blob = await new Promise(r => c.toBlob(r, "image/webp", 0.82)); if (!blob || blob.type !== "image/webp") return null;
    const u = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s) + "|" + th; })()`);
  if (!b64) die(s.name + ": Chrome would not encode WebP");
  const [enc, th] = b64.split("|");
  const f = join(OUT, s.name + ".webp"); const buf = Buffer.from(enc, "base64");
  if (buf.length >= 200 * 1024) die(s.name + ".webp is " + Math.round(buf.length / 1024) + "KB, over the 200KB budget. Not written.");
  writeFileSync(f, buf);
  console.log("  " + f + "  " + tw + "x" + th + "  " + (statSync(f).size / 1024).toFixed(1) + "KB");
}
ws.close(); chrome.kill(); server.close();
console.log("\n  done. PNGs stay in " + TMP + " and are not committed.");
