// scripts/test-sse-parser.mjs
//
// Tests the Sana SSE frame parser. This repo has no package.json, no test
// runner and no node_modules, and adding one for a single pure function is not
// worth the dependency, so this follows the pattern the supa repo uses in
// tools/verify-library.py: read the SHIPPED source, extract the block between
// its markers, and evaluate that.
//
// The point is that it tests dashboard.html itself. A copied parser would drift
// from the real one silently, and the copy would be the one that stayed correct
// while the shipped one rotted.
//
//   node scripts/test-sse-parser.mjs
//
// Exit 0 all green, 1 on any failure.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "dashboard.html"), "utf8");

const START = "// SANA_SSE_PARSER_V1 START";
const END = "// SANA_SSE_PARSER_V1 END";
const a = src.indexOf(START), b = src.indexOf(END);
if (a < 0 || b < 0 || b < a) {
  console.error("FAIL: parser markers not found in dashboard.html. If the block moved, move the markers with it.");
  process.exit(1);
}
const block = src.slice(a + START.length, b);
const sanaMakeParser = new Function(block + "\n return sanaMakeParser;")();

let pass = 0, fail = 0;
function check(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n         got  ${g}\n         want ${w}`); }
}
const frame = (o) => "data: " + JSON.stringify(o) + "\n\n";
const types = (evs) => evs.map((e) => e.type);

// 1. A normal stream in one chunk.
{
  const p = sanaMakeParser();
  const evs = p.push(
    frame({ type: "thread_meta", threadId: "t1" }) +
    frame({ type: "delta", text: "Hello" }) +
    frame({ type: "done" }),
  );
  check("normal stream, one chunk", types(evs), ["thread_meta", "delta", "done"]);
  check("normal stream leaves nothing buffered", p.pending(), "");
}

// 2. A frame split mid-delta across two chunks. The half frame must NOT be
//    emitted early, and must arrive intact once its terminator does.
{
  const p = sanaMakeParser();
  const whole = frame({ type: "delta", text: "split me" });
  const cut = Math.floor(whole.length / 2);
  const first = p.push(whole.slice(0, cut));
  check("split frame emits nothing on the first half", types(first), []);
  const second = p.push(whole.slice(cut));
  check("split frame emits once completed", types(second), ["delta"]);
  check("split frame text survives intact", second[0].text, "split me");
}

// 3. A multi-byte character split across chunks. The PARSER sees decoded text,
//    so this asserts the frame boundary logic, and the TextDecoder stream:true
//    in dashboard.html is what keeps the bytes intact upstream of it.
{
  const p = sanaMakeParser();
  const whole = frame({ type: "delta", text: "café — naïve" });
  p.push(whole.slice(0, 20));
  const evs = p.push(whole.slice(20));
  check("multi-byte text survives a chunk boundary", evs[0].text, "café — naïve");
}

// 4. tool_call / tool_result ordering is preserved as emitted.
{
  const p = sanaMakeParser();
  const evs = p.push(
    frame({ type: "thread_meta" }) +
    frame({ type: "tool_call", name: "get_report_interpretation" }) +
    frame({ type: "tool_result", name: "get_report_interpretation" }) +
    frame({ type: "delta", text: "x" }) +
    frame({ type: "done" }),
  );
  check("tool ordering preserved", types(evs),
    ["thread_meta", "tool_call", "tool_result", "delta", "done"]);
  check("tool_call carries its name", evs[1].name, "get_report_interpretation");
}

// 5. An error event parses like any other frame.
{
  const p = sanaMakeParser();
  const evs = p.push(frame({ type: "error", message: "boom" }));
  check("error event parses", types(evs), ["error"]);
}

// 6. A malformed frame is SKIPPED, not thrown, and must not take the good
//    frames around it down with it.
{
  const p = sanaMakeParser();
  const evs = p.push(
    frame({ type: "delta", text: "before" }) +
    "data: {not json at all\n\n" +
    frame({ type: "delta", text: "after" }),
  );
  check("malformed frame is skipped, neighbours survive", types(evs), ["delta", "delta"]);
  check("frame after the malformed one is intact", evs[1].text, "after");
}

// 7. A frame with no type field is ignored.
{
  const p = sanaMakeParser();
  check("typeless frame ignored", types(p.push('data: {"text":"orphan"}\n\n')), []);
}

// 8. Stream ends without done. The parser reports what it saw; deciding what
//    that MEANS is sanaSend's job via receivedThreadMeta.
{
  const p = sanaMakeParser();
  const evs = p.push(frame({ type: "thread_meta" }) + frame({ type: "delta", text: "half" }));
  check("interrupted stream yields what arrived", types(evs), ["thread_meta", "delta"]);
  check("interrupted stream buffers no ghost frame", p.pending(), "");
}

// 9. done arriving with trailing bytes after it.
{
  const p = sanaMakeParser();
  const evs = p.push(frame({ type: "done" }) + "data: {\"type\":\"del");
  check("done emitted with a partial frame trailing", types(evs), ["done"]);
  check("the partial trailing frame stays buffered", p.pending(), 'data: {"type":"del');
}

// 10. A bare frame with no "data: " prefix still parses, matching the Dart
//     client, which treats the prefix as optional.
{
  const p = sanaMakeParser();
  check("bare frame without the data prefix", types(p.push('{"type":"done"}\n\n')), ["done"]);
}

// 11. THE FRAME SEPARATOR IS A BLANK LINE, not any newline.
//     Added after a mutation check: changing split("\n\n") to split("\n")
//     passed all ten cases above, because every frame they build ends in \n\n
//     and the empty segments a single-newline split produces are skipped as
//     blank. So the suite claimed to pin the framing contract and did not.
//     A frame carrying an internal newline is what tells the two apart. Our
//     server never emits one today, since JSON.stringify escapes newlines
//     inside strings, but the contract is SSE's, not ours, and a test that
//     cannot fail on a wrong separator is not testing the separator.
{
  const p = sanaMakeParser();
  const evs = p.push('event: message\ndata: {"type":"delta","text":"multi"}\n\n');
  check("a multi-line frame is ONE frame, split on the blank line", types(evs), ["delta"]);
  check("multi-line frame keeps its payload", evs.length ? evs[0].text : null, "multi");
}

// 12. THE ACTUAL DISCRIMINATOR for the frame separator.
//     Case 11 was not enough. With split("\n") a two-line frame still yields
//     one event, because the `data:` line parses on its own and the `event:`
//     line is discarded as unparseable. Verified by applying that exact
//     mutation and watching all 19 cases pass.
//     Per SSE, a payload MAY span several data: lines and they are joined with
//     a newline. That is the only shape where the two splits disagree: joined
//     it is valid JSON, split per line each half is a fragment that parses as
//     nothing. So this is the case that actually pins \n\n.
{
  const p = sanaMakeParser();
  const evs = p.push('data: {"type":"delta",\ndata: "text":"joined"}\n\n');
  check("payload spanning two data lines is joined, not dropped", types(evs), ["delta"]);
  check("joined payload is intact", evs.length ? evs[0].text : null, "joined");
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
