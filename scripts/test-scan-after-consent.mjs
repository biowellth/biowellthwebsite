#!/usr/bin/env node
// SCAN_AFTER_CONSENT_V1 -- the face scan entry appears as soon as a woman agrees to Sana, not
// only after a reload.
//
// THE DEFECT. renderScanEntry gates itself on sanaConsentGranted and ran only at mount, from
// sanaMountChat. For a woman who had not agreed yet, that one run read "not granted" and returned
// with #scan-entry and #btn-scan still hidden. sanaAskConsent's yes handler then set
// SANA_CONSENT_STATE = true and closed, and nothing ran renderScanEntry again, so the entry stayed
// hidden until the page was reloaded.
//
// SHAPE. The three real functions (sanaConsentGranted, renderScanEntry, sanaAskConsent) are cut
// out of the shipped app block and run in node:vm against a stub DOM. Each run first does the
// mount-time renderScanEntry with no consent on record, then answers the consent card.
//   GRANTED   yes, server accepts  -> #scan-entry and #btn-scan lose "hidden"
//   DECLINED  no                   -> both stay hidden
//   FAILED    yes, server refuses  -> both stay hidden (the gate is not bypassed)
//   MUTANT    the shipped file with the new call removed, GRANTED again -> stays hidden, which
//             proves GRANTED passes because of the fix and not because of the harness
// Every fixture is synthetic.
//
//   node scripts/test-scan-after-consent.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { extractApp } from "./lib/extract-app.mjs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");
const APP = extractApp(HTML, FILE);

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");
const done = () => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); };

// Cut one top-level function out of the app source by matching braces, skipping strings,
// template literals, regex-free comments. Throws if the function is not found exactly once.
function cut(src, header) {
  const at = src.indexOf(header);
  if (at < 0 || src.indexOf(header, at + 1) >= 0) throw new Error("cut: expected exactly one " + JSON.stringify(header));
  let i = src.indexOf("{", at), depth = 0;
  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/") { i = src.indexOf("\n", i); continue; }
    if (c === "/" && n === "*") { i = src.indexOf("*/", i) + 1; continue; }
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(at, i + 1);
  }
  throw new Error("cut: unbalanced " + header);
}

const FIX_LINE = "if(ok){ SANA_CONSENT_STATE = true; renderScanEntry(); close(true); }";
const OLD_LINE = "if(ok){ SANA_CONSENT_STATE = true; close(true); }";

console.log("STATIC -- the call is where the change token says it is");
eq(APP.split(FIX_LINE).length - 1, 1, "SC-1: the yes handler calls renderScanEntry once, right after the state flips");
eq(APP.split(OLD_LINE).length - 1, 0, "SC-2: the old handler line is gone");
ok(!/await\s+renderScanEntry\(\)/.test(cut(APP, "function sanaAskConsent(")), "SC-3: the call is bare, never awaited");
ok(APP.indexOf("SCAN_AFTER_CONSENT_V1") > -1, "SC-4: the change token marks the site");

const FNS = (src) => [cut(src, "async function sanaConsentGranted("), cut(src, "async function renderScanEntry("),
                      cut(src, "function sanaAskConsent(")].join("\n\n");

// A stub element: an id, a class list, text, an onclick slot and a disabled flag. Setting
// innerHTML registers every id="..." it contains as a fresh element, which is all the consent
// card needs (its buttons and message are looked up by id right after).
function makeDom() {
  const els = {};
  const mk = (id, classes = []) => {
    const cls = new Set(classes);
    let html = "";
    const el = {
      id, textContent: "", onclick: null, disabled: false,
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
      get innerHTML() { return html; },
      set innerHTML(v) { html = String(v); for (const m of html.matchAll(/id="([^"]+)"/g)) els[m[1]] = mk(m[1]); },
    };
    els[id] = el;
    return el;
  };
  mk("sana-consent-mount");
  mk("scan-entry", ["scan-entry", "hidden"]);
  mk("scan-intro"); mk("scan-go");
  mk("btn-scan", ["nav-link", "hidden"]);
  return els;
}

async function run(src, answer) {
  const els = makeDom();
  const ctx = vm.createContext({ els, answer, console });
  vm.runInContext(`
    let SANA_CONSENT_STATE = null;
    const SANA_CONSENT_V4_ENABLED = true;
    const SANA_CONSENT_MOUNT_ID = "sana-consent-mount";
    const SANA_COPY = { consentTitle: "t", consentAgree: "yes", consentDecline: "no", consentFailed: "failed",
                        scanIntro: "intro", scanLabel: { action: "go", nav: "nav" } };
    const $ = (id) => els[id] || null;
    const esc = (s) => String(s);
    const sanaConsentBody = () => "body";
    function openFaceScan(){ throw new Error("openFaceScan must never run in this test"); }
    // No consent row on record, which is the woman this fix is for.
    const sb = { from: () => { const q = { select: () => q, eq: () => q, order: () => q,
                                          limit: async () => ({ data: [], error: null }) }; return q; } };
    let stamped = [];
    async function sanaStampConsent(a){ stamped.push(a); return answer === "granted"; }
    ${FNS(src)}
    globalThis.drive = async () => {
      await renderScanEntry();                         // mount time, before she has agreed
      const atMount = { entry: els["scan-entry"].classList.contains("hidden"),
                        nav: els["btn-scan"].classList.contains("hidden") };
      let resolved = "pending";
      const p = sanaAskConsent().then((v) => { resolved = v; });
      const hit = answer === "declined" ? els["sana-consent-no"] : els["sana-consent-yes"];
      await hit.onclick();
      for (let i = 0; i < 20; i++) await Promise.resolve();   // let the unawaited render settle
      return { atMount, resolved, stamped, state: SANA_CONSENT_STATE,
               entryHidden: els["scan-entry"].classList.contains("hidden"),
               navHidden: els["btn-scan"].classList.contains("hidden"),
               wired: els["scan-go"].onclick === openFaceScan && els["btn-scan"].onclick === openFaceScan };
    };`, ctx);
  return ctx.drive();
}

const G = await run(APP, "granted");
const D = await run(APP, "declined");
const F = await run(APP, "failed");
const M = await run(APP.replace(FIX_LINE, OLD_LINE), "granted");

console.log("\nMOUNT -- every run starts from the state the bug left her in");
for (const [n, r] of [["GRANTED", G], ["DECLINED", D], ["FAILED", F], ["MUTANT", M]])
  ok(r.atMount.entry && r.atMount.nav, "SC-5 " + n + ": at mount, with no consent on record, the entry and nav link are hidden");

console.log("\nGRANTED -- the entry appears without a reload");
eq(G.resolved, true, "SC-6: the consent card resolves true");
eq(G.stamped.join(), "granted", "SC-7: one grant was stamped");
eq(G.entryHidden, false, "SC-8: #scan-entry loses hidden");
eq(G.navHidden, false, "SC-9: #btn-scan loses hidden");
ok(G.wired, "SC-10: both controls are wired to openFaceScan, as a reference and not a call");

console.log("\nDECLINED -- nothing appears");
eq(D.resolved, false, "SC-11: the consent card resolves false");
eq(D.stamped.length, 0, "SC-12: nothing was stamped");
eq(D.entryHidden, true, "SC-13: #scan-entry stays hidden");
eq(D.navHidden, true, "SC-14: #btn-scan stays hidden");

console.log("\nFAILED -- the server refused the grant, so nothing appears");
eq(F.resolved, "pending", "SC-15: the card stays open for a retry");
eq(F.state, false, "SC-16: the cached consent state is still false");
eq(F.entryHidden, true, "SC-17: #scan-entry stays hidden");
eq(F.navHidden, true, "SC-18: #btn-scan stays hidden");

console.log("\nMUTANT -- the call removed, GRANTED again");
eq(M.resolved, true, "SC-19: the mutant still resolves true, so only the render differs");
eq(M.entryHidden, true, "SC-20: #scan-entry stays hidden without the fix, so SC-8 is caused by it");

done();
