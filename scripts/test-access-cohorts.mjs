#!/usr/bin/env node
// ACCESS_COHORTS_V1 — the free-days line, the ended state, the upload preflight and the 402.
//
// Two kinds of check:
//   BEHAVIOUR  accessLineText, accessEndedMarkup and pcIsEntitlementRefusal are lifted out of
//              dashboard.html and run, over every bw_entitlement state for BOTH cohorts.
//   SHAPE      the preflight sits before consent, storage and the row insert; the 402 branch
//              never polls; an unreadable entitlement blocks nothing; the copy obeys the tone
//              rules; the pending-screen copy and the review terms are untouched.
//
//   node scripts/test-access-cohorts.mjs     (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

function extract(name) {
  const re = new RegExp("(?:async\\s+)?function\\s+" + name + "\\s*\\(", "g");
  const m = re.exec(HTML);
  if (!m) throw new Error("not found in " + FILE + ": " + name);
  let i = HTML.indexOf("{", m.index), depth = 0, end = -1;
  for (let j = i; j < HTML.length; j++) {
    if (HTML[j] === "{") depth++;
    else if (HTML[j] === "}") { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  return HTML.slice(m.index, end);
}
function constBlock(name) {
  const i = HTML.indexOf("const " + name + " = {");
  if (i < 0) throw new Error("const not found: " + name);
  const end = HTML.indexOf("};", i) + 2;
  return HTML.slice(i, end);
}

const ctx = vm.createContext({ window: {} });
vm.runInContext([
  extract("esc"), constBlock("ACCESS_ENDED_COPY"), extract("accessLineText"),
  extract("accessEndedMarkup"), extract("pcIsEntitlementRefusal"),
  "this.accessLineText = accessLineText; this.accessEndedMarkup = accessEndedMarkup;",
  "this.pcIsEntitlementRefusal = pcIsEntitlementRefusal; this.ACCESS_ENDED_COPY = ACCESS_ENDED_COPY;",
].join("\n"), ctx);
const { accessLineText, accessEndedMarkup, pcIsEntitlementRefusal, ACCESS_ENDED_COPY } = ctx;

console.log("BEHAVIOUR, the top bar line, every state x both cohorts");
const E = (state, cohort, extra = {}) => ({ state, cohort, free_days: cohort === "early_access" ? 60 : 14, ...extra });
eq(accessLineText(E("trial_not_started", "early_access")), "Founding access, 60 days from your first report", "EA not started");
eq(accessLineText(E("trial_not_started", "standard")), "Free trial, 14 days from your first report", "STD not started");
eq(accessLineText(E("trial_active", "early_access", { days_left: 42 })), "Founding access, 42 days left", "EA active 42");
eq(accessLineText(E("trial_active", "standard", { days_left: 9 })), "Free trial, 9 days left", "STD active 9");
eq(accessLineText(E("trial_active", "early_access", { days_left: 1 })), "Founding access, 1 day left", "EA singular");
eq(accessLineText(E("trial_active", "standard", { days_left: 1 })), "Free trial, 1 day left", "STD singular");
eq(accessLineText(E("active", "early_access")), "", "EA paid says nothing");
eq(accessLineText(E("active", "standard")), "", "STD paid says nothing");
eq(accessLineText(E("expired", "early_access")), "Founding access ended", "EA expired");
eq(accessLineText(E("expired", "standard")), "Free trial ended", "STD expired");
eq(accessLineText(null), "", "unknown says nothing");
eq(accessLineText({ state: "mystery", cohort: "standard" }), "", "unrecognised state says nothing");
eq(accessLineText(E("trial_active", "standard", { days_left: null })), "", "active with no days_left says nothing rather than NaN");

console.log("BEHAVIOUR, the ended state differs by cohort");
const ea = accessEndedMarkup("early_access", false), st = accessEndedMarkup("standard", true);
ok(ea.includes("<h1>Your past reports are still here.</h1>") && ea.includes("<p>As a founding member, you'll be offered a founding price to continue.</p>"), "EA ended copy verbatim (2026-10-12 brief)");
ok(!ea.includes("saved for you"), "EA superseded 'founding price is saved' promise is gone");
ok(!ea.includes("free trial"), "EA copy never says free trial");
ok(st.includes("Your free trial has ended.") && st.includes("Your past reports are still here."), "STD ended copy verbatim");
ok(!st.includes("founding"), "STD copy never mentions founding");
ok(!ea.includes("access-ended-back") && st.includes("access-ended-back"), "Back control only when a panel is on screen");
eq(accessEndedMarkup(null, false), accessEndedMarkup("standard", false), "unknown cohort falls back to the standard copy, never the founding promise");

console.log("BEHAVIOUR, the 402 render says 'nothing was kept' ONLY when the server says so");
{
  const view = { innerHTML: "" };
  const g = vm.createContext({ window: {}, $: (id) => (id === "view-processing" ? view : null), __pcProcMarkup: null });
  vm.runInContext("var __pcProcMarkup = null;\n" + extract("esc") + "\n" +
    HTML.slice(HTML.indexOf("const ACCESS_402_COPY = "), HTML.indexOf("function pcRenderAccessEnded(")) +
    extract("pcRenderAccessEnded") + "\nthis.render = pcRenderAccessEnded; this.discarded = pcEntitlementDiscarded;", g);
  const H = "We couldn't add this report because your free access has ended.", K = "Nothing from this upload was kept.";
  g.render(true);  ok(view.innerHTML.includes(H) && view.innerHTML.includes(K), "discarded true: both sentences");
  g.render(false); ok(view.innerHTML.includes(H) && !view.innerHTML.includes(K), "discarded false: no 'nothing was kept' claim");
  g.render(undefined); ok(!view.innerHTML.includes(K), "discarded unknown: no claim");
  for (const t of [H, K]) ok(!/[:\u2014\u2013]/.test(t), "tone ok: " + t);
  const resp = (body) => ({ context: { clone() { return this; }, json: async () => body } });
  eq(await g.discarded(resp({ discarded: true })), true, "body discarded:true reads true");
  eq(await g.discarded(resp({ discarded: false })), false, "body discarded:false reads false");
  eq(await g.discarded(resp({})), false, "missing flag reads false");
  eq(await g.discarded({ context: { clone() { return this; }, json: async () => { throw new Error("used"); } } }), false, "unreadable body reads false");
  eq(await g.discarded(null), false, "no error reads false");
}

console.log("BEHAVIOUR, 402 detection");
eq(pcIsEntitlementRefusal({ context: { status: 402 } }), true, "402 is an entitlement refusal");
eq(pcIsEntitlementRefusal({ context: { status: 429 } }), false, "429 is not");
eq(pcIsEntitlementRefusal({ message: "Failed to fetch" }), false, "network failure is not");
eq(pcIsEntitlementRefusal(null), false, "no error is not");

console.log("COPY, tone rules (no colons, no em dashes) and placeholder marking");
const allCopy = [...Object.values(ACCESS_ENDED_COPY).flat(),
  ...["trial_not_started", "trial_active", "expired"].flatMap((s) => ["early_access", "standard"].map((c) => accessLineText(E(s, c, { days_left: 5 }))))];
for (const t of allCopy) ok(!/[:—–]/.test(t), "tone ok: " + t);
ok(/PLACEHOLDER COPY/.test(extract("loadEntitlement") + HTML.slice(HTML.indexOf("ACCESS_COHORTS_V1 — free days left"), HTML.indexOf("let ENTITLEMENT = null;"))), "copy block is marked PLACEHOLDER");
ok(!/doctor|medical|clinician/i.test(allCopy.join(" ")), "no medical framing in the new copy");

console.log("SHAPE, preflight before any write");
const HF = extract("handleFile");
const pre = HF.indexOf("await loadEntitlement();");
ok(pre > 0, "handleFile re-reads entitlement");
ok(HF.indexOf("if(entitlementExpired()) return;") > pre, "and returns when ended");
ok(pre < HF.indexOf("mountAboutDraw("), "before the About block mounts");
ok(pre < HF.indexOf("recordCoreConsent()"), "before consent is recorded");
ok(pre < HF.indexOf('sb.storage.from("reports").upload'), "before the storage upload");
ok(pre < HF.indexOf('sb.from("reports")'), "before the reports insert");

console.log("SHAPE, the 402 branch");
const b402 = HF.indexOf("pcIsEntitlementRefusal(__prRes.error)");
ok(b402 > 0, "upload path checks for 402");
const after = HF.slice(b402, HF.indexOf("return;", b402));
ok(after.includes("pcRenderAccessEnded(__discarded)") && after.includes('showView("processing")'), "402 renders the 402 state");
ok(after.indexOf("pcEntitlementDiscarded(__prRes.error)") >= 0 && after.indexOf("pcEntitlementDiscarded(") < after.indexOf("pcRenderAccessEnded("),
  "the discarded flag is read from the response before rendering");
ok(HF.indexOf("return;", b402) < HF.indexOf("pollForResult(reportId)"), "402 returns before any poll");
ok(b402 > HF.indexOf("pcIsQuotaRefusal(__prRes.error)") && b402 < HF.indexOf("if(__prThrew || !__prRes || __prRes.error)"),
  "402 sits between the quota branch and the generic failure branch");

console.log("SHAPE, unknown blocks nothing");
const LE = extract("loadEntitlement");
ok(/catch\(_\)\{ next = null; \}/.test(LE) && LE.includes("ENTITLEMENT = next;"), "a failed read leaves ENTITLEMENT null");
{
  const g = vm.createContext({});
  vm.runInContext("var ENTITLEMENT = null;\n" + extract("entitlementExpired") + "\nthis.f = entitlementExpired; this.set = (v)=>{ ENTITLEMENT = v; };", g);
  for (const [v, want, m] of [
    [null, false, "null (unreadable) does not block"],
    [{ state: "trial_active" }, false, "trial_active does not block"],
    [{ state: "trial_not_started" }, false, "trial_not_started does not block"],
    [{ state: "active" }, false, "active does not block"],
    [{ state: "mystery" }, false, "an unrecognised state does not block"],
    [{ state: "expired", cohort: "early_access" }, true, "expired early_access blocks"],
    [{ state: "expired", cohort: "standard" }, true, "expired standard blocks"],
  ]) { g.set(v); eq(g.f(), want, m); }
}
ok(LE.includes('sb.rpc("bw_my_entitlement")') && !/bw_entitlement\(/.test(HTML.replace(/bw_my_entitlement/g, "")),
  "reads only bw_my_entitlement, never the service-role bw_entitlement");
ok(/await loadEntitlement\(\);[^\n]*ACCESS_COHORTS_V1/.test(HTML), "boot loads entitlement");

console.log("GUARDS, things this change must not touch");
ok(HTML.includes("During early access, every report is reviewed for accuracy by our health team before it's released to you."), "pending-screen copy intact");
ok(HTML.includes('const PC_QUOTA_BODY = "We have not started reading this one, so nothing is in progress. Come back tomorrow and upload it again.";'), "quota copy intact");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
