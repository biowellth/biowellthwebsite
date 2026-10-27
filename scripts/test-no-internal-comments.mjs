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
done();
