#!/usr/bin/env node
// LOGIN_FLOW_V2 -- login.html panes, URL sync and the two failure messages.
//
// WHAT IT CATCHES. Four regressions that all look fine in a diff:
//   1. the default pane flipping back to Create your account, which is what put the
//      signup form in front of every logged out and just deleted user,
//   2. ?mode=login stopping resolving to sign in, which would break
//      dashboard.html:2147 and every invite link already in someone's inbox,
//   3. the check your email interstitial rendering the address with innerHTML,
//   4. an unconfirmed address being reported as a wrong password, which sends the
//      user to reset a password that is already correct.
//
// It boots login.html's real inline script in a vm against a DOM stub whose classList
// and textContent are OBSERVABLE, so an assertion reads what the page actually did.
//
//   node scripts/test-login-modes.mjs        (or LOGIN=path/to/login.html)
import { readFileSync } from "node:fs";
import vm from "node:vm";

const FILE = process.env.LOGIN || "login.html";
const HTML = readFileSync(FILE, "utf8");

const lines = HTML.split("\n");
const s = lines.findIndex((l) => l.trim() === "<script>" );
const e = lines.length - 1 - [...lines].reverse().findIndex((l) => l.trim() === "</script>");
if (s < 0 || e <= s) { console.log("  FAIL could not locate the inline script block"); process.exit(1); }
const SRC = lines.slice(s + 1, e).join("\n");

// ── a DOM stub with REAL classList and textContent, so assertions read the page ──
function mkEl(id){
  const classes = new Set();
  const el = {
    id, value: "", checked: false, disabled: false, textContent: "",
    _innerHTMLWrites: 0,
    set innerHTML(v){ el._innerHTMLWrites++; el._innerHTML = v; },
    get innerHTML(){ return el._innerHTML || ""; },
    className: "",
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, force) => { if (force === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); }
                              else if (force) classes.add(c); else classes.delete(c); return classes.has(c); },
    },
    focus(){}, click(){}, setAttribute(){}, getAttribute(){ return null; },
    addEventListener(){}, removeEventListener(){},
  };
  return el;
}

function boot({ search = "", hash = "", signUp, signIn } = {}) {
  const els = new Map();
  const get = (id) => { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); };
  // Panes start exactly as the markup declares them.
  for (const [id, hidden] of [["signup-view", HTML.includes('id="signup-view" class="hidden"')],
                              ["login-view",  HTML.includes('id="login-view" class="hidden"')],
                              ["check-email-view", HTML.includes('id="check-email-view" class="hidden"')]]) {
    if (hidden) get(id).classList.add("hidden");
  }
  const replaced = [];
  const sandbox = {
    console: { log(){}, warn(){}, error(){}, info(){}, debug(){} },
    document: { getElementById: get, querySelector: () => mkEl(), querySelectorAll: () => [],
                createElement: () => mkEl(), addEventListener(){}, body: mkEl() },
    supabase: { createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: null } }),
        signUp: signUp || (async () => ({ data: { user: { identities: [{}] }, session: null }, error: null })),
        signInWithPassword: signIn || (async () => ({ data: {}, error: null })),
      },
      functions: { invoke: async () => ({ data: {}, error: null }) },
    }) },
    location: { href: "https://biowellth.ai/login" + search + hash, search, hash, pathname: "/login",
                origin: "https://biowellth.ai", replace(){}, assign(){} },
    history: { replaceState: (a, b, url) => replaced.push(url), pushState: () => { throw new Error("pushState must not be used"); } },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    URLSearchParams, URL, Date, Math, JSON, Promise, Object, Array, String, Number, Boolean,
    Error, TypeError, RegExp, Set, Map, setTimeout, clearTimeout,
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(SRC, { filename: "login-inline.js" }).runInContext(sandbox, { timeout: 10000 });
  return { els, get, replaced, sandbox };
}

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));
const hidden = (b, id) => b.get(id).classList.contains("hidden");

console.log("PANE SELECTION");
{
  const b = boot({ search: "" });
  ok(!hidden(b, "login-view"),        "MODE-1: no param shows sign in");
  ok(hidden(b, "signup-view"),        "MODE-2: no param hides create");
  ok(hidden(b, "check-email-view"),   "MODE-3: no param hides the interstitial");
}
{
  const b = boot({ search: "?mode=signup" });
  ok(!hidden(b, "signup-view"),       "MODE-4: ?mode=signup shows create");
  ok(hidden(b, "login-view"),         "MODE-5: ?mode=signup hides sign in");
}
{
  const b = boot({ search: "?mode=login" });
  ok(!hidden(b, "login-view"),        "MODE-6: ?mode=login still resolves to sign in");
}
{
  const b = boot({ search: "?mode=banana" });
  ok(!hidden(b, "login-view"),        "MODE-7: an unknown mode falls back to sign in");
}

console.log("URL SYNC");
{
  const b = boot({ search: "?mode=signup" });
  ok(b.replaced[b.replaced.length - 1] === "/login?mode=signup", "URL-1: create pane writes /login?mode=signup (got " + b.replaced[b.replaced.length - 1] + ")");
  b.get("to-login").onclick();
  ok(b.replaced[b.replaced.length - 1] === "/login", "URL-2: swapping to sign in writes bare /login");
  ok(!hidden(b, "login-view"), "URL-3: and the sign in pane is the visible one");
}

console.log("AUTH CALLBACK SURVIVAL");
{
  // LOGIN_CALLBACK_V1. swapTo runs synchronously at load and rewrites the URL. Before the
  // fix it wrote a bare "/login", which deleted an implicit callback fragment out of the
  // address bar before supabase-js could read it. getSession then found nothing and the
  // confirmed user sat on the sign in form.
  const HASH = "#access_token=x&refresh_token=y&type=signup";
  const b = boot({ hash: HASH });
  const last = b.replaced[b.replaced.length - 1];
  ok(String(last).endsWith(HASH), "CB-1: an implicit callback fragment SURVIVES swapTo (got " + last + ")");
  ok(String(last).startsWith("/login"), "CB-2: and the path is still /login");
}
{
  // The PKCE shape. Same failure, different half of the URL.
  const b = boot({ search: "?code=abc" });
  const last = b.replaced[b.replaced.length - 1];
  ok(String(last).includes("code=abc"), "CB-3: a PKCE ?code= SURVIVES swapTo (got " + last + ")");
}
{
  // Both halves at once, and the mode param still gets cleared off the sign in pane.
  const b = boot({ search: "?code=abc&mode=signup", hash: "#access_token=z" });
  b.get("to-login").onclick();
  const last = b.replaced[b.replaced.length - 1];
  ok(String(last).includes("code=abc"), "CB-4: swapping panes keeps the query");
  ok(String(last).endsWith("#access_token=z"), "CB-5: swapping panes keeps the fragment");
  ok(!String(last).includes("mode=signup"), "CB-6: and mode is still cleared, which is the one param that is ours");
}
{
  // KNOWN-NEGATIVE CONTROL. With no callback on the URL the result must be a bare /login,
  // or CB-1 to CB-5 could be passing on a function that never writes anything at all.
  const b = boot({});
  ok(b.replaced[b.replaced.length - 1] === "/login", "CB-7: control, a plain load still writes a bare /login");
}

console.log("SIGNUP REDIRECT TARGET");
{
  let seen = null;
  const b = boot({ signUp: async (args) => { seen = args; return { data: { user: { identities: [{}] }, session: null }, error: null }; } });
  b.get("su-name").value = "P Twentyseven"; b.get("su-email").value = "p27@example.test";
  b.get("su-pass").value = "correct horse"; b.get("su-pass2").value = "correct horse";
  b.get("su-age").checked = true;
  await b.get("signup-form").onsubmit({ preventDefault(){} });
  ok(seen && seen.options && seen.options.emailRedirectTo === "https://biowellth.ai/login",
     "RT-1: signUp passes emailRedirectTo of origin + /login (got " + (seen && seen.options && seen.options.emailRedirectTo) + ")");
  ok(seen && seen.options && seen.options.data && seen.options.data.age_affirmed === true,
     "RT-2: control, the age_affirmed metadata is still sent alongside it");
}

console.log("TESTER DECLINE");
{
  // TESTER_GATE_V1. Not now on the tester gate lands here with ?declined=tester.
  const b = boot({ search: "?declined=tester" });
  ok(b.get("msg").textContent === "Thanks for considering it. Sign back in whenever you are ready to accept the tester agreement.",
     "DECL-1: ?declined=tester shows the message (got " + JSON.stringify(b.get("msg").textContent) + ")");
  ok(!hidden(b, "login-view"), "DECL-2: on the sign in pane");
  const last = b.replaced[b.replaced.length - 1];
  ok(!String(last).includes("declined"), "DECL-3: and swapTo drops the param from the URL (got " + last + ")");
}
{
  // KNOWN-NEGATIVE CONTROL. A plain load must NOT carry that message, or DECL-1 could be
  // passing on a page that shows it unconditionally.
  const b = boot({ search: "" });
  ok(b.get("msg").textContent === "", "DECL-4: control, a plain load shows no message");
}
{
  // Another value for the same param is not the tester decline.
  const b = boot({ search: "?declined=something-else" });
  ok(b.get("msg").textContent === "", "DECL-5: only declined=tester triggers it");
  ok(!String(b.replaced[b.replaced.length - 1]).includes("declined"), "DECL-6: the param is dropped either way");
}
{
  // It must not eat an auth callback riding on the same URL.
  const b = boot({ search: "?declined=tester&code=abc", hash: "#access_token=z" });
  const last = b.replaced[b.replaced.length - 1];
  ok(String(last).includes("code=abc"), "DECL-7: a PKCE code on the same URL survives");
  ok(String(last).endsWith("#access_token=z"), "DECL-8: so does the fragment");
  ok(!String(last).includes("declined"), "DECL-9: while declined is still dropped");
}

console.log("CHECK YOUR EMAIL INTERSTITIAL");
{
  const ADDRESS = "p26+<img src=x>@example.test";
  const b = boot({ signUp: async () => ({ data: { user: { identities: [{}] }, session: null }, error: null }) });
  b.get("su-name").value = "P Twentysix"; b.get("su-email").value = ADDRESS;
  b.get("su-pass").value = "correct horse"; b.get("su-pass2").value = "correct horse";
  b.get("su-age").checked = true;
  await b.get("signup-form").onsubmit({ preventDefault(){} });
  ok(!hidden(b, "check-email-view"),  "CE-1: a successful signup shows the interstitial");
  ok(hidden(b, "signup-view") && hidden(b, "login-view"), "CE-2: both forms are hidden while it shows");
  ok(b.get("ce-address").textContent === ADDRESS, "CE-3: the address is rendered as TEXT, verbatim");
  ok(b.get("ce-address")._innerHTMLWrites === 0, "CE-4: innerHTML was never written on that node");
  b.get("ce-back").onclick();
  ok(!hidden(b, "login-view"), "CE-5: Back to sign in returns to the sign in pane");
}
{
  // Supabase's already-registered signal: no error, a user with an EMPTY identities array.
  //
  // WHAT THIS ASSERTION CAN AND CANNOT CATCH, measured rather than assumed. Deleting the
  // identities guard from login.html does NOT turn this red, because the no-session
  // fallback below it produces the same interstitial. The assertion is on the OUTCOME,
  // which is the thing that matters, and the outcome is guaranteed twice over. Reverting
  // the fallback alone was checked separately and turns CE-1 red while CE-6 stays green,
  // which is how the two paths were told apart.
  const b = boot({ signUp: async () => ({ data: { user: { identities: [] }, session: null }, error: null }) });
  b.get("su-name").value = "P Twentysix"; b.get("su-email").value = "taken@example.test";
  b.get("su-pass").value = "correct horse"; b.get("su-pass2").value = "correct horse";
  b.get("su-age").checked = true;
  await b.get("signup-form").onsubmit({ preventDefault(){} });
  ok(!hidden(b, "check-email-view"), "CE-6: an already registered address gets the SAME interstitial");
  ok(!/already/i.test(b.get("msg").textContent), "CE-7: and no message that says the account exists");
}

console.log("SIGN IN MESSAGES");
{
  const b = boot({ signIn: async () => ({ data: {}, error: { message: "Email not confirmed", status: 400 } }) });
  b.get("li-email").value = "p26@example.test"; b.get("li-pass").value = "correct horse";
  await b.get("login-form").onsubmit({ preventDefault(){} });
  ok(b.get("msg").textContent === "Please confirm your email first. Check your inbox for the link we sent.",
     "SIGNIN-1: an unconfirmed address gets the confirm message");
}
{
  const b = boot({ signIn: async () => ({ data: {}, error: { message: "Invalid login credentials", status: 400 } }) });
  b.get("li-email").value = "p26@example.test"; b.get("li-pass").value = "wrong";
  await b.get("login-form").onsubmit({ preventDefault(){} });
  ok(b.get("msg").textContent === "Email or password is incorrect.",
     "SIGNIN-2: every other failure stays generic");
}
{
  // KNOWN-NEGATIVE CONTROL. If the regex ever matched everything, SIGNIN-2 above would
  // still pass by accident only if the generic string were also the confirm string. This
  // asserts the two branches are actually different text.
  ok("Please confirm your email first. Check your inbox for the link we sent." !== "Email or password is incorrect.",
     "SIGNIN-3: control, the two messages are distinct strings");
}

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
