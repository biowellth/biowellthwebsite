// WAITLIST_INLINE_V1. The inline waitlist signup in index.html, and the two pages behind the
// welcome email links (waitlist-tag/, unsubscribe/). Drives the real files in headless Chrome.
//
// The function is never called. window.fetch is replaced before any page script runs, records
// each request to waitlist-signup, and answers with whatever the case scripts. All network outside
// 127.0.0.1 is refused, so fonts never load and nothing leaves the machine. Every fixture is
// synthetic, and every address is @example.com.
//
// WAITLIST_STEP2_V1 adds WS-1 to WS-16: the optional step 2 after a successful signup, at 1440 and
// 390, including that no chip is ever coral and that the step-2 token never leaves the closure.
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
const DEFAULTS = { "": { ok: true, notice: "inbox" }, "/tag": { ok: true, saved: true }, "/unsubscribe": { ok: true }, "/profile": { ok: true } };
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
await send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);
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
  // HERO_LINE_REMOVE_V1: the line under the hero form is gone. This replaced the 20px gap check on it.
  heroLine: document.querySelectorAll('.wl-hero-link, .wl-hero-a').length,
  heroCtas: [...document.querySelector('.hero-ctas').children].map(c => c.className),
  heroLinks: document.querySelectorAll('.hero-ctas a').length,
  // WAITLIST_STEP2_V1: the hidden step-2 panel carries the founder's "Early access opens in small
  // groups" sentence by design, so it is left out here. WI-4d still guards the line UNDER the form.
  heroText: (() => { const c = document.querySelector('.hero').cloneNode(true); c.querySelectorAll('.wl-step2').forEach(n => n.remove()); return c.textContent; })().replace(/\\s+/g, ' '),
  finalText: document.querySelector('#join').textContent.replace(/\\s+/g, ' '),
  errs: window.__errs })`));
ok(st.blocks === 3 && st.unbound === 0, `WI-1 three forms, all bound by the script (${st.blocks}, unbound ${st.unbound})`);
ok(st.nav === "#join" && st.navClick === null && st.joinHasForm, "WI-2 the nav button goes to #join, which holds a form");
ok(st.iframes === 0 && st.tfScripts === 0, "WI-3 no iframe and no third-party form script in the page");
// The hero carries no signup notice (founder, 2026-10-24); the final CTA and early-access forms keep it.
ok(st.notices.length === 2 && st.notices.every(n => n.text === "We'll email you about early access. You can remove yourself at any time. Privacy Policy.")
  && st.notices.map(n => n.form).sort().join() === "wl-email-ea,wl-email-join",
  "WI-4 counsel's signup notice, exactly, under the final CTA and early-access forms " + JSON.stringify(st.notices.map(n => n.form)));
ok(!st.heroNotice, "WI-4b the hero has no signup notice");
// HERO_LINE_REMOVE_V1 (2026-10-26). The offer line and How we read a panel link under the hero form are gone.
ok(st.heroLine === 0 && st.heroLinks === 0 && st.heroCtas.join() === "wl-hero",
  "WI-4c nothing under the hero form, the form block is the only child of .hero-ctas " + JSON.stringify(st.heroCtas));
ok(!st.heroText.includes("How we read a panel") && !st.heroText.includes("Early access opens in small groups"),
  "WI-4d the hero text has neither How we read a panel nor the early access line");
// CONTROL. The same sentence is still under the final CTA, so WI-4d cannot pass because the text failed to load.
ok(st.finalText.includes("Early access opens in small groups."), "WI-4e control, the final CTA still says Early access opens in small groups.");
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

// The hero row is only as wide as its content and a container (.wl-form) has none, so without
// .hero-ctas{width:100%} the form collapses to the link's width. Caught on 2026-10-24.
// A fresh load: the cases above leave the hero form in its success state, hidden.
await open("index.html", 1280);
const wide = JSON.parse(await ev(`JSON.stringify({ w: document.querySelector('.wl-hero .wl-form').getBoundingClientRect().width, dir: getComputedStyle(document.querySelector('.wl-hero .wl-pill')).flexDirection })`));
ok(wide.w === 460 && wide.dir === "row", `WI-18a at 1280px the hero form is 460px wide and one row (${wide.w}px, ${wide.dir})`);

await open("index.html", 375);
const m = JSON.parse(await ev(`JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth, dir: getComputedStyle(document.querySelector('.wl-hero .wl-pill')).flexDirection })`));
ok(m.sw === m.iw && m.dir === "column", `WI-18 at 375px nothing overflows and the hero pill stacks (${m.sw}/${m.iw}, ${m.dir})`);

// ── WAITLIST_STEP2_V1 ─────────────────────────────────────────────────────────────────────────────
const S2TOK = "7d2e4f6a-8b0c-4d1e-a3f5-6b7c8d9e0f1a";
// Sign up through one instance with a scripted answer, then report what is on screen.
async function signup(inst, body) {
  return JSON.parse(await ev(`(async () => {
    window.__next = { status: 200, body: ${JSON.stringify(body)} }; window.__calls = [];
    const b = document.querySelector('#wl-email-${inst}').closest('.wl-block');
    const i = b.querySelector('.wl-input'); i.value = 'priya@example.com'; i.dispatchEvent(new Event('input'));
    b.querySelector('.wl-form').requestSubmit();
    await new Promise(r => setTimeout(r, 400));
    window.__next = null;
    const s2 = b.querySelector('.wl-step2');
    return JSON.stringify({ formHidden: b.querySelector('.wl-form').hidden, s2: !!s2 && !s2.hidden, done: !b.querySelector('.wl-done').hidden,
      focus: document.activeElement === (s2 && s2.querySelector('.wl-s2-h')),
      h: s2 && s2.querySelector('.wl-s2-h').textContent, lede: s2 && s2.querySelector('.wl-s2-lede').textContent,
      go: s2 && s2.querySelector('.wl-s2-go').textContent, goDisabled: s2 && s2.querySelector('.wl-s2-go').getAttribute('aria-disabled'),
      skip: s2 && s2.querySelector('.wl-s2-skip').textContent,
      legends: s2 ? [...s2.querySelectorAll('legend')].map(l => l.textContent) : [],
      chips: s2 ? [...s2.querySelectorAll('.wl-q')].map(q => [...q.querySelectorAll('.wl-chip span')].map(x => x.textContent)) : [] });
  })()`));
}
// Tap chips (by "name=value"), then Move me up or Skip, with a scripted /profile answer.
async function step2(inst, taps, action, next) {
  return JSON.parse(await ev(`(async () => {
    const b = document.querySelector('#wl-email-${inst}').closest('.wl-block');
    const s2 = b.querySelector('.wl-step2');
    for (const t of ${JSON.stringify(taps)}) { const [n, v] = t.split('='); s2.querySelector('input[name="' + n + '"][value="' + v + '"]').closest('label').click(); }
    const checked = [...s2.querySelectorAll('input:checked')].map(i => i.name + '=' + i.value);
    const goDisabled = s2.querySelector('.wl-s2-go').getAttribute('aria-disabled');
    window.__calls = []; window.__next = ${JSON.stringify(next ?? null)};
    if (${JSON.stringify(action)} === 'go') s2.querySelector('.wl-s2-go').click();
    if (${JSON.stringify(action)} === 'skip') s2.querySelector('.wl-s2-skip').click();
    await new Promise(r => setTimeout(r, 400));
    window.__next = null;
    const d = b.querySelector('.wl-done');
    return JSON.stringify({ checked, goDisabled, calls: window.__calls, s2: !s2.hidden, done: !d.hidden, doneText: d.querySelector('.wl-done-text').textContent,
      msg: s2.querySelector('.wl-msg').textContent, goHidden: s2.querySelector('.wl-s2-go').hidden, goText: s2.querySelector('.wl-s2-go').textContent,
      focusDone: document.activeElement === d });
  })()`));
}
const COPY_S2 = {
  h: "You're on the list.", lede: "Early access opens in small groups. Answer a few quick taps and we'll move you up.",
  go: "Move me up", skip: "Skip for now",
  legends: ["Which sounds most like you?", "What would help most right now?", "How did you hear about us?", "Open to a 15-minute chat with the founder?"],
  chips: [["My results say normal, but something feels off", "I feel fine and want to stay ahead", "Just curious what my body is doing", "Prefer not to say"],
    ["Read the tests I already have", "An at-home panel, tracked over time", "The fullest picture, with a specialist", "Not sure yet"],
    ["Instagram", "Friend or family", "Search", "Podcast or article", "LinkedIn", "Other"], ["Yes", "No"]],
};

await open("index.html", 1440);
const s0 = JSON.parse(await ev(`JSON.stringify({ tpl: document.querySelectorAll('template#wl-step2-tpl').length,
  s2: [...document.querySelectorAll('.wl-block')].map(b => { const s = b.querySelector('.wl-step2'); return { has: !!s, hidden: s && s.hidden, form: s && s.tagName, glass: s && s.classList.contains('glass'), id: b.querySelector('.wl-input').id }; }),
  msgIds: [...document.querySelectorAll('.wl-step2 .wl-msg')].map(m => m.id) })`));
ok(s0.tpl === 1 && s0.s2.length === 3 && s0.s2.every(x => x.has && x.hidden && x.form === "FORM"),
  "WS-1 one template, cloned into all three instances as its own form, hidden on load " + JSON.stringify(s0.s2));
ok(s0.s2.filter(x => x.glass).map(x => x.id).join() === "wl-email-hero" && new Set(s0.msgIds).size === 3,
  "WS-1b only the hero clone carries its own .glass card, and each clone's message id is unique " + JSON.stringify(s0.msgIds));

for (const [width, inst] of [[1440, "hero"], [390, "hero"], [1440, "join"], [390, "join"]]) {
  await open("index.html", width);
  const a = await signup(inst, { ok: true, notice: "inbox", step2: S2TOK });
  ok(a.formHidden && a.s2 && !a.done && a.focus, `WS-2 ${inst} at ${width}: a 200 with a token swaps to step 2 in place and focuses its heading`);
  ok(a.h === COPY_S2.h && a.lede === COPY_S2.lede && a.go === COPY_S2.go && a.skip === COPY_S2.skip
    && JSON.stringify(a.legends) === JSON.stringify(COPY_S2.legends) && JSON.stringify(a.chips) === JSON.stringify(COPY_S2.chips),
    `WS-3 ${inst} at ${width}: the founder's copy, every string exact`);
  const lay = JSON.parse(await ev(`(() => {
    const b = document.querySelector('#wl-email-${inst}').closest('.wl-block'), s2 = b.querySelector('.wl-step2'), r = s2.getBoundingClientRect();
    const chips = [...s2.querySelectorAll('.wl-chip span')].map(x => x.getBoundingClientRect());
    const longQ = s2.querySelector('.wl-q-long'), lq = longQ.getBoundingClientRect();
    const go = s2.querySelector('.wl-s2-go').getBoundingClientRect(), sk = s2.querySelector('.wl-s2-skip').getBoundingClientRect();
    const cs = getComputedStyle(s2);
    return JSON.stringify({ sw: document.documentElement.scrollWidth, iw: innerWidth, w: r.width,
      minH: Math.min(...chips.map(c => c.height)), inside: chips.every(c => c.left >= r.left - 0.5 && c.right <= r.right + 0.5),
      longFull: [...longQ.querySelectorAll('.wl-chip')].every(c => Math.abs(c.getBoundingClientRect().width - lq.width) < 1),
      goFull: Math.abs(go.width - s2.querySelector('.wl-s2-actions').getBoundingClientRect().width) < 1, skipH: sk.height,
      bg: cs.backgroundColor, blur: cs.backdropFilter || cs.webkitBackdropFilter || '' });
  })()`));
  ok(lay.sw === lay.iw && lay.inside, `WS-4 ${inst} at ${width}: nothing overflows, every chip inside the card (${lay.sw}/${lay.iw}, ${Math.round(lay.w)}px)`);
  ok(lay.minH >= 44 && lay.skipH >= 44 && lay.goFull, `WS-5 ${inst} at ${width}: 44px tap targets and a full-width Move me up (${lay.minH}, ${lay.skipH})`);
  if (width === 390) ok(lay.longFull, `WS-6 ${inst} at 390: persona and need chips run one per line`);
  else ok(!lay.longFull, `WS-6 ${inst} at 1440: persona and need chips wrap inline`);
  if (inst === "hero") ok(lay.bg === "rgba(251, 250, 249, 0.8)" && /blur/.test(lay.blur), `WS-7 hero at ${width}: step 2 sits on its own glass card (${lay.bg})`);
  const b = await step2(inst, ["persona=prefer_not_say"], "go");
  ok(b.goDisabled === "false" && b.calls.length === 1 && /\/functions\/v1\/waitlist-signup\/profile$/.test(b.calls[0].url)
    && JSON.stringify(b.calls[0].body) === JSON.stringify({ persona: "prefer_not_say", p: S2TOK }),
    `WS-8 ${inst} at ${width}: Prefer not to say alone is an answer, and only it and the token are sent ` + JSON.stringify(b.calls[0] && b.calls[0].body));
  ok(!b.s2 && b.done && b.focusDone && b.doneText === "Thank you, you've moved up. You're on the list. Check your inbox.",
    `WS-9 ${inst} at ${width}: thanks, plus today's inbox line`);
}

// Behaviour, at 1440 on the final CTA instance. A fresh page for each case, so no closure state carries over.
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
let w = await step2("join", [], "go");
ok(w.goDisabled === "true" && w.calls.length === 0 && w.s2 && w.msg === "Pick any one answer to move up.",
  "WS-10 Move me up with nothing chosen sends nothing and asks for one answer");
w = await step2("join", ["need=not_sure", "need=not_sure"], null);
ok(w.checked.length === 0 && w.goDisabled === "true", "WS-11 a second tap on the chosen chip clears it " + JSON.stringify(w.checked));
w = await step2("join", ["persona=curious", "persona=stay_ahead", "need=home_panel_tracked", "heard=podcast_article", "chat=yes"], "go");
ok(w.calls.length === 1 && JSON.stringify(w.calls[0].body) === JSON.stringify({ persona: "stay_ahead", need: "home_panel_tracked", heard: "podcast_article", chat: true, p: S2TOK }),
  "WS-12 single select per question, the last tap wins, chat Yes is sent as true " + JSON.stringify(w.calls[0] && w.calls[0].body));

await open("index.html", 1440);
await signup("join", { ok: true, notice: "listed", step2: S2TOK });
w = await step2("join", ["chat=no"], "go");
ok(w.calls[0] && w.calls[0].body.chat === false && w.doneText === "Thank you, you've moved up. You're on the list. We'll email you when early access opens.",
  "WS-13 chat No is sent as false, and a listed signup's thanks never says check your inbox");

for (const [notice, text] of [["inbox", "You're on the list. Check your inbox."], ["listed", "You're on the list. We'll email you when early access opens."]]) {
  await open("index.html", 1440);
  await signup("ea", { ok: true, notice, step2: S2TOK });
  w = await step2("ea", ["persona=results_normal_feel_off"], "skip");
  ok(w.calls.length === 0 && !w.s2 && w.done && w.doneText === text, `WS-14 Skip for now (${notice}) sends nothing and shows today's done text exactly`);
}

await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
w = await step2("join", ["heard=search"], "go", { status: 500, body: { error: "server" } });
ok(w.s2 && !w.done && w.msg === "We couldn't save your answers. You're still on the list." && w.checked.join() === "heard=search" && !w.goHidden && w.goText === "Move me up",
  "WS-15 a failed save keeps the answers, says so, and allows one retry");
w = await step2("join", [], "go", "throw");
ok(w.s2 && w.goHidden && w.msg.startsWith("We couldn't save"), "WS-15b after a second failure only Skip remains");
w = await step2("join", [], "skip");
ok(!w.s2 && w.doneText === "You're on the list. Check your inbox.", "WS-15c and Skip still ends cleanly");
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
w = await step2("join", ["heard=other"], "go", { status: 400, body: { error: "bad_request" } });
ok(!w.s2 && w.doneText === "You're on the list. Check your inbox.", "WS-15d a 400 ends as skipped, never claiming a move");
await open("index.html", 1440);
const bad = await signup("join", { ok: true, notice: "inbox", step2: "not-a-token" });
ok(!bad.s2 && bad.done, "WS-15e a malformed token means today's done state, no step 2");

// WS-16. The token never leaves the closure, and no chip is ever coral or off the site font.
await open("index.html?utm_source=ig", 1440);
await signup("hero", { ok: true, notice: "inbox", step2: S2TOK });
const leak = JSON.parse(await ev(`JSON.stringify({ href: location.href, html: document.documentElement.outerHTML.includes('${S2TOK}'),
  ls: JSON.stringify(Object.assign({}, localStorage)).includes('${S2TOK}'), ss: JSON.stringify(Object.assign({}, sessionStorage)).includes('${S2TOK}'),
  cookie: document.cookie.includes('${S2TOK}') })`));
ok(!leak.href.includes(S2TOK) && !leak.html && !leak.ls && !leak.ss && !leak.cookie, "WS-16 the step-2 token is not in the URL, the DOM, storage or cookies");

const col = JSON.parse(await ev(`(async () => {
  const root = getComputedStyle(document.documentElement);
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const norm = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
  const coral = new Set();
  for (const s of document.styleSheets) { try { for (const r of s.cssRules) { if (r.selectorText === ':root') for (const p of r.style) if (p.startsWith('--coral')) coral.add(norm(root.getPropertyValue(p).trim())); } } catch (e) {} }
  [...coral].forEach(c => { const m = c.match(/[\d.]+/g); if (m) coral.add('rgba(' + m.slice(0, 3).join(', ') + ', 0.6)'); });
  const isCoral = c => coral.has(c) || [...coral].some(k => c.includes(k.replace(/^rgb\(|\)$/g, '')));
  const read = el => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.borderTopColor, cs.color, cs.outlineColor]; };
  const b = document.querySelector('#wl-email-hero').closest('.wl-block'), s2 = b.querySelector('.wl-step2');
  const spans = [...s2.querySelectorAll('.wl-chip span')];
  const off = spans.flatMap(read);
  s2.querySelectorAll('.wl-q').forEach(q => q.querySelector('.wl-chip').click());
  // The chips transition their colours over .15s. Read too early and "selected" still reads as
  // unselected, which would make the selected half of this check vacuous.
  await new Promise(r => setTimeout(r, 400));
  const nOn = s2.querySelectorAll('input:checked').length;
  const on = spans.flatMap(read);
  const tick = getComputedStyle(spans[0], '::before').backgroundImage;
  const chosen = getComputedStyle(spans[0]);
  // Known positive (rule 20): the page's own coral chips (.chips li, coral-soft) must be caught.
  const control = [...document.querySelectorAll('.chips li')].slice(0, 1).flatMap(read);
  const fonts = [...spans, ...s2.querySelectorAll('legend'), s2.querySelector('.wl-s2-lede'), s2.querySelector('.wl-s2-skip')].map(e => getComputedStyle(e).fontFamily);
  probe.remove();
  return JSON.stringify({ nOn, n: coral.size, offHits: off.filter(isCoral), onHits: on.filter(isCoral), control: control.filter(isCoral).length,
    chosenBg: chosen.backgroundColor, chosenFg: chosen.color, tick: /F8F2EC/i.test(decodeURIComponent(tick)), fonts: [...new Set(fonts)] });
})()`));
ok(col.n >= 5 && col.control > 0, `WS-16b control, the coral detector reads ${col.n} --coral tokens and catches the page's coral chips`);
ok(col.nOn === 4 && col.offHits.length === 0 && col.onHits.length === 0, "WS-16c no coral on any chip, unselected or selected " + JSON.stringify([col.offHits, col.onHits]));
ok(col.chosenBg === "rgb(71, 55, 43)" && col.chosenFg === "rgb(248, 242, 236)" && col.tick, `WS-16d a chosen chip is ink with cream text and a cream tick (${col.chosenBg}, ${col.chosenFg})`);
ok(col.fonts.length === 1 && /^"?Instrument Sans"?,/.test(col.fonts[0]) && !/Inter\b/.test(col.fonts[0]), "WS-16e step-2 labels are Instrument Sans, no Inter " + JSON.stringify(col.fonts));
const s2src = index.slice(index.indexOf('<template id="wl-step2-tpl">'), index.indexOf("</template>"));
const strings = [...s2src.matchAll(/>([^<>]+)</g)].map(m => m[1].trim()).filter(Boolean);
ok(strings.length > 20 && strings.every(x => !/[:—–]/.test(x)), "WS-16f no colon or em dash in any step-2 string (" + strings.length + " checked)");

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
