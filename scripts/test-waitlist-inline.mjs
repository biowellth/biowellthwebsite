// WAITLIST_INLINE_V1. The inline waitlist signup in index.html, and the two pages behind the
// welcome email links (waitlist-tag/, unsubscribe/). Drives the real files in headless Chrome.
//
// The function is never called. window.fetch is replaced before any page script runs, records
// each request to waitlist-signup, and answers with whatever the case scripts. All network outside
// 127.0.0.1 is refused, so fonts never load and nothing leaves the machine. Every fixture is
// synthetic, and every address is @example.com.
//
// Also guards the removal of the third-party form: no "typeform" anywhere in index.html or
// dashboard.html, and no iframe on the page.
//
//   node scripts/test-waitlist-inline.mjs        (CHROME=/path/to/chrome, ROOT=/path/to/checkout)
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";

const ROOT = process.env.ROOT || ".";
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9700 + Math.floor(Math.random() * 200);
const TOKEN = "0b6f3c1e-2a4d-4e8f-9a1b-3c5d7e9f1a2b";

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const done = (code) => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(code); };
if (!existsSync(CHROME)) { console.log("  FAIL WI-0: Chrome is not at " + CHROME); fail++; done(1); }

// WI-0. Static guards on the source, before any browser.
for (const f of ["index.html", "dashboard.html"]) {
  const src = readFileSync(join(ROOT, f), "utf8");
  ok(!/typeform/i.test(src), `WI-0 ${f} carries no "typeform", not even in a comment`);
}
const index = readFileSync(join(ROOT, "index.html"), "utf8");
ok((index.match(/data-wl="inline-v1"/g) || []).length === 3, "WI-0 index.html has exactly three inline forms");
ok(!/<iframe/i.test(index), "WI-0 index.html has no iframe");

// Replaces fetch for the function only. window.__next is the scripted answer for the next call:
// {status, body} or "throw". Every request body is kept in window.__calls.
const STUB = `<script>
window.__errs = []; addEventListener("error", e => window.__errs.push(String(e.message)));
window.__calls = []; window.__next = null;
// With nothing scripted, each route gets its normal success, so a page that calls on load can be tested.
const DEFAULTS = { "": { ok: true, notice: "inbox" }, "/tag": { ok: true, saved: true }, "/unsubscribe": { ok: true } };
const realFetch = window.fetch;
window.fetch = (url, init) => {
  if (String(url).indexOf("/functions/v1/waitlist-signup") < 0) return realFetch(url, init);
  window.__calls.push({ url: String(url), method: init && init.method, body: init && init.body ? JSON.parse(init.body) : null });
  const route = (String(url).match(new RegExp("waitlist-signup(/[a-z]+)?$")) || [])[1] || "";
  const n = window.__next || { status: 200, body: DEFAULTS[route] };
  if (n === "throw") return Promise.reject(new Error("network"));
  return Promise.resolve(new Response(JSON.stringify(n.body), { status: n.status, headers: { "content-type": "application/json" } }));
};
<\/script>`;

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]).replace(/^\//, "");
  if (!p) p = "index.html";
  if (p.endsWith("/")) p += "index.html";
  const f = join(ROOT, p);
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  if (p.endsWith(".html")) {
    const html = readFileSync(f, "utf8").replace("<head>", "<head>" + STUB);
    res.writeHead(200, { "content-type": TYPES[".html"] }); return res.end(html);
  }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));

const profile = "/tmp/waitlist-inline-" + process.pid;
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--remote-debugging-port=" + (PORT + 1), "--user-data-dir=" + profile,
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(300);
  try { wsUrl = (await (await fetch("http://127.0.0.1:" + (PORT + 1) + "/json/version")).json()).webSocketDebuggerUrl; } catch (e) {} }
if (!wsUrl) { console.log("  FAIL WI-0c: Chrome never opened a debugging port"); fail++; server.close(); chrome.kill(); done(1); }
const ws = new WebSocket(wsUrl); let msgId = 0; const pend = new Map();
const send = (m, p = {}, s) => new Promise(r => { const i = ++msgId; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result ?? m); pend.delete(m.id); } };
await new Promise(r => ws.onopen = r);
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
const ev = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, sessionId)).result?.value;
async function open(path, width = 1280) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  await send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/" + path }, sessionId);
  await sleep(1800);
}
// Submit one form instance with an address and a scripted answer, then read the outcome.
async function submit(inst, email, next, honeypot = "") {
  return JSON.parse(await ev(`(async () => {
    window.__next = ${JSON.stringify(next)}; window.__calls = [];
    const b = document.querySelector('#wl-email-${inst}').closest('.wl-block');
    const f = b.querySelector('.wl-form'); f.hidden = false; b.querySelector('.wl-done').hidden = true;
    b.querySelector('[name="company"]').value = ${JSON.stringify(honeypot)};
    const i = b.querySelector('.wl-input'); i.value = ${JSON.stringify(email)}; i.dispatchEvent(new Event('input'));
    f.requestSubmit();
    await new Promise(r => setTimeout(r, 400));
    return JSON.stringify({ calls: window.__calls, msg: f.querySelector('.wl-msg').textContent, invalid: f.classList.contains('is-invalid'),
      formHidden: f.hidden, done: !b.querySelector('.wl-done').hidden, doneText: b.querySelector('.wl-done-text').textContent,
      btn: f.querySelector('button').textContent, href: location.href });
  })()`));
}

// ── index.html ──────────────────────────────────────────────────────────────────────────────────
await open("index.html?utm_source=IG&utm_medium=social&utm_campaign=launch&utm_content=bad%20value&fbclid=x");
const st = JSON.parse(await ev(`JSON.stringify({ blocks: document.querySelectorAll('.wl-block').length, unbound: document.querySelectorAll('.wl-block[hidden]').length,
  nav: document.querySelector('.nav-cta').getAttribute('href'), navClick: document.querySelector('.nav-cta').getAttribute('onclick'),
  joinHasForm: !!document.querySelector('#join .wl-form'), iframes: document.querySelectorAll('iframe').length,
  tfScripts: [...document.scripts].filter(s => /typeform/i.test(s.src)).length,
  notices: [...document.querySelectorAll('.wl-notice')].map(n => ({ text: n.textContent, form: n.closest('.wl-block').querySelector('.wl-input').id })),
  heroNotice: !!document.querySelector('.wl-hero .wl-notice'),
  heroGap: (() => { const f = document.querySelector('.wl-hero .wl-form').getBoundingClientRect(), l = document.querySelector('.wl-hero-link').getBoundingClientRect(); return Math.round((l.top - f.bottom) * 10) / 10; })(),
  errs: window.__errs })`));
ok(st.blocks === 3 && st.unbound === 0, `WI-1 three forms, all bound by the script (${st.blocks}, unbound ${st.unbound})`);
ok(st.nav === "#join" && st.navClick === null && st.joinHasForm, "WI-2 the nav button goes to #join, which holds a form");
ok(st.iframes === 0 && st.tfScripts === 0, "WI-3 no iframe and no third-party form script in the page");
// The hero carries no signup notice (founder, 2026-10-24); the final CTA and early-access forms keep it.
ok(st.notices.length === 2 && st.notices.every(n => n.text === "We'll email you about early access. You can remove yourself at any time. Privacy Policy.")
  && st.notices.map(n => n.form).sort().join() === "wl-email-ea,wl-email-join",
  "WI-4 counsel's signup notice, exactly, under the final CTA and early-access forms " + JSON.stringify(st.notices.map(n => n.form)));
ok(!st.heroNotice && st.heroGap === 20, "WI-4b the hero has no notice, and How we read a panel sits 20px under the form (" + st.heroGap + "px)");
ok(st.errs.length === 0, "WI-5 no page errors on load " + (st.errs[0] || ""));

let r = await submit("hero", " Priya@Example.com ", { status: 200, body: { ok: true, notice: "inbox" } });
const body = r.calls[0] && r.calls[0].body;
ok(r.calls.length === 1 && r.calls[0].method === "POST" && /\/functions\/v1\/waitlist-signup$/.test(r.calls[0].url), "WI-6 one POST to waitlist-signup");
ok(body && body.email === "Priya@Example.com" && body.utm_source === "ig" && body.utm_medium === "social" && body.utm_campaign === "launch" && body.utm_content === "",
  "WI-7 tags lowercased, a mangled value sent empty " + JSON.stringify(body));
ok(body && !("fbclid" in body) && body.company === "" && body.referrer === "", "WI-8 only the known keys go, honeypot empty, no referrer on a direct load");
ok(r.done && r.formHidden && r.doneText === "You're on the list. Check your inbox.", "WI-9 200 inbox shows the success message");
ok(!r.href.includes("@"), "WI-10 the address never reaches the URL");

r = await submit("join", "priya@example.com", { status: 200, body: { ok: true, notice: "listed" } });
ok(r.done && r.doneText === "You're on the list. We'll email you when early access opens.", "WI-11 200 listed never says check your inbox");
r = await submit("join", "priya@example.com", { status: 429, body: { error: "rate_limited" } });
ok(!r.done && r.msg === "Too many tries from this connection. Please wait a little and try again.", "WI-12 429 shows the rate-limit message");
r = await submit("join", "priya@example.com", { status: 400, body: { error: "invalid_email" } });
ok(r.invalid && r.msg.startsWith("That email doesn't look quite right"), "WI-13 400 marks the field invalid");
r = await submit("join", "priya@example.com", { status: 500, body: { error: "server" } });
ok(!r.done && r.msg.startsWith("Something went wrong, so you're not on the list yet"), "WI-14 500 shows the failure message");
r = await submit("join", "priya@example.com", "throw");
ok(!r.done && r.msg.startsWith("Something went wrong") && r.btn === "Join the waitlist", "WI-15 a network failure shows the failure message and re-enables");
r = await submit("join", "priya@example", { status: 200, body: { ok: true, notice: "inbox" } });
ok(r.calls.length === 0 && r.invalid, "WI-16 a bad address is caught before any request");
r = await submit("ea", "bot@example.com", { status: 200, body: { ok: true, notice: "inbox" } }, "Acme");
ok(r.calls.length === 1 && r.calls[0].body.company === "Acme", "WI-17 the honeypot value is sent for the server to judge");

await open("index.html", 375);
const m = JSON.parse(await ev(`JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth, dir: getComputedStyle(document.querySelector('.wl-hero .wl-pill')).flexDirection })`));
ok(m.sw === m.iw && m.dir === "column", `WI-18 at 375px nothing overflows and the hero pill stacks (${m.sw}/${m.iw}, ${m.dir})`);

// ── waitlist-tag/ ───────────────────────────────────────────────────────────────────────────────
await open(`waitlist-tag/?t=${TOKEN}&city=pune`);
let t = JSON.parse(await ev(`JSON.stringify({ calls: window.__calls, msg: document.getElementById('msg').textContent, href: location.href })`));
ok(t.calls.length === 1 && /\/waitlist-signup\/tag$/.test(t.calls[0].url) && t.calls[0].body.t === TOKEN && t.calls[0].body.city === "pune",
  "WI-19 the tag page POSTs the token and city once, on load");
ok(t.msg === "Thank you. That helps us plan where early access opens first.", "WI-20 saved shows the thank-you");
ok(!t.href.includes(TOKEN) && !t.href.includes("?"), "WI-21 the token is gone from the address bar");
await open(`waitlist-tag/?t=${TOKEN}&city=hormones_cycle`);
t = JSON.parse(await ev(`JSON.stringify({ calls: window.__calls, msg: document.getElementById('msg').textContent })`));
ok(t.calls.length === 0 && t.msg.startsWith("Something went wrong"), "WI-22 an unknown code, including the deferred interest codes, sends nothing");

// ── unsubscribe/ ────────────────────────────────────────────────────────────────────────────────
await open(`unsubscribe/?t=${TOKEN}`);
let u = JSON.parse(await ev(`JSON.stringify({ calls: window.__calls.length, href: location.href, btn: !document.getElementById('go').hidden })`));
ok(u.calls === 0 && u.btn, "WI-23 the removal page deletes nothing on load, it waits for the tap");
ok(!u.href.includes(TOKEN), "WI-24 the token is gone from the address bar");
u = JSON.parse(await ev(`(async () => { window.__next = { status: 200, body: { ok: true } }; document.getElementById('go').click();
  await new Promise(r => setTimeout(r, 400));
  return JSON.stringify({ calls: window.__calls, msg: document.getElementById('msg').textContent, btn: !document.getElementById('go').hidden }); })()`));
ok(u.calls.length === 1 && /\/waitlist-signup\/unsubscribe$/.test(u.calls[0].url) && u.calls[0].body.t === TOKEN, "WI-25 one tap POSTs the token");
ok(u.msg === "You've been removed from the waitlist. Your email and your answer have been deleted." && !u.btn, "WI-26 then confirms the removal");
await open("unsubscribe/");
u = JSON.parse(await ev(`JSON.stringify({ btn: !document.getElementById('go').hidden, msg: document.getElementById('msg').textContent })`));
ok(!u.btn && u.msg.startsWith("This link isn't complete"), "WI-27 with no token there is no button");

ws.close(); chrome.kill(); server.close();
done(fail ? 1 : 0);
