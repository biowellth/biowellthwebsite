// WAITLIST_INLINE_V1. The inline waitlist signup in index.html, and the two pages behind the
// welcome email links (waitlist-tag/, unsubscribe/). Drives the real files in headless Chrome.
//
// The function is never called. window.fetch is replaced before any page script runs, records
// each request to waitlist-signup, and answers with whatever the case scripts. All network outside
// 127.0.0.1 is refused, so fonts never load and nothing leaves the machine. Every fixture is
// synthetic, and every address is @example.com.
//
// WAITLIST_STEP2_V1 adds WS-1 to WS-17: the optional step 2 after a successful signup, at 1440 and
// 390, including that no chip is ever coral and that the step-2 token never leaves the closure.
// Amended 2026-10-27: step 2 is ONE shared modal, not an in-card swap. WS-1 to WS-10 cover that it
// opens only after the 200, that X, Esc and a backdrop click are Skip with no /profile request, the
// focus trap, the scroll lock, and one modal whichever of the three forms submitted. WS-18 (the
// large centred orb behind the modal) and WS-19 (the sticky Move me up footer) followed the same day.
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
async function open(path, width = 1280, height = 900) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
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
  // WAITLIST_STEP2_V1: step 2 now lives in the shared modal outside the hero (amended 2026-10-27),
  // so the hero text is read whole again. WI-4d still guards the line UNDER the form.
  heroText: document.querySelector('.hero').textContent.replace(/\\s+/g, ' '),
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

// ── WAITLIST_STEP2_V1, amended 2026-10-27: one shared modal ───────────────────────────────────────
// Step 1 is unchanged on all three forms. After a 200 with a token the submitting form shows its done
// pill as today, and ONE modal (#wl-modal) opens over the page. X, Esc and a backdrop click all behave
// as Skip and send nothing. Keys and the backdrop click are real CDP input events, not synthetic ones,
// so the browser's own Tab order and click targeting are what is tested.
const S2TOK = "7d2e4f6a-8b0c-4d1e-a3f5-6b7c8d9e0f1a";
const key = async (k, shift = false) => {
  const d = { Tab: { code: "Tab", keyCode: 9 }, Escape: { code: "Escape", keyCode: 27 } }[k];
  for (const type of ["rawKeyDown", "keyUp"])
    await send("Input.dispatchKeyEvent", { type, key: k, code: d.code, windowsVirtualKeyCode: d.keyCode, nativeVirtualKeyCode: d.keyCode, modifiers: shift ? 8 : 0 }, sessionId);
};
const clickAt = async (x, y) => {
  for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }, sessionId);
};
// The page an instance lives on: the early-access form is on its own route.
const PAGE = { hero: "index.html", join: "index.html", ea: "index.html#early-access" };
// What the modal and the submitting form show right now.
const READ = (inst) => `(() => {
  const b = document.querySelector('#wl-email-${inst}').closest('.wl-block'), m = document.getElementById('wl-modal');
  const s2 = m.querySelector('.wl-step2'), res = m.querySelector('.wl-m-res'), d = b.querySelector('.wl-done');
  const cs = e => getComputedStyle(e);
  return { formHidden: b.querySelector('.wl-form').hidden, pill: !d.hidden, pillText: d.querySelector('.wl-done-text').textContent,
    open: !m.hidden && cs(m).display !== 'none', veil: !document.querySelector('.wl-m-veil').hidden,
    visibleDialogs: [...document.querySelectorAll('[role="dialog"]')].filter(x => !x.hidden && cs(x).display !== 'none').length,
    s2: !s2.hidden, res: !res.hidden, rh: res.querySelector('.wl-m-rh').textContent, rp: res.querySelector('.wl-m-rp').textContent,
    msg: s2.querySelector('.wl-msg').textContent, goHidden: s2.querySelector('.wl-s2-go').hidden, goText: s2.querySelector('.wl-s2-go').textContent,
    goDisabled: s2.querySelector('.wl-s2-go').getAttribute('aria-disabled'),
    checked: [...s2.querySelectorAll('input:checked')].map(i => i.name + '=' + i.value),
    focusH: document.activeElement === m.querySelector('.wl-m-h'), focusRh: document.activeElement === res.querySelector('.wl-m-rh'),
    focusPill: document.activeElement === d, htmlOv: cs(document.documentElement).overflowY, bodyOv: cs(document.body).overflowY,
    inert: [...document.body.children].filter(x => x.inert).map(x => x.id || x.className || x.tagName), calls: window.__calls };
})()`;
const state = async (inst) => JSON.parse(await ev(`JSON.stringify(${READ(inst)})`));
async function signup(inst, body) {
  await ev(`(async () => {
    window.__next = { status: 200, body: ${JSON.stringify(body)} }; window.__calls = [];
    const b = document.querySelector('#wl-email-${inst}').closest('.wl-block');
    // Where a person would be: looking at the form. Without this the done pill's focus starts a
    // smooth scroll down to it, which would still be running when the scroll lock is measured.
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    const i = b.querySelector('.wl-input'); i.value = 'priya@example.com'; i.dispatchEvent(new Event('input'));
    b.querySelector('.wl-form').requestSubmit();
    await new Promise(r => setTimeout(r, 450));
    window.__next = null; window.__calls = [];
  })()`);
  return state(inst);
}
// Tap chips (by "name=value") in the modal, then act, with a scripted /profile answer.
async function step2(inst, taps, action, next) {
  await ev(`(async () => {
    const m = document.getElementById('wl-modal');
    for (const t of ${JSON.stringify(taps)}) { const [n, v] = t.split('='); m.querySelector('input[name="' + n + '"][value="' + v + '"]').closest('label').click(); }
    window.__calls = []; window.__next = ${JSON.stringify(next ?? null)};
    const a = ${JSON.stringify(action)};
    if (a === 'go') m.querySelector('.wl-s2-go').click();
    if (a === 'skip') m.querySelector('.wl-s2-skip').click();
    if (a === 'x') m.querySelector('.wl-m-x').click();
    if (a === 'close') m.querySelector('.wl-m-close').click();
  })()`);
  if (action === "esc") await key("Escape");
  if (action === "backdrop") await clickAt(5, 5);
  await sleep(450);
  const s = await state(inst);
  await ev(`window.__next = null`);
  return s;
}
const COPY_S2 = {
  eyebrow: "YOU'RE ON THE LIST", h: "Want in sooner?", em: "sooner?",
  lede: "Early access opens in small groups. Answer a few quick taps and we'll move you up.",
  go: "Move me up", skip: "Skip for now",
  // WAITLIST_STEP2_V1, 2026-10-27: the city question moved here from the welcome email, as the first group,
  // with /tag's labels and order.
  legends: ["Where do you live?", "Which sounds most like you?", "What would help most right now?", "How did you hear about us?", "Open to a 15-minute chat with the founder?"],
  chips: [["Bangalore", "Mumbai", "Delhi NCR", "Chennai", "Hyderabad", "Pune", "Kolkata", "Elsewhere in India", "US", "UK", "Elsewhere outside India"],
    ["My results say normal, but something feels off", "I feel fine and want to stay ahead", "Just curious what my body is doing", "Prefer not to say"],
    ["Read the tests I already have", "An at-home panel, tracked over time", "The fullest picture, with a specialist", "Not sure yet"],
    ["Instagram", "Friend or family", "Search", "Podcast or article", "LinkedIn", "Other"], ["Yes", "No"]],
};
const INBOX = "You're on the list. Check your inbox.", LISTED = "You're on the list. We'll email you when early access opens.";

await open("index.html", 1440);
const s0 = JSON.parse(await ev(`JSON.stringify({ tpl: document.querySelectorAll('template#wl-step2-tpl').length,
  dialogs: [...document.querySelectorAll('[role="dialog"]')].map(d => ({ id: d.id, modal: d.getAttribute('aria-modal'), hidden: d.hidden, lab: d.getAttribute('aria-labelledby') })),
  veils: document.querySelectorAll('.wl-m-veil').length, inCards: document.querySelectorAll('.wl-block .wl-step2, .wl-block .wl-chip').length,
  forms: [...document.querySelectorAll('.wl-block')].map(b => [...b.children].map(c => c.className).join('|')) })`));
ok(s0.tpl === 0 && s0.dialogs.length === 1 && s0.dialogs[0].id === "wl-modal" && s0.dialogs[0].modal === "true" && s0.dialogs[0].hidden
  && s0.dialogs[0].lab === "wl-m-h" && s0.veils === 1,
  "WS-1 exactly one dialog in the page, aria-modal, labelled by its heading, hidden on load " + JSON.stringify(s0.dialogs));
ok(s0.inCards === 0 && s0.forms.every(f => f === "wl-form|wl-done" || f === "wl-form|wl-done|final-privacy wl-notice"),
  "WS-1b the three step-1 blocks hold only their form, done pill and notice, nothing of step 2 " + JSON.stringify(s0.forms));

// One instance per width, plus all three at 1440, so every form is shown to open the same modal.
for (const [width, inst] of [[1440, "hero"], [1440, "join"], [1440, "ea"], [390, "hero"], [390, "join"], [390, "ea"]]) {
  await open(PAGE[inst], width);
  const pre = await state(inst);
  ok(!pre.open && !pre.veil, `WS-2a ${inst} at ${width}: nothing is open before a submit`);
  // The modal must not open while the signup is in flight: hold the response and look.
  const held = JSON.parse(await ev(`(async () => {
    let release; const real = window.fetch;
    window.fetch = (u, i) => new Promise(r => { release = () => r(real(u, i)); });
    window.__next = { status: 200, body: { ok: true, notice: "inbox", step2: "${S2TOK}" } };
    const b = document.querySelector('#wl-email-${inst}').closest('.wl-block');
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    b.querySelector('.wl-input').value = 'priya@example.com'; b.querySelector('.wl-form').requestSubmit();
    await new Promise(r => setTimeout(r, 300));
    const during = !document.getElementById('wl-modal').hidden;
    window.fetch = real; release(); await new Promise(r => setTimeout(r, 450));
    window.__next = null;
    return JSON.stringify({ during, after: !document.getElementById('wl-modal').hidden });
  })()`));
  const a = await state(inst);
  ok(!held.during && held.after, `WS-2 ${inst} at ${width}: the modal opens only after the 200, never while the signup is in flight`);
  ok(a.formHidden && a.pill && a.pillText === INBOX, `WS-2b ${inst} at ${width}: step 1 is unchanged, its done pill shows today's text under the modal`);
  ok(a.open && a.veil && a.visibleDialogs === 1 && a.s2 && !a.res && a.focusH, `WS-2c ${inst} at ${width}: one modal, on step 2, its heading focused`);
  const c = JSON.parse(await ev(`(() => { const m = document.getElementById('wl-modal'), s2 = m.querySelector('.wl-step2');
    return JSON.stringify({ eyebrow: m.querySelector('.eyebrow').innerText, eyeColor: getComputedStyle(m.querySelector('.eyebrow')).color,
      h: m.querySelector('.wl-m-h').textContent, em: m.querySelector('.wl-m-h em').textContent, emStyle: getComputedStyle(m.querySelector('.wl-m-h em')).fontStyle,
      emColor: getComputedStyle(m.querySelector('.wl-m-h em')).color, hFont: getComputedStyle(m.querySelector('.wl-m-h')).fontFamily,
      lede: s2.querySelector('.wl-s2-lede').textContent, go: s2.querySelector('.wl-s2-go').textContent, skip: s2.querySelector('.wl-s2-skip').textContent,
      legends: [...s2.querySelectorAll('legend')].map(l => l.textContent),
      chips: [...s2.querySelectorAll('.wl-q')].map(q => [...q.querySelectorAll('.wl-chip span')].map(x => x.textContent)) }); })()`));
  ok(c.eyebrow === COPY_S2.eyebrow && c.eyeColor === "rgb(89, 102, 58)" && c.h === COPY_S2.h && c.em === COPY_S2.em && c.emStyle === "italic"
    && c.emColor === "rgb(156, 94, 71)" && /^"?Fraunces/.test(c.hFont),
    `WS-3 ${inst} at ${width}: olive YOU'RE ON THE LIST eyebrow, Fraunces Want in sooner? with sooner? italic coral ` + JSON.stringify([c.eyebrow, c.eyeColor, c.emColor]));
  ok(c.lede === COPY_S2.lede && c.go === COPY_S2.go && c.skip === COPY_S2.skip
    && JSON.stringify(c.legends) === JSON.stringify(COPY_S2.legends) && JSON.stringify(c.chips) === JSON.stringify(COPY_S2.chips),
    `WS-3b ${inst} at ${width}: the founder's copy, every string exact`);
  const lay = JSON.parse(await ev(`(() => {
    const m = document.getElementById('wl-modal'), card = m.querySelector('.wl-m-card'), r = card.getBoundingClientRect(), s2 = m.querySelector('.wl-step2');
    const chips = [...s2.querySelectorAll('.wl-chip span')].map(x => x.getBoundingClientRect());
    const longQ = s2.querySelector('.wl-q-long'), lq = longQ.getBoundingClientRect();
    const go = s2.querySelector('.wl-s2-go').getBoundingClientRect(), sk = s2.querySelector('.wl-s2-skip').getBoundingClientRect();
    const veil = document.querySelector('.wl-m-veil'), cv = document.getElementById('orb-canvas'), pearl = document.querySelector('.wl-m-pearl');
    const vs = getComputedStyle(veil), ks = getComputedStyle(card);
    const z = e => +getComputedStyle(e).zIndex;
    const orbLive = getComputedStyle(cv).display !== 'none';
    const orb = orbLive ? cv : pearl, os = getComputedStyle(orb);
    return JSON.stringify({ iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth,
      card: [r.left, r.top, r.right, r.bottom, r.width, r.height].map(Math.round), scrolls: card.scrollHeight > card.clientHeight, ovY: ks.overflowY,
      minH: Math.min(...chips.map(c => c.height)), inside: chips.every(c => c.left >= r.left - 0.5 && c.right <= r.right + 0.5),
      longFull: [...longQ.querySelectorAll('.wl-chip')].every(c => Math.abs(c.getBoundingClientRect().width - lq.width) < 1),
      goFull: Math.abs(go.width - s2.querySelector('.wl-s2-actions').getBoundingClientRect().width) < 1, skipH: sk.height,
      veilBg: vs.backgroundColor, veilBlur: vs.backdropFilter, veilBox: [veil.getBoundingClientRect().width, veil.getBoundingClientRect().height],
      cardBg: ks.backgroundColor, cardBlur: ks.backdropFilter, radius: ks.borderTopLeftRadius, border: ks.borderTopColor, shadow: ks.boxShadow,
      orbLive, orbShown: os.display !== 'none' && !orb.hidden, pearlHidden: pearl.hidden, zs: [z(veil), z(orb), z(m)] });
  })()`));
  ok(lay.veilBg === "rgba(247, 239, 233, 0.45)" && lay.veilBlur === "blur(16px)" && lay.veilBox[0] === lay.iw && lay.veilBox[1] === lay.ih,
    `WS-4 ${inst} at ${width}: a full-viewport cream veil with a 16px blur (${lay.veilBg}, ${lay.veilBlur})`);
  ok(lay.cardBg === "rgba(255, 255, 255, 0.58)" && lay.cardBlur === "blur(24px)" && lay.radius === (width === 390 ? "28px" : "28px")
    && lay.border === "rgba(255, 255, 255, 0.85)" && /rgba\(156, 94, 71/.test(lay.shadow),
    `WS-4b ${inst} at ${width}: a frosted card, white 58% with a 24px blur, white hairline, warm shadow, radius 28px`);
  ok(lay.orbShown && lay.zs[0] < lay.zs[1] && lay.zs[1] < lay.zs[2] && (lay.orbLive ? lay.pearlHidden : true),
    `WS-4c ${inst} at ${width}: the orb (${lay.orbLive ? "live canvas" : "pearl stand-in"}) sits above the veil and below the card ` + JSON.stringify(lay.zs));
  if (width === 1440) ok(lay.card[4] === 600 && Math.abs((lay.card[0] + lay.card[2]) / 2 - lay.iw / 2) <= 1 && Math.abs((lay.card[1] + lay.card[3]) / 2 - lay.ih / 2) <= 1,
    `WS-5 ${inst} at 1440: the card is 600px wide and centred ` + JSON.stringify(lay.card));
  else ok(lay.card[0] === 12 && lay.card[1] === 12 && lay.card[2] === lay.iw - 12 && lay.card[3] === lay.ih - 12 && lay.ovY === "auto" && lay.scrolls,
    `WS-5 ${inst} at 390: the card fills the viewport with a 12px inset and scrolls inside itself ` + JSON.stringify(lay.card));
  ok(lay.sw === lay.iw && lay.inside && lay.minH >= 44 && lay.skipH >= 44 && lay.goFull,
    `WS-5b ${inst} at ${width}: nothing overflows, every chip inside the card, 44px targets, full-width Move me up (${lay.minH}, ${lay.skipH})`);
  if (width === 390) ok(lay.longFull, `WS-6 ${inst} at 390: persona and need chips run one per line`);
  else ok(!lay.longFull, `WS-6 ${inst} at 1440: persona and need chips wrap inline`);

  // Scroll lock: the page does not move under a real wheel, and the rest of the page is inert.
  const y0 = await ev("scrollY");
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 6, y: 6, deltaX: 0, deltaY: 600 }, sessionId); await sleep(300);
  const y1 = await ev("scrollY");
  ok(a.htmlOv === "hidden" && a.bodyOv === "hidden" && y1 === y0 && a.inert.length > 0 && a.inert.includes("sitenav"),
    `WS-7 ${inst} at ${width}: body scroll is locked (${y0} to ${y1}) and the page behind is inert ` + JSON.stringify(a.inert));

  // Focus trap: 40 real Tabs and 40 real Shift+Tabs never leave the card.
  const trap = JSON.parse(await ev(`JSON.stringify({ n: 0 })`));
  let out = 0, seen = new Set();
  for (let i = 0; i < 40; i++) { await key("Tab");
    const f = JSON.parse(await ev(`JSON.stringify({ in: document.querySelector('.wl-m-card').contains(document.activeElement), k: (document.activeElement.className || '') + ':' + (document.activeElement.value || document.activeElement.textContent.slice(0, 12)) })`));
    if (!f.in) out++; seen.add(f.k); }
  for (let i = 0; i < 40; i++) { await key("Tab", true);
    if (!(await ev(`document.querySelector('.wl-m-card').contains(document.activeElement)`))) out++; }
  ok(out === 0 && seen.size >= 7 && [...seen].some(k => k.startsWith("wl-m-x")) && [...seen].some(k => k.startsWith("wl-s2-skip")),
    `WS-8 ${inst} at ${width}: focus is trapped, 80 Tab presses stay in the card and cycle through ${seen.size} stops (${out} escaped)` + (trap.n ? "" : ""));

  // Close by one of the three skip routes, rotating with the instance, with answers chosen first.
  const route = { hero: "esc", join: "x", ea: "backdrop" }[inst];
  const z = await step2(inst, ["persona=curious", "chat=yes"], route);
  ok(z.calls.length === 0 && !z.open && !z.veil && z.pill && z.pillText === INBOX && z.focusPill,
    `WS-9 ${inst} at ${width}: ${route} behaves as Skip, no /profile request, the modal closes and focus returns to the done pill`);
  const y2 = await ev("scrollY");
  await send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 200, y: 300, deltaX: 0, deltaY: 400 }, sessionId); await sleep(400);
  const y3 = await ev("scrollY");
  ok(z.htmlOv !== "hidden" && z.bodyOv !== "hidden" && z.inert.length === 0 && y3 > y2,
    `WS-9b ${inst} at ${width}: closing unlocks the scroll (${y2} to ${y3}) and the page is no longer inert`);
}

// The other two skip routes at 390, and every route at 1440 by name, so each is covered on its own.
for (const [width, route] of [[1440, "esc"], [1440, "x"], [1440, "backdrop"], [390, "esc"], [390, "x"], [390, "backdrop"]]) {
  await open("index.html", width);
  await signup("join", { ok: true, notice: "listed", step2: S2TOK });
  const z = await step2("join", ["need=not_sure"], route);
  ok(z.calls.length === 0 && !z.open && z.pillText === LISTED && z.focusPill, `WS-9c ${route} at ${width}: no /profile request, closed, focus on the done pill`);
}
// Lenis cannot load here (the network is refused), so it is stood in by a recorder: the modal must
// stop it on open and start it again on close, or the wheel would still scroll the page behind.
await open("index.html", 1440);
await ev(`window.__lenis = { log: [], stop() { this.log.push('stop'); }, start() { this.log.push('start'); } }`);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
const lnOpen = await ev(`window.__lenis.log.join()`);
await step2("join", [], "esc");
const lnClosed = await ev(`window.__lenis.log.join()`);
const prevent = await ev(`document.querySelector('.wl-m-card').hasAttribute('data-lenis-prevent')`);
ok(lnOpen === "stop" && lnClosed === "stop,start" && prevent, `WS-9e Lenis is stopped while the modal is open and started on close, and the card scrolls natively (${lnClosed})`);
await ev(`delete window.__lenis`);

// A click inside the card is not a backdrop click.
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
await ev(`document.querySelector('.wl-s2-lede').click()`); await sleep(200);
ok((await state("join")).open, "WS-9d a click on the card itself leaves the modal open");

// One modal regardless of which form: sign up through the hero, close, then through the final CTA.
await open("index.html", 1440);
await signup("hero", { ok: true, notice: "inbox", step2: S2TOK });
await step2("hero", [], "x");
const second = await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
const nM = await ev(`document.querySelectorAll('#wl-modal, .wl-m, [role="dialog"]').length`);
ok(nM === 1 && second.open && second.visibleDialogs === 1 && second.checked.length === 0 && second.s2 && second.focusH,
  "WS-10 a second form opens the same single modal, reset to a fresh step 2");
const back = await step2("join", [], "esc");
ok(back.focusPill, "WS-10b and closing it returns focus to the second form's done pill, not the first's");

// Thanks, inside the modal, then Close.
for (const [width, inst] of [[1440, "hero"], [390, "ea"]]) {
  await open(PAGE[inst], width);
  await signup(inst, { ok: true, notice: "inbox", step2: S2TOK });
  const b = await step2(inst, ["persona=prefer_not_say"], "go");
  ok(b.goDisabled === "false" && b.calls.length === 1 && /\/functions\/v1\/waitlist-signup\/profile$/.test(b.calls[0].url)
    && JSON.stringify(b.calls[0].body) === JSON.stringify({ persona: "prefer_not_say", p: S2TOK }),
    `WS-11 ${inst} at ${width}: Prefer not to say alone is an answer, and only it and the token are sent ` + JSON.stringify(b.calls[0] && b.calls[0].body));
  ok(b.open && !b.s2 && b.res && b.rh === "Thank you, you've moved up." && b.rp === INBOX && b.focusRh,
    `WS-11b ${inst} at ${width}: thanks renders inside the modal, with today's inbox line`);
  const c = await step2(inst, [], "close");
  ok(!c.open && c.focusPill && c.pillText === "Thank you, you've moved up. " + INBOX && c.calls.length === 0,
    `WS-11c ${inst} at ${width}: Close shuts it, focus on the pill, which now carries the thank-you`);
}

// Behaviour, at 1440 on the final CTA. A fresh page for each case, so no closure state carries over.
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
let w = await step2("join", [], "go");
ok(w.goDisabled === "true" && w.calls.length === 0 && w.s2 && w.msg === "Pick any one answer to move up.",
  "WS-12 Move me up with nothing chosen sends nothing and asks for one answer");
w = await step2("join", ["need=not_sure", "need=not_sure"], null);
ok(w.checked.length === 0 && w.goDisabled === "true", "WS-12b a second tap on the chosen chip clears it " + JSON.stringify(w.checked));
w = await step2("join", ["persona=curious", "persona=stay_ahead", "need=home_panel_tracked", "heard=podcast_article", "chat=yes"], "go");
ok(w.calls.length === 1 && JSON.stringify(w.calls[0].body) === JSON.stringify({ persona: "stay_ahead", need: "home_panel_tracked", heard: "podcast_article", chat: true, p: S2TOK }),
  "WS-12c single select per question, the last tap wins, chat Yes is sent as true " + JSON.stringify(w.calls[0] && w.calls[0].body));

await open("index.html", 1440);
await signup("join", { ok: true, notice: "listed", step2: S2TOK });
w = await step2("join", ["chat=no"], "go");
ok(w.calls[0] && w.calls[0].body.chat === false && w.rp === LISTED, "WS-13 chat No is sent as false, and a listed signup's thanks never says check your inbox");

for (const [notice, text, tail] of [["inbox", INBOX, "Check your inbox."], ["listed", LISTED, "We'll email you when early access opens."]]) {
  await open("index.html", 1440);
  await signup("join", { ok: true, notice, step2: S2TOK });
  w = await step2("join", ["persona=results_normal_feel_off"], "skip");
  ok(w.calls.length === 0 && w.open && w.res && w.rh === "You're on the list." && w.rp === tail && w.focusRh,
    `WS-14 Skip for now (${notice}) sends nothing and renders the skipped state in the modal, today's done text exactly`);
  w = await step2("join", [], "close");
  ok(!w.open && w.focusPill && w.pillText === text && w.calls.length === 0, `WS-14b (${notice}) then Close, focus on the unchanged done pill`);
}

await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
w = await step2("join", ["heard=search"], "go", { status: 500, body: { error: "server" } });
ok(w.s2 && w.open && w.msg === "We couldn't save your answers. You're still on the list." && w.checked.join() === "heard=search" && !w.goHidden && w.goText === "Move me up",
  "WS-15 a failed save keeps the answers, says so, and allows one retry");
w = await step2("join", [], "go", "throw");
ok(w.s2 && w.goHidden && w.msg.startsWith("We couldn't save"), "WS-15b after a second failure only Skip remains");
w = await step2("join", [], "skip");
ok(w.res && w.rh === "You're on the list." && w.calls.length === 0, "WS-15c and Skip still ends cleanly");
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
w = await step2("join", ["heard=other"], "go", { status: 400, body: { error: "bad_request" } });
ok(w.res && w.rh === "You're on the list." && w.rp === "Check your inbox.", "WS-15d a 400 ends as skipped, never claiming a move");
await open("index.html", 1440);
for (const body of [{ ok: true, notice: "inbox", step2: "not-a-token" }, { ok: true, notice: "inbox" }]) {
  const bad = await signup("join", body);
  ok(!bad.open && !bad.veil && bad.pill && bad.pillText === INBOX && bad.htmlOv !== "hidden",
    "WS-15e " + (body.step2 ? "a malformed token" : "no token (an older function)") + " means today's done state and no modal");
  await ev(`(() => { const b = document.querySelector('#wl-email-join').closest('.wl-block'); b.querySelector('.wl-form').hidden = false; b.querySelector('.wl-done').hidden = true; })()`);
}

// Fallback and reduced motion, by emulation.
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
await open("index.html", 1440);
await signup("hero", { ok: true, notice: "inbox", step2: S2TOK });
const rm = JSON.parse(await ev(`JSON.stringify({ cls: document.documentElement.className, canvas: getComputedStyle(document.getElementById('orb-canvas')).display,
  pearl: !document.querySelector('.wl-m-pearl').hidden, anims: ['.wl-m-veil', '.wl-m-card', '.wl-m-pearl'].map(s => getComputedStyle(document.querySelector(s)).animationName) })`));
ok(/\borb-static\b/.test(rm.cls) && rm.canvas === "none" && rm.pearl && rm.anims.every(n => n === "none"),
  "WS-16 reduced motion: the static pearl is the orb, and nothing animates, veil, card or orb " + JSON.stringify(rm.anims));
await send("Emulation.setEmulatedMedia", { features: [] }, sessionId);
await open("index.html", 1440);
const fb = JSON.parse(await ev(`(() => {
  // A browser without backdrop-filter: evaluate the page's own @supports fallback by reading the rule.
  const rules = []; for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.conditionText && /not/.test(r.conditionText) && /backdrop-filter/.test(r.conditionText)) rules.push(r.cssText); } catch (e) {} }
  return JSON.stringify(rules);
})()`));
ok(fb.length === 1 && /\.wl-m-veil\s*\{\s*background:\s*rgba\(247, 239, 233, 0\.92\)/.test(fb[0]),
  "WS-16b without backdrop-filter the veil falls back to solid cream at 0.92 (" + (fb[0] || "").replace(/\s+/g, " ") + ")");

// WS-18. The orb behind the modal (founder ruling 2026-10-27): centred, and for the pearl 1.6x its #join
// size (the live orb is 1.2x, WS-18c, since pearl.png has transparent padding and the canvas does not),
// back to exactly its section box on close. Headless runs the pearl path, so that is measured on
// screen. The live canvas path is checked at its wiring: a recorder stands in for window.__orb.
const pearlBox = (sel) => `(() => { const el = document.querySelector('${sel}');
  // The drift animation moves the pearl by up to 14px and 2%. Hold it at its rest frame to measure.
  el.getAnimations().forEach(a => { if (a.animationName === 'wlmDrift') { a.pause(); a.currentTime = 0; } });
  const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height, innerWidth, innerHeight]; })()`;
for (const width of [1440, 390]) {
  await open("index.html", width);
  // The same scroll signup() will use, so the pre-open and post-close boxes are read from one position.
  await ev(`document.querySelector('#wl-email-join').closest('.wl-block').scrollIntoView({ block: 'center', behavior: 'instant' })`);
  const pre = await ev(pearlBox("#join .pearl-static"));
  await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
  await sleep(400);
  const big = await ev(pearlBox(".wl-m-pearl"));
  const cx = big[0] + big[2] / 2, cy = big[1] + big[3] / 2;
  ok(Math.abs(cx - big[4] / 2) <= 3 && Math.abs(cy - big[5] / 2) <= 3 && big[2] >= 1.5 * pre[2] && big[3] >= 1.5 * pre[3],
    `WS-18 join at ${width}: with the modal open the orb is centred (${Math.round(cx)},${Math.round(cy)} in ${big[4]}x${big[5]}) and ${(big[2] / pre[2]).toFixed(2)}x its pre-open size (${Math.round(pre[2])} to ${Math.round(big[2])}px)`);
  await step2("join", [], "esc");
  const post = await ev(pearlBox("#join .pearl-static"));
  const gone = await ev(`document.querySelector('.wl-m-pearl').hidden`);
  ok(gone && post.every((v, i) => Math.abs(v - pre[i]) <= 0.5), `WS-18b join at ${width}: after close the orb is back in its pre-open box ` + JSON.stringify([pre, post].map(b => b.slice(0, 4).map(Math.round))));
}
for (const [width, s, reduce] of [[1440, 0.86, false], [390, 1.05, false], [1440, 0.86, true]]) {
  if (reduce) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }, sessionId);
  await open("index.html", width);
  await ev(`(() => { const r = document.documentElement; r.classList.remove('orb-static'); r.classList.add('orb-live');
    window.__orb = { log: [], measure() {}, force(f, d) { this.log.push([f, d]); } }; })()`);
  await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
  const o = JSON.parse(await ev(`JSON.stringify({ log: window.__orb.log, pearl: !document.querySelector('.wl-m-pearl').hidden, z: getComputedStyle(document.getElementById('orb-canvas')).zIndex })`));
  await step2("join", [], "x");
  const after = JSON.parse(await ev(`JSON.stringify(window.__orb.log)`));
  const d = reduce ? 0 : 600, f = o.log[0] && o.log[0][0];
  ok(o.log.length === 1 && f && f.x === 0 && f.y === 0 && Math.abs(f.s - s * 1.2) < 1e-9 && o.log[0][1] === d && !o.pearl && o.z === "1001",
    `WS-18c live orb at ${width}${reduce ? ", reduced motion" : ""}: forced to the centre at 1.2x the #join keyframe (${f && f.s.toFixed(3)}), over ${d}ms, above the veil, no pearl`);
  ok(after.length === 2 && after[1][0] === null && after[1][1] === d,
    `WS-18d live orb at ${width}${reduce ? ", reduced motion" : ""}: released on close over ${d}ms, so the engine returns to the section keyframe`);
  if (reduce) await send("Emulation.setEmulatedMedia", { features: [] }, sessionId);
}

// WS-19. Move me up and Skip are a sticky footer: in view without scrolling, and nothing is ever stuck
// under them. The content must actually overflow the card for the first half to mean anything.
for (const [width, height] of [[1440, 800], [390, 844]]) {
  await open("index.html", width, height);
  await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
  const f = JSON.parse(await ev(`(async () => {
    const card = document.querySelector('.wl-m-card'), go = card.querySelector('.wl-s2-go'), skip = card.querySelector('.wl-s2-skip'), foot = card.querySelector('.wl-s2-actions');
    const box = e => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom }; };
    const c0 = box(card), g0 = box(go), s0 = box(skip), st = card.scrollTop, overflow = card.scrollHeight - card.clientHeight, pos = getComputedStyle(foot).position;
    card.scrollTop = card.scrollHeight; await new Promise(r => setTimeout(r, 100));
    const chips = [...card.querySelectorAll('.wl-chip span')], lastChip = box(chips[chips.length - 1]), f1 = box(foot), g1 = box(go), c1 = box(card);
    const msgInFoot = foot.contains(card.querySelector('#wl-s2-msg'));
    return JSON.stringify({ c0, g0, s0, st, overflow, pos, lastChip, f1, g1, c1, msgInFoot });
  })()`));
  ok(f.overflow > 40 && f.pos === "sticky", `WS-19 at ${width}x${height}: control, the step-2 content overflows the card by ${Math.round(f.overflow)}px, and the footer is sticky`);
  ok(f.st === 0 && f.g0.t >= f.c0.t && f.g0.b <= f.c0.b && f.s0.b <= f.c0.b + 0.5,
    `WS-19b at ${width}x${height}: Move me up and Skip are inside the visible card without scrolling (button ${Math.round(f.g0.t)} to ${Math.round(f.g0.b)}, card to ${Math.round(f.c0.b)})`);
  ok(f.lastChip.b <= f.f1.t + 1 && f.g1.b <= f.c1.b && f.msgInFoot,
    `WS-19c at ${width}x${height}: scrolled to the end, the last chip clears the footer, and the message lives in the footer`);
}

// WS-20. The city question (2026-10-27): first, sent as region only when chosen, counts on its own,
// and closing still sends nothing.
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
const firstQ = await ev(`document.querySelector('#wl-modal .wl-q legend').textContent`);
const codes = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#wl-modal input[name="region"]')].map(i => i.value))`));
ok(firstQ === "Where do you live?" && codes.join() === "bangalore,mumbai,delhi_ncr,chennai,hyderabad,pune,kolkata,india_other,us,uk,outside_other",
  "WS-20 the city question comes first, with the 11 codes /tag accepts, in its order");
w = await step2("join", ["region=pune"], "go");
ok(w.goDisabled === "false" && w.calls.length === 1 && JSON.stringify(w.calls[0].body) === JSON.stringify({ region: "pune", p: S2TOK }) && w.rh === "Thank you, you've moved up.",
  "WS-20b a city alone is an answer: only region and the token are sent, and it ends in thanks " + JSON.stringify(w.calls[0] && w.calls[0].body));
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
w = await step2("join", ["persona=curious"], "go");
ok(w.calls.length === 1 && !("region" in w.calls[0].body), "WS-20c with no city chosen, no region is sent");
await open("index.html", 1440);
await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
w = await step2("join", ["region=uk", "region=uk"], null);
ok(w.checked.length === 0 && w.goDisabled === "true", "WS-20d a second tap on the chosen city clears it, like every other chip");
for (const route of ["esc", "x", "backdrop"]) {
  await open("index.html", 1440);
  await signup("join", { ok: true, notice: "inbox", step2: S2TOK });
  w = await step2("join", ["region=mumbai"], route);
  ok(w.calls.length === 0 && !w.open, `WS-20e a city chosen, then ${route}: nothing is sent`);
}

// WS-17. The token never leaves the closure, and no chip is ever coral or off the site font.
await open("index.html?utm_source=ig", 1440);
await signup("hero", { ok: true, notice: "inbox", step2: S2TOK });
const leak = JSON.parse(await ev(`JSON.stringify({ href: location.href, html: document.documentElement.outerHTML.includes('${S2TOK}'),
  ls: JSON.stringify(Object.assign({}, localStorage)).includes('${S2TOK}'), ss: JSON.stringify(Object.assign({}, sessionStorage)).includes('${S2TOK}'),
  cookie: document.cookie.includes('${S2TOK}') })`));
ok(!leak.href.includes(S2TOK) && !leak.html && !leak.ls && !leak.ss && !leak.cookie, "WS-17 the step-2 token is not in the URL, the DOM, storage or cookies");

const col = JSON.parse(await ev(`(async () => {
  const root = getComputedStyle(document.documentElement);
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const norm = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
  const coral = new Set();
  for (const s of document.styleSheets) { try { for (const r of s.cssRules) { if (r.selectorText === ':root') for (const p of r.style) if (p.startsWith('--coral')) coral.add(norm(root.getPropertyValue(p).trim())); } } catch (e) {} }
  [...coral].forEach(c => { const m = c.match(/[\\d.]+/g); if (m) coral.add('rgba(' + m.slice(0, 3).join(', ') + ', 0.6)'); });
  const isCoral = c => coral.has(c) || [...coral].some(k => c.includes(k.replace(/^rgb\\(|\\)$/g, '')));
  const read = el => { const cs = getComputedStyle(el); return [cs.backgroundColor, cs.borderTopColor, cs.color, cs.outlineColor]; };
  const s2 = document.querySelector('#wl-modal .wl-step2');
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
ok(col.n >= 5 && col.control > 0, `WS-17b control, the coral detector reads ${col.n} --coral tokens and catches the page's coral chips`);
ok(col.nOn === 5 && col.offHits.length === 0 && col.onHits.length === 0, "WS-17c no coral on any chip, unselected or selected " + JSON.stringify([col.offHits, col.onHits]));
ok(col.chosenBg === "rgb(71, 55, 43)" && col.chosenFg === "rgb(248, 242, 236)" && col.tick, `WS-17d a chosen chip is ink with cream text and a cream tick (${col.chosenBg}, ${col.chosenFg})`);
ok(col.fonts.length === 1 && /^"?Instrument Sans"?,/.test(col.fonts[0]) && !/Inter\b/.test(col.fonts[0]), "WS-17e step-2 labels are Instrument Sans, no Inter " + JSON.stringify(col.fonts));
const s2src = index.slice(index.indexOf('<div class="wl-m" id="wl-modal"'), index.indexOf("<script>", index.indexOf('<div class="wl-m" id="wl-modal"')));
const strings = [...s2src.matchAll(/>([^<>]+)</g)].map(m => m[1].trim()).filter(Boolean);
ok(strings.length > 20 && strings.every(x => !/[:—–]/.test(x)), "WS-17f no colon or em dash in any modal string (" + strings.length + " checked)");

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
