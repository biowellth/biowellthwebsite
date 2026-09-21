// EXTRACT_APP_HELPER_V1 — one definition of "the app block", shared by every test script.
//
// WHY THIS EXISTS. Six scripts took the FIRST `<script>` line through to the LAST
// `</script>` line. That worked while dashboard.html carried one inline block. A Sentry
// block was added ahead of the app on 2026-09-20, so the span swallowed an intervening
// `</script>` and the result was not valid JavaScript. Six tests went red and nothing
// about the product was wrong. Four newer scripts already took the LAST bare block and
// kept passing.
//
// WHY IT THROWS. The breakage above was silent in the way that counts: the harness broke
// and the only signal was six red tests that read like product regressions. A helper that
// quietly picks a block when the page shape changes would reproduce exactly that. So when
// the page does not hold exactly one candidate, this throws and names the counts — the
// next block someone adds fails loudly, at the extractor, with a message saying what
// changed, instead of surfacing as a puzzling assertion failure three files away.
//
// WHAT A CANDIDATE IS, and why it is not simply "a bare block".
//   bare    — a `<script>` tag carrying no src attribute. The CDN includes (Sentry's
//             bundle, supabase-js) are matched by src and skipped.
//   parses  — it is JavaScript, checked with the same engine the tests run it on. A
//             bare block holding JSON-LD or a template is not a candidate.
//   in body — it sits after `<body>`. This is the clause that does the real work.
//
// MEASURED 2026-09-21: dashboard.html holds TWO bare blocks and BOTH parse — Sentry's
// init at 1587-1807 in the head, and the app at 2412-12244 in the body. So "exactly one
// bare block" is a rule the real page cannot satisfy. Restricting candidacy to the body
// is not a convenience: a head block is a third-party loader or shim and is never the
// app, whereas a block appended AFTER the app in the body is the case where "take the
// last bare block" silently returns the wrong thing. That is the case this throw catches.
// A block added to the head is skipped and the suite stays green, which is precisely what
// should have happened on 2026-09-20.

import vm from "node:vm";

/** Inline blocks with their line indices: { open, close, src }. */
function findBareBlocks(lines) {
  const out = [];
  let open = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (open === -1) {
      // An opening tag on its own line with NO src: `<script>`, or `<script type="...">`.
      if (/^<script(\s[^>]*)?>$/.test(t) && !/\ssrc\s*=/.test(t)) open = i;
    } else if (t === "</script>") {
      out.push({ open, close: i, src: lines.slice(open + 1, i).join("\n") });
      open = -1;
    }
  }
  return out;
}

function parses(src) {
  try {
    new vm.Script(src);
    return true;
  } catch {
    return false;
  }
}

/**
 * The inline application source from an HTML page.
 *
 * Returns the last bare <script> block — the app. Throws when the page does not hold
 * exactly one candidate, naming how many bare blocks were seen and how many qualified,
 * so a change in page shape surfaces here rather than as an assertion failure elsewhere.
 *
 * @param {string} html    the page source
 * @param {string} [label] a name for the page, used in the thrown message
 * @returns {string} the JavaScript between the tags
 */
export function extractApp(html, label = "the page") {
  if (typeof html !== "string" || html === "") {
    throw new Error(`extractApp: ${label} is empty or not a string.`);
  }
  const lines = html.split("\n");
  const bodyAt = lines.findIndex((l) => /^<body[\s>]/.test(l.trim()));
  const bare = findBareBlocks(lines);
  const candidates = bare.filter((b) => b.open > bodyAt && parses(b.src));

  if (candidates.length !== 1) {
    throw new Error(
      `extractApp: ${label} holds ${candidates.length} candidate app block(s); ` +
        `exactly 1 is required. ` +
        `Bare <script> blocks seen: ${bare.length}` +
        (bare.length
          ? ` (${bare
              .map(
                (b) =>
                  `lines ${b.open + 1}-${b.close + 1}, ` +
                  `${b.open > bodyAt ? "body" : "head"}, ` +
                  `${parses(b.src) ? "parses" : "does not parse"}`,
              )
              .join("; ")})`
          : "") +
        `. A candidate is a bare block, in the body, that parses as JavaScript. ` +
        `If a block was added to the page, point the harness at the right one ` +
        `deliberately rather than letting it guess.`,
    );
  }
  return candidates[0].src;
}

/** Where the chosen block sits, for a test that wants to report position. */
export function locateApp(html) {
  const lines = html.split("\n");
  const bodyAt = lines.findIndex((l) => /^<body[\s>]/.test(l.trim()));
  const bare = findBareBlocks(lines);
  const candidates = bare.filter((b) => b.open > bodyAt && parses(b.src));
  const b = candidates[candidates.length - 1];
  return b
    ? { openLine: b.open + 1, closeLine: b.close + 1, bare: bare.length, candidates: candidates.length }
    : { openLine: null, closeLine: null, bare: bare.length, candidates: candidates.length };
}

export default extractApp;
