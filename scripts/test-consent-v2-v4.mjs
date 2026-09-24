#!/usr/bin/env node
// CONSENT_V2_V4_DARK -- core consent v2 and Sana consent v4, built dark.
//
// FLAG OFF is tested against the committed file. FLAG ON is tested against an IN-MEMORY COPY of
// the shipped source with the one flag line flipped, so what runs is the real code, never a
// re-implementation, and nothing on disk changes. Every flag-on string is hashed and compared
// with the server's digest from supa consent-versions.ts; a one-character mutant of each must fail
// that comparison, and a mutant that sends the Sana version for core must fail the withdrawal
// check, so each check is proven able to fire. Every mutant is parsed first, so it is valid JS.
//
//   node scripts/test-consent-v2-v4.mjs        (or DASH=path/to/dashboard.html)
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const HTML = readFileSync(process.env.DASH || "dashboard.html", "utf8");
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const CORE_V2_SHA = "069c1bfe69b4fb01cb84b8d82db6f4c719ef6d353efdf584d4537a5ec55e67cd";
const SANA_V4_SHA = "98e8c45ca85d7ef334675584464cfb02fd0b25babeb0cba26486f2087e39d640";
const SANA_V31_SHA = "9a01eab1091ff0b1add8c5b625f1a73d3d9dfe81b60358bfa9e7c1f0376aec0d";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}  (got ${JSON.stringify(a)})`);

// ── the app block, located the way the other scripts locate it ───────────────
const lines = HTML.split("\n");
const opens = lines.map((l, i) => (l.trim() === "<script>" ? i : -1)).filter((i) => i >= 0);
const closes = lines.map((l, i) => (l.trim() === "</script>" ? i : -1)).filter((i) => i >= 0);
const s = opens[opens.length - 1], e = closes.filter((c) => c > s)[0];
const APP = lines.slice(s + 1, e).join("\n");
ok(s != null && e != null && APP.length > 100000, "REACHABILITY: the app script block was located and is not empty");

const constLine = (src, name) => new RegExp("^const " + name + " = [^\\n]*;$", "m").exec(src)?.[0] ?? null;
const fnSrc = (src, name) => {
  const at = src.search(new RegExp("(async )?function " + name + "\\("));
  if (at < 0) return null;
  let d = 0, j = src.indexOf("{", at);
  for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; }
  return src.slice(at, j + 1);
};
// SANA_COPY is a multi-line object literal; brace-match it from its declaration.
const objSrc = (src, name) => {
  const at = src.indexOf("const " + name + " = {");
  if (at < 0) return null;
  let d = 0, j = src.indexOf("{", at);
  for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; }
  return src.slice(at, j + 1) + ";";
};

const CONSTS = ["CORE_CONSENT_V2_ENABLED", "CORE_CONSENT_V2_TEXT", "CORE_CONSENT_VERSION",
  "SANA_CONSENT_VERSION", "SANA_CONSENT_V4_ENABLED", "SANA_CONSENT_V4_TEXT", "SANA_CONSENT_TEXT_APPROVED"];

// Build a sandbox from a source string: the constants, SANA_COPY, and the real functions.
function load(src, extra = {}) {
  const parts = CONSTS.map((n) => constLine(src, n));
  if (parts.some((p) => !p)) throw new Error("constant not located: " + CONSTS[parts.findIndex((p) => !p)]);
  const body = [...parts, objSrc(src, "SANA_COPY"),
    ...["applyCoreConsentText", "sanaConsentBody", "consentVersionFor", "consentPost", "sanaConsentGranted"]
      .map((n) => { const f = fnSrc(src, n); if (!f) throw new Error("function not located: " + n); return f; }),
  ].join("\n");
  const names = Object.keys(extra);
  return new Function(...names, body + "\nreturn { " + CONSTS.join(", ") +
    ", SANA_COPY, applyCoreConsentText, sanaConsentBody, consentVersionFor, consentPost, sanaConsentGranted };")(
    ...names.map((n) => extra[n]));
}
const flip = (src, name) => {
  const line = `const ${name} = false;`;
  if ((src.split(line).length - 1) !== 1) throw new Error("flag line not found exactly once: " + name);
  return src.replace(line, `const ${name} = true;`);
};

// A fake DOM just rich enough for applyCoreConsentText: a span that records what is appended.
function fakeDom({ throwIfTouched = false } = {}) {
  const span = {
    parts: [],
    set textContent(v) { this.parts = v ? [v] : []; },
    get textContent() { return this.parts.map((p) => (typeof p === "string" ? p : p.textContent)).join(""); },
    append(...xs) { this.parts.push(...xs); },
  };
  const row = { querySelector: (q) => (q === "span" ? span : null) };
  const guard = (f) => (...a) => { if (throwIfTouched) throw new Error("DOM touched with the flag off"); return f(...a); };
  return {
    span,
    $: guard((id) => (id === "consent-row" ? row : null)),
    document: { createElement: guard(() => ({ href: "", target: "", rel: "", textContent: "" })) },
  };
}
// A fetch spy and a consent_events reader for consentPost and sanaConsentGranted.
function net(latest) {
  const log = { posts: [], selects: [] };
  const sb = {
    auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
    from: (t) => {
      const q = { select: (cols) => { log.selects.push(cols); return q; }, eq: () => q, order: () => q,
                  limit: async () => ({ data: latest ? [latest] : [], error: null }) };
      return q;
    },
  };
  const fetch = async (_u, o) => { log.posts.push(JSON.parse(o.body)); return { ok: true }; };
  return { log, extra: { sb, fetch, SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "k", SANA_CONSENT_STATE: null } };
}

console.log("CONSENT_V2_V4_DARK");

// ── the strings: once each in the file, hashing to the server's digests ──────
const OFF = load(APP);
eq([OFF.CORE_CONSENT_V2_ENABLED, OFF.SANA_CONSENT_V4_ENABLED], [false, false], "both flags are false in the committed file");
eq(HTML.split(OFF.CORE_CONSENT_V2_TEXT).length - 1, 1, "the core v2 string exists exactly once in the file");
eq(HTML.split(OFF.SANA_CONSENT_V4_TEXT).length - 1, 1, "the sana v4 string exists exactly once in the file");
eq(sha(OFF.CORE_CONSENT_V2_TEXT), CORE_V2_SHA, "the core v2 string hashes to the server's core v2 sha256");
eq(sha(OFF.SANA_CONSENT_V4_TEXT), SANA_V4_SHA, "the sana v4 string hashes to the server's sana v4 sha256");

// ── FLAG OFF: today's behaviour, plus the withdrawal fix ─────────────────────
{
  const dom = fakeDom({ throwIfTouched: true });
  const m = load(APP, { $: dom.$, document: dom.document });
  let threw = null; try { m.applyCoreConsentText(); } catch (x) { threw = x.message; }
  eq(threw, null, "OFF: applyCoreConsentText leaves the checkbox markup untouched");
  eq(m.CORE_CONSENT_VERSION, "v1", "OFF: core consent is recorded as v1");
  eq(sha(m.sanaConsentBody()), SANA_V31_SHA, "OFF: the Sana card body is the v3.1 notice");
}
for (const [latest, want, label] of [
  [{ action: "granted", occurred_at: "t", consent_version: "v3.1" }, true, "a v3.1 grant counts"],
  [{ action: "withdrawn", occurred_at: "t", consent_version: "v3.1" }, false, "a withdrawal does not"],
  [null, false, "no row does not"],
]) {
  const n = net(latest); const m = load(APP, n.extra);
  eq(await m.sanaConsentGranted(), want, "OFF: sanaConsentGranted, " + label);
  eq(n.log.selects, ["action, occurred_at"], "OFF: and it selects exactly what it selected before");
}
async function withdrawVersions(src, extraFlags = []) {
  let code = src; for (const f of extraFlags) code = flip(code, f);
  const n = net(null); const m = load(code, n.extra);
  await m.consentPost("core", "withdrawn", m.consentVersionFor("core"));
  await m.consentPost("sana", "withdrawn", m.consentVersionFor("sana"));
  return n.log.posts.map((p) => `${p.consent_type}/${p.consent_version}/${p.action}`);
}
eq(await withdrawVersions(APP), ["core/v1/withdrawn", "sana/v3.1/withdrawn"],
   "OFF: withdrawing core sends core's version (v1), withdrawing Sana sends Sana's (v3.1)");

// ── FLAG ON, core, in an in-memory copy ──────────────────────────────────────
{
  const code = flip(APP, "CORE_CONSENT_V2_ENABLED");
  const dom = fakeDom();
  const m = load(code, { $: dom.$, document: dom.document });
  m.applyCoreConsentText();
  eq(sha(dom.span.textContent), CORE_V2_SHA, "ON core: the rendered checkbox text hashes to the server's core v2 sha256");
  const link = dom.span.parts.find((p) => typeof p !== "string");
  eq(link && [link.href, link.target, link.rel, link.textContent], ["/privacy", "_blank", "noopener", "privacy page"],
     "ON core: the privacy link is kept as today");
  eq(m.CORE_CONSENT_VERSION, "v2", "ON core: core consent is recorded as v2");
}
eq(await withdrawVersions(APP, ["CORE_CONSENT_V2_ENABLED"]), ["core/v2/withdrawn", "sana/v3.1/withdrawn"],
   "ON core: a core withdrawal sends v2, Sana is unaffected");

// ── FLAG ON, Sana, in an in-memory copy ──────────────────────────────────────
{
  const code = flip(APP, "SANA_CONSENT_V4_ENABLED");
  const m = load(code, net(null).extra);
  eq(sha(m.sanaConsentBody()), SANA_V4_SHA, "ON sana: the card body hashes to the server's sana v4 sha256");
  eq(m.consentVersionFor("sana"), "v4", "ON sana: the version sent is v4");
  for (const [latest, want, label] of [
    [{ action: "granted", occurred_at: "t", consent_version: "v3.1" }, false, "a v3.1 grant is asked again"],
    [{ action: "granted", occurred_at: "t", consent_version: "v4" }, true, "a v4 grant counts"],
    [{ action: "withdrawn", occurred_at: "t", consent_version: "v4" }, false, "a v4 withdrawal does not"],
  ]) {
    const n = net(latest); const mm = load(code, n.extra);
    eq(await mm.sanaConsentGranted(), want, "ON sana: sanaConsentGranted, " + label);
    eq(n.log.selects, ["action, occurred_at, consent_version"], "ON sana: and it reads the version");
  }
}
eq(await withdrawVersions(APP, ["SANA_CONSENT_V4_ENABLED"]), ["core/v1/withdrawn", "sana/v4/withdrawn"],
   "ON sana: a Sana withdrawal sends v4, core is unaffected");

// ── MUTANTS: each check above must be able to fail ───────────────────────────
const mutate = (src, from, to) => {
  if ((src.split(from).length - 1) !== 1) throw new Error("mutant anchor not found exactly once: " + from.slice(0, 60));
  const out = src.replace(from, to);
  new Function(out);            // valid JS, or this throws
  return out;
};
{
  const t = OFF.CORE_CONSENT_V2_TEXT;
  const mut = mutate(APP, t, t.replace("privacy page.", "privacy page!"));
  const dom = fakeDom();
  const m = load(flip(mut, "CORE_CONSENT_V2_ENABLED"), { $: dom.$, document: dom.document });
  m.applyCoreConsentText();
  ok(sha(dom.span.textContent) !== CORE_V2_SHA, "MUTANT: a one-character change to the core v2 text fails the hash check");
}
{
  const t = OFF.SANA_CONSENT_V4_TEXT;
  const mut = mutate(APP, t, t.replace("removes it.", "removes it!"));
  const m = load(flip(mut, "SANA_CONSENT_V4_ENABLED"), net(null).extra);
  ok(sha(m.sanaConsentBody()) !== SANA_V4_SHA, "MUTANT: a one-character change to the sana v4 text fails the hash check");
}
{
  const mut = mutate(APP, 'if(type === "core") return CORE_CONSENT_VERSION;', 'if(type === "core") return SANA_CONSENT_VERSION;');
  const got = await withdrawVersions(mut);
  ok(JSON.stringify(got) !== JSON.stringify(["core/v1/withdrawn", "sana/v3.1/withdrawn"]),
     "MUTANT: sending SANA_CONSENT_VERSION for core fails the withdrawal check (got " + JSON.stringify(got) + ")");
}
{
  const mut = mutate(APP, '(!SANA_CONSENT_V4_ENABLED || data[0].consent_version === "v4")', "true");
  const n = net({ action: "granted", occurred_at: "t", consent_version: "v3.1" });
  const m = load(flip(mut, "SANA_CONSENT_V4_ENABLED"), n.extra);
  ok((await m.sanaConsentGranted()) === true, "MUTANT: ignoring the version lets a v3.1 grant through, which the re-ask check above rejects");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
