#!/usr/bin/env node
// REVIEW_GATE_V1, Phase 2 Step 5 -- the pending state, and what it must NOT touch.
//
// supa docs/review-gate-phase2-spec.md, decisions 4 and 5:
//   4. Failure and retry screens stay unchanged. The pending view is shown only for awaiting_review.
//   5. Pending copy, exact, no em dashes.
// Behaviour (boot, the overdue timer, the slowed poll, the draw form) is exercised on the real app in
// test-first-upload-resume.mjs section C. This file pins the byte-level promises.
//
//   node scripts/test-review-pending.mjs
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const HTML = readFileSync(process.env.DASH || "dashboard.html", "utf8");
let BASE = "";
// Pinned to 8ad205f, the last dashboard.html commit BEFORE Phase 2. Not origin/main: once Phase 2
// is pushed, origin/main IS this file and the comparison would be with itself.
try { BASE = execSync("git show 8ad205f:dashboard.html", { encoding: "utf8", maxBuffer: 64 << 20 }); } catch (_) {}
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };

const HEAD = "Your report is being prepared";
const BODY = "Our team checks every report before you see it during early access. You'll have it within 24 hours, and we'll email you the moment it's ready.";

console.log("P-1  the pending copy, exact");
const view = (HTML.match(/<div id="view-pending" class="hidden">([\s\S]*?)<\/div>/) || [])[1] || "";
ok(view.length > 50, "P-1-CONTROL: #view-pending located");
ok(view.includes("<h1>" + HEAD + "</h1>"), "P-1: headline is exactly the spec's");
ok(view.includes("<p>" + BODY + "</p>"), "P-1: body is exactly the spec's");
ok(!/—|–/.test(view), "P-1: no em or en dash in the view");
ok(!view.includes("<p>" + BODY.replace("24 hours", "a day") + "</p>"), "P-1-MUTANT: a reworded body would not match");

console.log("P-2  the vault pill");
ok(/r\.status === "awaiting_review"\s*\?\s*'<span class="rv-status prep">being prepared<\/span>'/.test(HTML), "P-2: awaiting_review renders the being prepared pill");
ok(/\.rv-status\.prep\{background:var\(--teal-light\);color:var\(--teal-dark\)\}/.test(HTML), "P-2: styled from existing tokens");

console.log("P-3  the pending view is reachable ONLY for awaiting_review");
const sites = [...HTML.matchAll(/showView\("pending"\)/g)].map((m) => HTML.slice(Math.max(0, m.index - 400), m.index));
ok(sites.length === 3, "P-3-CONTROL: three call sites located (boot, pollTick, navigateAfterSubmit): " + sites.length);
const guarded = (pre) => /status === "awaiting_review"/.test(pre) || /rd\.kind === "pending"/.test(pre);
ok(sites.every(guarded), "P-3: every showView(\"pending\") sits behind an awaiting_review or pending-kind check");
const kinds = [...HTML.matchAll(/drawReadyAck\("pending"\)/g)].map((m) => HTML.slice(Math.max(0, m.index - 300), m.index));
ok(kinds.length === 1 && /status === "awaiting_review"/.test(kinds[0]), "P-3: the pending kind is set only inside the awaiting_review branch");
ok(!guarded('if(rep && rep.status === "processing"){'), "P-3-MUTANT: an unguarded site would be caught");

console.log("P-4  pollTick checks awaiting_review BEFORE the overdue bail");
const pt = HTML.slice(HTML.indexOf("async function pollTick("), HTML.indexOf("function pollForResult("));
const iHeld = pt.indexOf('rep.status === "awaiting_review"'), iOver = pt.indexOf("PC_OVERDUE_MS"), iErr = pt.indexOf('rep.status === "error"');
ok(iHeld > 0 && iOver > 0 && iErr > 0, "P-4-CONTROL: all three branches located in pollTick");
ok(iHeld < iOver, "P-4: the held branch runs before the overdue bail, so the 25-minute timer never fires on it");

console.log("P-5  failure and retry screens are byte-identical to 8ad205f (before Phase 2)");
ok(BASE.length > 100000, "P-5-CONTROL: 8ad205f dashboard.html read (" + BASE.length + " bytes)");
// From the signature to the function's own closing brace at column 0. Not to the next function:
// that would sweep in the comment block above it, which is not part of this function.
const fnSrc = (src, name) => { const a = src.indexOf("function " + name + "("); if (a < 0) return ""; const e = src.indexOf("\n}\n", a); return e < 0 ? "" : src.slice(a, e + 2); };
for (const fn of ["pcRenderFailure", "pcRetrySpentFromError", "pcRetryNotPossibleFromError"]) {
  const a = fnSrc(HTML, fn), b = fnSrc(BASE, fn);
  ok(a.length > 100 && a === b, "P-5: " + fn + " unchanged (" + a.length + " chars)");
}
const consts = (src) => [...src.matchAll(/^const (PC_[A-Z0-9_]+) = ([^\n]+)$/gm)].map((m) => m[0]).sort();
const now = consts(HTML).filter((l) => !l.startsWith("const PC_PENDING_POLL_MS")), before = consts(BASE);
ok(before.length >= 8, "P-5-CONTROL: " + before.length + " PC_ constants on 8ad205f");
ok(JSON.stringify(now) === JSON.stringify(before), "P-5: every PC_ copy and threshold constant unchanged (the one new constant is PC_PENDING_POLL_MS)");
{ const f = fnSrc(HTML, "pcRenderFailure"); const m = f.replace("Try this report again", "Try again now");
  ok(m !== f && m !== fnSrc(BASE, "pcRenderFailure"), "P-5-MUTANT: a one-word change inside the failure screen is caught"); }

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
