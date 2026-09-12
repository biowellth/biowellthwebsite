#!/usr/bin/env node
// GATE_EXIT_V1 — the exits from the two blocking gates.
//
// THE DEFECT THIS EXISTS FOR. showAgeModal's "Sign out" and testerGate's "Maybe
// later" both did `try{ await sb.auth.signOut(); }catch(_){}` followed by an
// UNCONDITIONAL location.replace("/login"). Neither read the return value.
//
// login.html:145 is `getSession().then(({data}) => { if (data.session)
// location.replace(APP) })` with APP = "/dashboard". So a session that survives
// the sign-out sends her straight back, the gate re-opens, and the exit control
// appears to do nothing. Not a bypass, since the gates re-evaluate from her
// profile and she has affirmed nothing, but a loop she cannot leave. On the
// under-18 path, where there is no server-side enforcement anywhere.
//
// WHAT MAKES IT REACHABLE, read from the shipped bundle at supabase-js 2.116.0
// rather than assumed from the general case:
//
//   _signOut returns { error } and mostly does NOT throw. admin.signOut catches
//   and returns any __isAuthError, which includes the retryable fetch error a
//   network failure produces. So the empty catch was never the main defect; the
//   ignored return value was.
//
//   Branch (B), a failed server revoke, still calls _removeSession. That is why a
//   plain network failure was survivable.
//
//   Branch (A) is the hole: if reading the session errors and it is not
//   AuthSessionMissingError, it returns WITHOUT removing anything. The
//   lock-acquire path can also genuinely throw, which is why the try stays.
//
// THE FIX IS SHAPE, NOT COPY. scope local so the gate holds on local storage
// alone, the return value read, and NO navigation when the clear failed. If she
// cannot be signed out she stays on the gate with the control live, which is the
// honest outcome and needs no string.
//
// Source-level assertions. Driving the real handlers needs a Supabase client, a
// DOM and a live session. What is pinned here is the shape: scope, the read, and
// that the navigation is guarded. Every check is mutation-proven in the commit.
//
//   node scripts/test-gate-exit.mjs     (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";

const FILE = process.env.DASH || "dashboard.html";
const HTML = readFileSync(FILE, "utf8");
const LOGIN = readFileSync(process.env.LOGIN || "login.html", "utf8");

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m))
                        : (fail++, console.log("  FAIL " + m)));
const eq = (a, b, m) => ok(a === b, m + "  (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")");

// Each handler is sliced from its onclick to the closing of its arrow body. The
// markers are the element ids, which are stable and are what the handler is for.
function handler(marker) {
  const i = HTML.indexOf(marker);
  if (i < 0) throw new Error("handler marker not found: " + marker);
  const end = HTML.indexOf("};", i);
  return HTML.slice(i, end + 2);
}
const AGE = handler('$("age-signout").onclick');
const TESTER = handler("later.onclick = async function()");

console.log("PRECONDITION — the bounce that makes a surviving session matter");
ok(/getSession\(\)\.then\(\(\{ data \}\) => \{ if \(data\.session\) location\.replace\(APP\); \}\)/.test(LOGIN),
   "login.html bounces an existing session to APP");
ok(/const APP = "\/dashboard"/.test(LOGIN), "APP is the dashboard, so the bounce is back into the gate");

for (const [name, SRC] of [["age", AGE], ["tester", TESTER]]) {
  console.log("GATE EXIT — " + name);

  ok(/signOut\(\s*\{\s*scope:\s*["']local["']\s*\}\s*\)/.test(SRC),
     "a: " + name + " signs out with scope local, so the gate holds on local storage alone");

  ok(/res\s*=\s*await sb\.auth\.signOut/.test(SRC),
     "b: " + name + " ASSIGNS the return value instead of discarding it");
  ok(/res && res\.error/.test(SRC),
     "b: " + name + " reads the returned error");

  ok(/catch\s*\(\s*e\s*\)\s*\{\s*threw\s*=\s*e;?\s*\}/.test(SRC),
     "c: " + name + " captures the thrown case, the lock path can genuinely throw");
  ok(!/catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(SRC),
     "c: " + name + " has no bare empty catch left");

  // The guard must RETURN before the navigation, or the fix does nothing.
  const guardIdx = SRC.indexOf("threw || (res && res.error)");
  const returnIdx = SRC.indexOf("return;", guardIdx);
  const navIdx = SRC.indexOf("location.replace", guardIdx);
  ok(guardIdx > 0, "b: " + name + " has the failure guard");
  ok(returnIdx > guardIdx, "b: " + name + " returns inside the guard");
  ok(navIdx > returnIdx,
     "b: " + name + " navigates only AFTER the guard returns, so a failed clear does not navigate");

  // Exactly one navigation, and it is not inside the guard.
  eq((SRC.match(/location\.replace/g) || []).length, 1,
     "b: " + name + " has exactly one navigation");

  ok(/console\.error\("\[gate\] GATE_EXIT_SIGNOUT_FAILED/.test(SRC),
     "b: " + name + " logs the failure with a stable countable string");
  ok(new RegExp("gate=" + name).test(SRC),
     "b: " + name + " log names which gate it was");
}

console.log("NO COPY — a failure state she cannot reach needs no string");
ok(!/PC_|SANA_COPY|textContent\s*=\s*["']/.test(AGE),
   "d: the age exit adds no user-facing string");
ok(!/PC_|SANA_COPY/.test(TESTER), "d: the tester exit adds no new copy constant");
// The tester control is restored so she can press again; the age control was
// never disabled, so there is nothing to restore there.
ok(/later\.disabled = false;/.test(TESTER),
   "d: the tester control is re-enabled on failure so the gate stays usable");

console.log("UNCHANGED — the tester promise contract");
ok(/deliberately never resolves/.test(TESTER),
   "e: the never-resolves contract is preserved, the product must not paint behind a declined gate");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
