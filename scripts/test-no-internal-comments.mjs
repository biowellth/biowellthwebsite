// HTML_COMMENT_CLEANUP_V1. No served page carries an internal comment. Page comments are public in the
// page source, and on 2026-10-27 privacy.html was found telling every reader that counsel had not yet
// approved its wording. Every comment then on a served page was moved to
// docs/html-comment-archive-2026-10-27.md and removed. Internal notes belong in docs/, commit messages,
// or the CSS and JS comments, never in a <!-- --> comment.
//
// "Served" is every tracked .html file outside the exclude list in _config.yml, read from that file so
// a new exclusion is honoured automatically. A comment is a real HTML comment only: text that merely
// looks like one inside <script>, <style>, <textarea> or <title> is not a comment and is ignored, the
// way the browser ignores it.
//
// Fails on any comment matching the pattern below, and also reports (without failing) the count of any
// other comments, so a new harmless one is visible.
//
//   node scripts/test-no-internal-comments.mjs        (ROOT=/path/to/checkout)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.env.ROOT || ".";
const PATTERN = /counsel|approved|approval|ruling|founder|session|commit|determination|TODO/i;

let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const done = () => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); };

// Real comments only. Raw-text elements are blanked first, keeping their length, so a "<!--" inside a
// script is not counted and a "<script>" inside a comment cannot hide the comments after it.
function comments(src) {
  const out = [];
  let i = 0;
  const raw = /<(script|style|textarea|title)\b[^>]*>/gi;
  while (i < src.length) {
    const c = src.indexOf("<!--", i);
    raw.lastIndex = i;
    const r = raw.exec(src);
    if (c < 0 && !r) break;
    if (r && (c < 0 || r.index < c)) {
      const end = src.toLowerCase().indexOf("</" + r[1].toLowerCase(), raw.lastIndex);
      i = end < 0 ? src.length : end;
      continue;
    }
    const e = src.indexOf("-->", c + 4);
    const body = e < 0 ? src.slice(c + 4) : src.slice(c + 4, e);
    out.push({ line: src.slice(0, c).split("\n").length, body });
    i = e < 0 ? src.length : e + 3;
  }
  return out;
}

// The exclude list, read from _config.yml.
const cfg = readFileSync(join(ROOT, "_config.yml"), "utf8");
const block = (cfg.match(/^exclude:\s*\n((?:\s+-\s+.+\n?)+)/m) || [])[1] || "";
const excludes = [...block.matchAll(/-\s+(.+)/g)].map(m => m[1].trim());
ok(excludes.includes("docs/") && excludes.includes("scripts/"), "control, the exclude list reads from _config.yml " + JSON.stringify(excludes));
const isExcluded = f => excludes.some(x => x.endsWith("/") ? f.startsWith(x) : f === x);
const files = execFileSync("git", ["ls-files", "*.html"], { cwd: ROOT }).toString().split("\n").filter(Boolean).filter(f => !isExcluded(f));
ok(files.includes("index.html") && files.includes("privacy.html") && files.includes("dashboard.html"), `control, ${files.length} served pages found, the three main ones among them`);

// Known positives (rule 20): the detector must catch what it exists to catch, and must not be fooled
// by look-alikes in raw text.
const probe = `<p>a</p><!-- Approved verbatim by counsel --><script>var s = "<!-- founder -->";</script>
<!-- harmless label --><style>/* <!-- TODO --> */</style><!--
  POLICY: ruling of the founder, session 9 -->`;
const pc = comments(probe);
ok(pc.length === 3 && pc.filter(c => PATTERN.test(c.body)).length === 2 && pc[2].line === 2,
  "control, a synthetic page: 3 real comments found, 2 internal, the ones inside <script> and <style> ignored");
ok(comments(`<!-- has <script> in it --><!-- counsel -->`).length === 2, "control, a comment that mentions <script> does not hide the comment after it");

let other = 0;
for (const f of files) {
  const found = comments(readFileSync(join(ROOT, f), "utf8"));
  const bad = found.filter(c => PATTERN.test(c.body));
  other += found.length - bad.length;
  ok(bad.length === 0, `${f}: no internal comment` + (bad.length ? " " + JSON.stringify(bad.map(c => `:${c.line} ${c.body.trim().slice(0, 80)}`)) : ""));
}
console.log(`\n  (other comments on served pages, not failing: ${other})`);

// ── CODE_COMMENT_CLEANUP_V1 (2026-10-27): CSS and JS comments ─────────────────────────────────────
// The same rule for /* */ and // comments inside <style> and <script> on served pages, and in served
// .js and .css files. Internal records moved to docs/code-comment-archive-2026-10-27.md. Technical
// comments stay; only an internal reference inside one was stripped.
//
// A comment that must name real code may: a match inside `backticks`, or inside an identifier that
// contains an underscore (SANA_CONSENT_TEXT_APPROVED), is not a reference. Those are code names, and
// the exemption is pinned narrow by the controls below.
// Word-start boundaries, because "confounder" (a blood-draw confounder, CONFOUNDER_NOTE_V1) is a real
// technical word in the dashboard and contains "founder".
const CODE_PATTERN = /\b(counsel|approved|approval|ruling|founder|determination|session lock)/i;
const codeHit = (t) => CODE_PATTERN.test(t.replace(/`[^`\n]*`/g, " ").replace(/[A-Za-z0-9]*_[A-Za-z0-9_]*/g, " "));

// JS comments, without a parser (this repo has no dependencies). Strings, template literals (with
// nested ${}), and regex literals are skipped; a "/" starts a regex when the previous significant
// token cannot end an expression. Cross-checked against acorn on every served script on 2026-10-27:
// the same comments at the same offsets.
function jsComments(code) {
  const out = []; let i = 0, prev = "", depth = [];
  const kw = /^(return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;
  const regexOk = () => prev === "" || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || kw.test(prev);
  while (i < code.length) {
    const c = code[i], d = code[i + 1];
    if (c === "/" && d === "/") { const e = code.indexOf("\n", i); const end = e < 0 ? code.length : e; out.push({ at: i, text: code.slice(i + 2, end) }); i = end; continue; }
    if (c === "/" && d === "*") { const e = code.indexOf("*/", i + 2); const end = e < 0 ? code.length : e + 2; out.push({ at: i, text: code.slice(i + 2, end - 2) }); i = end; continue; }
    if (c === "'" || c === '"') { i++; while (i < code.length && code[i] !== c) { if (code[i] === "\\") i++; i++; } i++; prev = "str"; continue; }
    if (c === "`") { i++; while (i < code.length && code[i] !== "`") { if (code[i] === "\\") { i += 2; continue; } if (code[i] === "$" && code[i + 1] === "{") { depth.push(1); i += 2; break; } i++; } if (code[i] === "`") { i++; prev = "str"; } continue; }
    if (c === "}" && depth.length) { depth.pop(); i++; while (i < code.length && code[i] !== "`") { if (code[i] === "\\") { i += 2; continue; } if (code[i] === "$" && code[i + 1] === "{") { depth.push(1); i += 2; break; } i++; } if (code[i] === "`") { i++; prev = "str"; } continue; }
    if (c === "/" && regexOk()) { i++; let cls = false; while (i < code.length && (code[i] !== "/" || cls) && code[i] !== "\n") { if (code[i] === "\\") i++; else if (code[i] === "[") cls = true; else if (code[i] === "]") cls = false; i++; } i++; while (/[a-z]/i.test(code[i] || "")) i++; prev = "re"; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z0-9_$]/.test(c)) { const m = code.slice(i).match(/^[A-Za-z0-9_$.]+/)[0]; prev = m; i += m.length; continue; }
    prev = c; i++;
  }
  return out;
}
function cssComments(css) {
  const out = []; let i = 0, q = null;
  while (i < css.length) {
    const c = css[i];
    if (q) { if (c === "\\") { i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === '"' || c === "'") { q = c; i++; continue; }
    if (c === "/" && css[i + 1] === "*") { const e = css.indexOf("*/", i + 2); const end = e < 0 ? css.length : e + 2; out.push({ at: i, text: css.slice(i + 2, end - 2) }); i = end; continue; }
    i++;
  }
  return out;
}
const JS_TYPES = /^(|text\/javascript|application\/javascript|module)$/i;
function codeComments(src, isFile) {
  if (isFile === "js") return jsComments(src).map(c => ({ ...c, line: src.slice(0, c.at).split("\n").length }));
  if (isFile === "css") return cssComments(src).map(c => ({ ...c, line: src.slice(0, c.at).split("\n").length }));
  const out = [];
  for (const m of src.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    const base = m.index + m[0].indexOf(">") + 1;
    const type = ((m[2].match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || "");
    const found = m[1].toLowerCase() === "style" ? cssComments(m[3]) : JS_TYPES.test(type) ? jsComments(m[3]) : [];
    for (const c of found) out.push({ text: c.text, line: src.slice(0, base + c.at).split("\n").length });
  }
  return out;
}

// Known positives (rule 20).
const jsProbe = `var a = "// counsel"; var r = /\\/\\/ founder/g; var t = \`/* ruling \${ "x" } */\`;
// approved by counsel
var b = a / 2; /* founder ruling */ var c = "ok";
// SANA_CONSENT_TEXT_APPROVED stays false until \`approved: true\`
// founder_name and a founder ruling`;
const jp = jsComments(jsProbe);
ok(jp.length === 4 && jp.filter(c => codeHit(c.text)).length === 3,
  "control, synthetic JS: 4 real comments (none from the string, regex or template), 3 internal " + JSON.stringify(jp.map(c => c.text.trim().slice(0, 30))));
ok(!codeHit(" SANA_CONSENT_TEXT_APPROVED stays false until `approved: true`") && codeHit(" founder_name and a founder ruling"),
  "control, the code-name exemption covers backticks and underscore identifiers only, and prose beside them is still caught");
ok(!codeHit(" the draw-day confounder defers this marker") && codeHit(" Founder-approved copy"),
  "control, \"confounder\" is not a hit, \"Founder-approved\" is");
const cp = cssComments(`.a{content:"/* counsel */"}/* approved mockup */.b{background:url('x/*y*/z')}/* spacing */`);
ok(cp.length === 2 && cp.filter(c => codeHit(c.text)).length === 1, "control, synthetic CSS: 2 real comments (none from strings), 1 internal");

const lsAll = (g) => execFileSync("git", ["ls-files", g], { cwd: ROOT }).toString().split("\n").filter(Boolean).filter(f => !isExcluded(f));
const codeFiles = [...files.map(f => [f, "html"]), ...lsAll("*.js").map(f => [f, "js"]), ...lsAll("*.css").map(f => [f, "css"])];
// Byte-pinned modules: js/cycle-movement.js, js/food-guard.js and js/phase-note-guard.js must stay
// byte-identical to the copies in the backend repos (test-cycle-movement CM-W1, test-food-guard FG-W1,
// test-phase-note-guard PNG-W1 pin the same sha256 the backend holds). A comment change here alone
// would break that identity, so they are left as they are and named here. Cleaning them means changing
// every copy and its pin together, in all repos at once.
const PINNED = ["js/cycle-movement.js", "js/food-guard.js", "js/phase-note-guard.js"];
ok(PINNED.every(f => codeFiles.some(([g]) => g === f)), "control, every pinned exemption names a served file that exists " + JSON.stringify(PINNED));
let codeTotal = 0;
for (const [f, kind] of codeFiles) {
  if (PINNED.includes(f)) { codeTotal += codeComments(readFileSync(join(ROOT, f), "utf8"), kind).length; continue; }
  const found = codeComments(readFileSync(join(ROOT, f), "utf8"), kind);
  codeTotal += found.length;
  const bad = found.filter(c => codeHit(c.text));
  ok(bad.length === 0, `${f}: no internal CSS or JS comment` + (bad.length ? " " + JSON.stringify(bad.slice(0, 5).map(c => `:${c.line} ${c.text.trim().slice(0, 80)}`)) + (bad.length > 5 ? ` and ${bad.length - 5} more` : "") : ""));
}
ok(codeTotal > 1000, `control, ${codeTotal} CSS and JS comments were scanned, so the scan reached the code`);
done();
