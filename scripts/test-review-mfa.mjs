#!/usr/bin/env node
// REVIEWER_MFA_V1 on /review, exercised on the page's REAL script in a vm, against a fake Supabase Auth MFA
// API and a fake review-action that refuses any session below aal2, as the deployed function does. Every
// id, key and code is invented.
//
//   M-1  a signed-in reviewer with no factor gets the enrolment screen (QR and key as text) and NO
//        review-action call is made; control: an aal2 session goes straight to the queue
//   M-2  a reviewer with a verified factor gets the code screen, and nothing is enrolled
//   M-3  an abandoned unverified factor is removed before enrolling; a verified factor is never removed
//   M-4  the code: not six digits never reaches Auth; a wrong code stays on the screen; the right one opens the queue
//   M-5  a 403 mfa_required from the server (queue, detail or an action) returns to the code screen, not
//        "not a reviewer"; control: 403 not_a_reviewer still shows the denied view
//   M-6  the QR is set as an image source: a data URI passes through, raw SVG is encoded into one
//   M-7  signing out clears the key and QR from the page
//   M-8  every check above has a mutant of the page that must fail it
//
//   node scripts/test-review-mfa.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

const PAGE = readFileSync(process.env.REVIEW || "review.html", "utf8");
const JS = (PAGE.match(/<script>\n([\s\S]*?)<\/script>/) || [])[1] || "";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
ok(JS.length > 5000, "CONTROL: the page script located (" + JS.length + " chars)");
ok(/id="view-mfa"/.test(PAGE) && /id="mfa-qr"/.test(PAGE) && /id="mfa-code"/.test(PAGE), "CONTROL: the MFA view, QR and code input exist in the markup");

function mkEl(tag) {
  const cls = new Set(); const kids = []; let text = ""; const on = {};
  return {
    tagName: String(tag || "div").toUpperCase(), dataset: {}, value: "", style: {}, src: "", disabled: false,
    get className() { return [...cls].join(" "); }, set className(v) { cls.clear(); String(v).split(/\s+/).filter(Boolean).forEach((c) => cls.add(c)); },
    classList: { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)),
      toggle: (c, f) => { const o = f === undefined ? !cls.has(c) : !!f; o ? cls.add(c) : cls.delete(c); return o; }, contains: (c) => cls.has(c) },
    get textContent() { return text + kids.map((k) => k.textContent).join(""); },
    set textContent(v) { text = String(v); kids.length = 0; },
    appendChild(k) { kids.push(k); return k; }, get children() { return kids; },
    addEventListener(ev, fn) { on[ev] = fn; }, fire(ev) { return on[ev] && on[ev](); }, querySelectorAll() { return []; },
  };
}

// state.level: "aal1" | "aal2". state.factors: [{ id, factor_type, status }]. state.code: the code that verifies.
function boot(js, state) {
  const ids = {};
  const log = { invoke: [], enroll: 0, unenroll: [], verify: [], signOut: 0 };
  const document = {
    getElementById: (id) => (ids[id] = ids[id] || mkEl("div")),
    createElement: (t) => mkEl(t), createTextNode: (t) => { const n = mkEl("#text"); n.textContent = t; return n; },
    querySelectorAll: () => [], addEventListener() {}, hidden: false,
  };
  const reply = (status, body) => status === 200 ? { data: body, error: null }
    : { data: null, error: { context: { status, json: async () => body } } };
  const sb = {
    functions: { invoke: async (name, { body }) => {
      log.invoke.push(body.action);
      if (state.notReviewer) return reply(403, { ok: false, error: "not_a_reviewer" });
      if (state.serverLevel ? state.serverLevel !== "aal2" : state.level !== "aal2") return reply(403, { ok: false, error: "mfa_required" });
      if (body.action === "queue") return reply(200, { ok: true, items: [], email_configured: true });
      return reply(200, { ok: false, error: "not_found" });
    } },
    auth: {
      getSession: async () => ({ data: { session: state.session === null ? null : { user: {} } } }),
      signInWithPassword: async () => ({}), signOut: async () => { log.signOut++; return {}; },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: state.level, nextLevel: state.factors.some((f) => f.status === "verified") ? "aal2" : "aal1" } }),
        listFactors: async () => ({ data: { all: state.factors, totp: state.factors.filter((f) => f.factor_type === "totp" && f.status === "verified") } }),
        unenroll: async ({ factorId }) => { log.unenroll.push(factorId); state.factors = state.factors.filter((f) => f.id !== factorId); return { data: {} }; },
        enroll: async () => { log.enroll++; const f = { id: "f-new", factor_type: "totp", status: "unverified" }; state.factors.push(f);
          return { data: { id: f.id, type: "totp", totp: { qr_code: state.qr ?? "data:image/svg+xml;utf-8,<svg/>", secret: "INVENTEDKEY234567", uri: "otpauth://x" } } }; },
        challengeAndVerify: async ({ factorId, code }) => { log.verify.push([factorId, code]);
          if (code !== state.code) return { data: null, error: { message: "Invalid TOTP code entered" } };
          state.level = "aal2"; state.serverLevel = null; state.factors.forEach((f) => { if (f.id === factorId) f.status = "verified"; }); return { data: {} }; },
      },
    },
  };
  const ctx = {
    document, console: { log() {}, error() {}, warn() {} }, setTimeout, JSON, Array, String, Number, Math, Object, Promise, Set, Map, Date, RegExp,
    encodeURIComponent, supabase: { createClient: () => sb },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { pathname: "/review", search: "", replace() {} }, addEventListener() {},
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  new vm.Script(js).runInContext(ctx);
  const $ = (id) => document.getElementById(id);
  const visible = () => ["view-login", "view-mfa", "view-denied", "view-queue", "view-detail"].filter((v) => !$(v).classList.contains("hidden"));
  return { ctx, log, state, $, visible, run: (code) => vm.runInContext(code, ctx) };
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0)); };

// Each check takes the page script and returns true when the behaviour holds. Run on the real page it
// must be true; run on its mutant it must be false.
const checks = {
  "M-1 no factor: enrolment screen, no review-action call": async (js) => {
    const b = boot(js, { level: "aal1", factors: [], code: "123456" }); await settle();
    return b.visible().join() === "view-mfa" && !b.$("mfa-enrol").classList.contains("hidden") && b.log.enroll === 1
      && b.$("mfa-secret").textContent === "INVENTEDKEY234567" && b.$("mfa-qr").src.startsWith("data:image/svg+xml") && b.log.invoke.length === 0;
  },
  "M-1-CONTROL aal2 session: straight to the queue": async (js) => {
    const b = boot(js, { level: "aal2", factors: [{ id: "f1", factor_type: "totp", status: "verified" }], code: "123456" }); await settle();
    return b.visible().join() === "view-queue" && b.log.invoke.join() === "queue" && b.log.enroll === 0;
  },
  "M-2 verified factor: code screen, nothing enrolled": async (js) => {
    const b = boot(js, { level: "aal1", factors: [{ id: "f1", factor_type: "totp", status: "verified" }], code: "123456" }); await settle();
    return b.visible().join() === "view-mfa" && b.$("mfa-enrol").classList.contains("hidden") && b.log.enroll === 0
      && b.$("mfa-title").textContent === "Enter your code" && b.log.invoke.length === 0;
  },
  "M-3 abandoned unverified factor removed first; verified never removed": async (js) => {
    const b = boot(js, { level: "aal1", factors: [{ id: "stale", factor_type: "totp", status: "unverified" }], code: "123456" }); await settle();
    const b2 = boot(js, { level: "aal1", factors: [{ id: "keep", factor_type: "totp", status: "verified" }, { id: "stale2", factor_type: "totp", status: "unverified" }], code: "1" }); await settle();
    return b.log.unenroll.join() === "stale" && b.log.enroll === 1 && !b2.log.unenroll.includes("keep");
  },
  "M-4 bad format never reaches Auth; wrong code stays; right code opens the queue": async (js) => {
    const b = boot(js, { level: "aal1", factors: [{ id: "f1", factor_type: "totp", status: "verified" }], code: "246810" }); await settle();
    b.$("mfa-code").value = "12ab"; await b.ctx.verifyMfa(); await settle();
    const fmt = b.log.verify.length === 0 && b.visible().join() === "view-mfa" && /six digits/.test(b.$("mfa-msg").textContent);
    b.$("mfa-code").value = "111111"; await b.ctx.verifyMfa(); await settle();
    const wrong = b.log.verify.length === 1 && b.visible().join() === "view-mfa" && b.log.invoke.length === 0 && b.$("mfa-code").value === "";
    b.$("mfa-code").value = " 246810 "; await b.ctx.verifyMfa(); await settle();
    const right = b.log.verify[1] && b.log.verify[1].join() === "f1,246810" && b.visible().join() === "view-queue" && b.log.invoke.join() === "queue";
    return fmt && wrong && right;
  },
  "M-4b enrol then verify: the NEW factor is the one challenged, and the key leaves the page": async (js) => {
    const b = boot(js, { level: "aal1", factors: [], code: "135790" }); await settle();
    b.$("mfa-code").value = "135790"; await b.ctx.verifyMfa(); await settle();
    return b.log.verify.length === 1 && b.log.verify[0][0] === "f-new" && b.visible().join() === "view-queue" && b.$("mfa-secret").textContent === "" && b.$("mfa-qr").src === "";
  },
  "M-5 server mfa_required on the queue: code screen, not denied": async (js) => {
    // The page believes aal2 (a stale local token), the server says otherwise, then Auth reports aal1.
    const s = { level: "aal2", serverLevel: "aal1", factors: [{ id: "f1", factor_type: "totp", status: "verified" }], code: "1" };
    const b = boot(js, s); await settle();
    s.level = "aal1"; await b.ctx.loadQueue(); await settle();
    return b.visible().join() === "view-mfa" && b.$("mfa-title").textContent === "Enter your code";
  },
  "M-5b server mfa_required on detail and on an action: code screen": async (js) => {
    const s = { level: "aal2", factors: [{ id: "f1", factor_type: "totp", status: "verified" }], code: "1" };
    const b = boot(js, s); await settle();
    s.level = "aal1";
    await b.ctx.openDetail({ report_id: "00000000-0000-4000-8000-00000000000a" }); await settle();
    const d = b.visible().join() === "view-mfa";
    b.run('CURRENT = { report_id: "00000000-0000-4000-8000-00000000000a", staging_id: null, narrative: [] }');
    b.$("view-mfa").classList.add("hidden"); b.$("view-detail").classList.remove("hidden");
    await b.ctx.act("approve"); await settle();
    return d && b.visible().join() === "view-mfa" && !/Not done/.test(b.$("act-msg").textContent);
  },
  "M-5-CONTROL 403 not_a_reviewer still shows the denied view": async (js) => {
    const b = boot(js, { level: "aal2", notReviewer: true, factors: [{ id: "f1", factor_type: "totp", status: "verified" }], code: "1" }); await settle();
    return b.visible().join() === "view-denied";
  },
  "M-6 raw SVG QR is encoded into a data URI": async (js) => {
    const b = boot(js, { level: "aal1", factors: [], code: "1", qr: "<svg xmlns='http://www.w3.org/2000/svg'>#</svg>" }); await settle();
    return b.$("mfa-qr").src === "data:image/svg+xml;utf-8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg'>#</svg>");
  },
  "M-7 sign-out clears the key and QR": async (js) => {
    const b = boot(js, { level: "aal1", factors: [], code: "1" }); await settle();
    const had = b.$("mfa-secret").textContent !== "";
    await b.$("signout").fire("click"); await settle();
    return had && b.$("mfa-secret").textContent === "" && b.$("mfa-qr").src === "" && b.log.signOut === 1;
  },
};

// One mutant per check, each a single located edit to the real page script.
const mutants = {
  "M-1 no factor: enrolment screen, no review-action call": ["async function enterReview(){ if(await startMfa()) loadQueue(); }", "async function enterReview(){ await startMfa(); loadQueue(); }"],
  "M-1-CONTROL aal2 session: straight to the queue": ['if(level && level.currentLevel === "aal2") return true;', 'if(level && level.currentLevel === "aal3") return true;'],
  "M-2 verified factor: code screen, nothing enrolled": ['.filter(f => f.status === "verified");', '.filter(f => f.status === "none");'],
  // The verified branch returns before the clean-up loop, so a mutant that widens the loop cannot reach a verified
  // factor here; M-8 pins that guard in source. This mutant drops the clean-up, which the stale case must catch.
  "M-3 abandoned unverified factor removed first; verified never removed": ["try { await sb.auth.mfa.unenroll({ factorId: f.id }); } catch (_) {}", ""],
  "M-4 bad format never reaches Auth; wrong code stays; right code opens the queue": ["if(!res || res.error){ $(\"mfa-code\").value = \"\";", "if(false){ $(\"mfa-code\").value = \"\";"],
  "M-4b enrol then verify: the NEW factor is the one challenged, and the key leaves the page": ["MFA_FACTOR = res.data.id;", "MFA_FACTOR = \"f-old\";"],
  "M-5 server mfa_required on the queue: code screen, not denied": ["const r = await call({ action: \"queue\" });\n  if(await mfaRefused(r)) return;", "const r = await call({ action: \"queue\" });"],
  "M-5b server mfa_required on detail and on an action: code screen": ["  ([\"approve\",\"edit-approve\",\"escalate\"].forEach(id => $(id).disabled = false);\n  if(await mfaRefused(r)) return;".slice(3), "[\"approve\",\"edit-approve\",\"escalate\"].forEach(id => $(id).disabled = false);"],
  "M-5-CONTROL 403 not_a_reviewer still shows the denied view": ['if(r.status === 403 && r.data && r.data.error === "mfa_required"){', 'if(r.status === 403){'],
  "M-6 raw SVG QR is encoded into a data URI": ['"data:image/svg+xml;utf-8," + encodeURIComponent(q)', '"data:image/svg+xml;utf-8," + q'],
  "M-7 sign-out clears the key and QR": ["SIGNED_IN = false; clearMfa(); await sb.auth.signOut();", "SIGNED_IN = false; await sb.auth.signOut();"],
};

for (const [name, check] of Object.entries(checks)) {
  let real = false; try { real = await check(JS); } catch (e) { real = false; console.log("    threw " + e.message); }
  ok(real, name);
  const [from, to] = mutants[name];
  const count = JS.split(from).length - 1;
  ok(count === 1, "  MUTANT anchor for " + name.split(" ")[0] + " located exactly once (" + count + ")");
  let mut = true; try { mut = await check(JS.replace(from, to)); } catch (_) { mut = false; }
  ok(count === 1 && mut === false, "  MUTANT for " + name.split(" ")[0] + " fails the check");
}

console.log("M-8  source rules");
const unenrollAt = JS.indexOf("sb.auth.mfa.unenroll("), guard = JS.lastIndexOf('f.status !== "verified"', unenrollAt);
ok(unenrollAt > 0 && guard > 0 && unenrollAt - guard < 60, "M-8: the only unenroll call sits inside the not-verified guard");
ok((JS.match(/mfa\.unenroll\(/g) || []).length === 1, "M-8: exactly one unenroll call site");
ok(!/innerHTML/.test(JS), "M-8: still no innerHTML (the QR goes in as an image source)");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
