#!/usr/bin/env node
// SCAN_CHIP_CONSENT_V1 -- tapping the face scan chip without Sana consent asks for consent
// instead of doing nothing.
//
// THE DEFECT. The chip renders for every woman and calls openFaceScan, whose first line returned
// false when there was no consent. A woman who had never agreed tapped it and nothing happened.
//
// SHAPE. The real sanaConsentGranted, sanaAskConsent, renderScanEntry, scanAskConsent and
// openFaceScan are cut from the shipped app block and run in node:vm against a stub DOM. The chip
// handler calls items[idx].action() with no arguments and that action IS openFaceScan (both pinned
// statically below), so each case calls openFaceScan() exactly as a chip tap does.
//   NO CONSENT, TAP   -> the consent card renders and is scrolled into view; nothing minted or opened
//   AGREE             -> openFaceScan reaches the open step; #scan-entry and #btn-scan lose hidden
//   DECLINE           -> the existing declined note; no token minted; nothing opened
//   ALREADY GRANTED   -> straight to the open step, no card
//   NOTICE PENDING    -> the existing pending note, no card, nothing minted
//   MUTANT            -> the fix removed: a tap without consent renders no card, so NO CONSENT fails
// Every fixture is synthetic.
//
//   node scripts/test-scan-chip-consent.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const APP = extractApp(readFileSync(FILE, "utf8"), FILE);

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = () => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); };

// Cut one top-level function by matching braces, skipping strings, template literals and comments.
function cut(src, header) {
  const at = src.indexOf(header);
  if (at < 0 || src.indexOf(header, at + 1) >= 0) throw new Error("cut: expected exactly one " + JSON.stringify(header));
  let i = src.indexOf("{", at), depth = 0;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { i = src.indexOf("\n", i); continue; }
    if (c === "/" && n === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (c === '"' || c === "'" || c === "`") { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error("cut: unbalanced " + header);
}

const FIX = "const askedNow = !(await sanaConsentGranted());\n  if(askedNow && !(await scanAskConsent())) return false;";

console.log("STATIC -- the chip, the handler and the fix are where this suite expects them");
const RC = cut(APP, "function renderCompanionChips(");
ok(/items\.unshift\(\{ q: SANA_COPY\.scanLabel\.action, action: openFaceScan \}\);/.test(RC), "SCC-1: the chip's action is openFaceScan itself");
ok(/if\(items\[idx\]\.action\)\{ items\[idx\]\.action\(\); return; \}/.test(RC), "SCC-2: a chip tap calls that action with no arguments");
eq(APP.split(FIX).length - 1, 1, "SCC-3: openFaceScan runs the consent flow when consent is missing");
const OFS = cut(APP, "async function openFaceScan(");
ok(OFS.indexOf(FIX) < OFS.indexOf("if(!(await sanaConsentGranted())) return false;") &&
   OFS.indexOf("if(!(await sanaConsentGranted())) return false;") < OFS.indexOf("sanaAccessToken"),
   "SCC-4: the original gate still stands as the second gate, before any token");
ok(/if\(SANA_CONSENT_STATE !== true\) return false;/.test(OFS) &&
   OFS.indexOf("if(SANA_CONSENT_STATE !== true) return false;") < OFS.indexOf("sanaAccessToken"),
   "SCC-5: and the cached state must be exactly true before a token is minted");
ok(APP.indexOf("SCAN_CHIP_CONSENT_V1") > -1, "SCC-6: the change token marks the site");
let SAC = "";
try { SAC = cut(APP, "async function scanAskConsent("); } catch (e) { ok(false, "SCC-0: the consent helper scanAskConsent exists  (" + e.message + ")"); done(); }
ok(!/"[A-Z][a-z]+ [a-z]/.test(SAC), "SCC-7: the consent helper introduces no user-facing string literal");
ok(/SANA_COPY\.consentPending/.test(SAC) && /SANA_COPY\.consentDeclined/.test(SAC), "SCC-8: it uses the existing pending and declined copy");

const FNS = (src) => ["async function sanaConsentGranted(", "async function renderScanEntry(", "function sanaAskConsent(",
  "async function scanAskConsent(", "async function openFaceScan("].map((h) => cut(src, h)).join("\n\n");

function makeDom() {
  const els = {}; const scrolled = [];
  const mk = (id, classes = []) => {
    const cls = new Set(classes); let html = "";
    const el = {
      id, textContent: "", onclick: null, disabled: false, children: [], className: "",
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
      get innerHTML() { return html; },
      set innerHTML(v) { html = String(v); for (const m of html.matchAll(/id="([^"]+)"/g)) els[m[1]] = mk(m[1]); },
      appendChild(c) { this.children.push(c); return c; },
      scrollIntoView(o) { scrolled.push([id || "(note)", o]); },
    };
    if (id) els[id] = el;
    return el;
  };
  mk("sana-consent"); mk("sana-thread");
  mk("scan-entry", ["scan-entry", "hidden"]); mk("scan-intro"); mk("scan-go");
  mk("btn-scan", ["btn-ghost", "hidden"]);
  return { els, mk, scrolled };
}

// mode: "none" (no consent row) or "granted" (a v4 grant on record). approved: the notice flag.
async function run(src, { mode = "none", answer = null, approved = true, width = 1440 } = {}) {
  const dom = makeDom();
  const log = { minted: 0, opened: [], assigned: [], stamped: [] };
  const ctx = vm.createContext({ dom, log, mode, approved, width, console });
  vm.runInContext(`
    const els = dom.els;
    let SANA_CONSENT_STATE = null;
    const SANA_CONSENT_V4_ENABLED = true;
    const SANA_CONSENT_TEXT_APPROVED = approved;
    let SANA_CONSENT_MOUNT_ID = "sana-consent";
    const SCAN_ORIGIN = "https://scan.example";
    const SANA_COPY = { consentTitle: "t", consentAgree: "yes", consentDecline: "no", consentFailed: "failed",
      consentPending: "PENDING_NOTE", consentDeclined: "DECLINED_NOTE", expired: "EXPIRED_NOTE",
      scanIntro: "intro", scanLabel: { action: "go", nav: "nav" } };
    const $ = (id) => els[id] || null;
    const esc = (s) => String(s);
    const document = { createElement: () => dom.mk(null) };
    const window = { innerWidth: width, matchMedia: () => ({ matches: false }), open: (u, t, f) => { log.opened.push([u, t, f]); return null; } };
    const location = { assign: (u) => log.assigned.push(u) };
    const sanaConsentBody = () => "body";
    function sanaNote(n, text){ n.textContent = text; }
    async function sanaStampConsent(a){ log.stamped.push(a); return true; }
    async function sanaAccessToken(){ log.minted++; return "TOKEN"; }
    const sb = { from: () => { const q = { select: () => q, eq: () => q, order: () => q,
      limit: async () => ({ data: mode === "granted" ? [{ action: "granted", occurred_at: "2026-10-01", consent_version: "v4" }] : [], error: null }) }; return q; } };
    ${FNS(src)}
    globalThis.tap = () => openFaceScan();          // exactly what the chip handler does
  `, ctx);
  let result = "pending";
  const p = ctx.tap().then((v) => { result = v; });
  const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  await settle();
  const mount = dom.els["sana-consent"];
  const card = { shown: mount.classList.contains("show"), html: /sana-consent-card/.test(mount.innerHTML),
                 scrolled: dom.scrolled.some(([id, o]) => id === "sana-consent" && o && o.block === "center") };
  if (answer === "yes") await dom.els["sana-consent-yes"].onclick();
  if (answer === "no") await dom.els["sana-consent-no"].onclick();
  await settle(); if (answer) await p;
  const notes = dom.els["sana-thread"].children.map((n) => n.textContent);
  return { card, result, notes, log, entryHidden: dom.els["scan-entry"].classList.contains("hidden"),
           navHidden: dom.els["btn-scan"].classList.contains("hidden") };
}

const T = await run(APP, {});
const A = await run(APP, { answer: "yes" });
const D = await run(APP, { answer: "no" });
const G = await run(APP, { mode: "granted" });
const P = await run(APP, { approved: false });
const M = await run(APP.replace(FIX, "const askedNow = false;"), {});

console.log("\nNO CONSENT, TAP -- the consent card renders where she can see it");
ok(T.card.shown && T.card.html, "SCC-9: a chip tap without consent renders the consent card");
ok(T.card.scrolled, "SCC-10: and scrolls it to the centre of the view");
eq(T.log.minted, 0, "SCC-11: no token is minted while the card is open");
ok(T.log.opened.length === 0 && T.log.assigned.length === 0, "SCC-12: nothing is opened while the card is open");

console.log("\nAGREE -- the open step, and the entry points appear");
eq(A.log.stamped.join(), "granted", "SCC-13: one grant was stamped");
eq(A.log.minted, 1, "SCC-14: one token is minted after the grant");
ok(A.log.assigned.length === 1 && A.log.assigned[0] === "https://scan.example/index-scan.html#TOKEN",
   "SCC-15: openFaceScan reaches the open step, in the same tab  (" + JSON.stringify(A.log.assigned) + ")");
eq(A.log.opened.length, 0, "SCC-16: no popup after a consent tap, so nothing can be silently blocked");
eq(A.result, true, "SCC-17: openFaceScan resolves true");
eq(A.entryHidden, false, "SCC-18: #scan-entry loses hidden");
eq(A.navHidden, false, "SCC-19: #btn-scan loses hidden");

console.log("\nDECLINE -- the existing note, and nothing else");
ok(D.notes.includes("DECLINED_NOTE"), "SCC-20: the declined note is shown  (" + JSON.stringify(D.notes) + ")");
eq(D.log.minted, 0, "SCC-21: no token is minted");
ok(D.log.opened.length === 0 && D.log.assigned.length === 0, "SCC-22: nothing is opened");
eq(D.log.stamped.length, 0, "SCC-23: nothing is stamped");
eq(D.result, false, "SCC-24: openFaceScan resolves false");
ok(D.entryHidden && D.navHidden, "SCC-25: the scan entry points stay hidden");

console.log("\nALREADY GRANTED -- straight to the open step");
ok(!G.card.shown && !G.card.html, "SCC-26: no consent card");
eq(G.log.minted, 1, "SCC-27: one token is minted");
ok(G.log.opened.length === 1 && G.log.opened[0][1] === "_blank" && G.log.opened[0][2] === "noopener" && G.log.assigned.length === 0,
   "SCC-28: on a desktop it takes the unchanged window.open path  (" + JSON.stringify(G.log.opened) + ")");

console.log("\nNOTICE PENDING -- the existing pending note, no card");
ok(P.notes.includes("PENDING_NOTE") && !P.card.shown, "SCC-29: the pending note is shown and no card renders");
ok(P.log.minted === 0 && P.log.opened.length === 0 && P.log.assigned.length === 0, "SCC-30: nothing is minted or opened");

console.log("\nMUTANT -- the fix removed");
ok(!M.card.shown && !M.card.html, "SCC-31: without the fix a tap renders no card, so SCC-9 fails on it");
ok(M.notes.length === 0 && M.log.opened.length === 0 && M.log.assigned.length === 0,
   "SCC-32: and nothing else happens either, which is the reported defect");

done();
