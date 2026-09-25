#!/usr/bin/env node
// REVIEW_GATE_V1 -- /review is unlinked, never indexed, and makes no table read of its own.
//
// Decision 2 of the Phase 2 spec (supa docs/review-gate-phase2-spec.md): the review page lives
// here, is noindex and unlinked, signs in with Supabase, and sends EVERY read and write through
// the review-action edge function, which checks reviewers membership first. A direct table read
// from this page would bypass that check (RLS would still scope it, but the reviewer role has no
// reason to hold any grant, and the page must never grow one). Each check below runs against
// located, non-empty source and has a mutant that must fail it.
//
//   node scripts/test-review-page.mjs
import { readFileSync, readdirSync } from "node:fs";

const PAGE = readFileSync("review.html", "utf8");
const DASH = readFileSync("dashboard.html", "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok   " + m); } else { fail++; console.log("  FAIL " + m); } };

const script = (src) => { const m = src.match(/<script>\n([\s\S]*?)<\/script>/); return m ? m[1] : ""; };
const JS = script(PAGE);
ok(JS.length > 2000, "CONTROL: review.html's inline script located (" + JS.length + " chars)");

console.log("R-1  never indexed");
ok(/<meta name="robots" content="noindex,nofollow"\/>/.test(PAGE), "R-1: noindex,nofollow meta present");
ok(!/review/.test(readFileSync("sitemap.xml", "utf8")), "R-1: not in sitemap.xml");

console.log("R-2  no table read of its own; review-action is the only door");
const direct = (js) => /\bsb\.from\(|\.rpc\(|\bsb\.storage\b|\/rest\/v1\//.test(js);
ok(!direct(JS), "R-2: no sb.from, rpc, storage or REST call in the page");
const invokes = [...JS.matchAll(/functions\.invoke\(\s*["']([^"']+)["']/g)].map((m) => m[1]);
ok(invokes.length === 1 && invokes[0] === "review-action", "R-2: exactly one invoke site, and it is review-action (" + JSON.stringify(invokes) + ")");
ok(direct(JS + '\nawait sb.from("reports").select("id");'), "R-2-MUTANT: an injected sb.from is caught");
ok(direct(DASH), "R-2-CONTROL: the same detector fires on dashboard.html, which does read tables");

console.log("R-3  unlinked");
const pages = readdirSync(".").filter((f) => f.endsWith(".html") && f !== "review.html");
const links = pages.filter((f) => /href=["'](\/review|review\.html|https:\/\/biowellth\.ai\/review)(["'#?/])/.test(readFileSync(f, "utf8")));
ok(pages.length >= 5, "R-3-CONTROL: " + pages.length + " other pages scanned");
ok(links.length === 0, "R-3: no other page links to /review (" + links.join(",") + ")");
ok(pages.some((f) => /href=["']\/privacy/.test(readFileSync(f, "utf8"))), "R-3-CONTROL: the link detector's shape does fire on an existing /privacy link");

console.log("R-4  the six error tags, exactly");
const tm = JS.match(/const ERROR_TAGS = (\[[^\]]*\]);/);
ok(tm && JSON.stringify(JSON.parse(tm[1])) === JSON.stringify(["wrong_fact","wrong_tone","missed_flag","diagnostic_overreach","extraction_error","other"]),
   "R-4: ERROR_TAGS equals the spec's list, in order");

console.log("R-5  no innerHTML: every value is rendered as text");
ok(!/innerHTML/.test(JS), "R-5: review.html never assigns innerHTML");
ok(/innerHTML/.test(DASH), "R-5-CONTROL: the detector fires on dashboard.html");

console.log("R-6  the dashboard's tokens, with identical values");
const tokens = (src) => { const root = (src.match(/:root\{([\s\S]*?)\n\}/) || [])[1] || ""; return Object.fromEntries([...root.matchAll(/(--[a-z-]+):([^;]+);/g)].map((m) => [m[1], m[2].trim()])); };
const T = tokens(PAGE), D = tokens(DASH);
const shared = Object.keys(T);
ok(shared.length >= 20, "R-6-CONTROL: " + shared.length + " tokens declared on review.html");
const drift = shared.filter((k) => D[k] !== T[k]);
ok(drift.length === 0, "R-6: every review.html token has the dashboard's value (" + drift.join(",") + ")");

console.log("R-7  no colons or em dashes in the page's own copy");
const copy = [...PAGE.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "")
  .matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean);
const strings = [...JS.matchAll(/"([A-Z][^"]{12,})"/g)].map((m) => m[1]);
const bad = [...copy, ...strings].filter((s) => /—|:\s/.test(s) && !/^https?:/.test(s));
ok(copy.length > 10 && strings.length > 5, "R-7-CONTROL: " + copy.length + " markup strings and " + strings.length + " script strings read");
ok(bad.length === 0, "R-7: none carries a colon or an em dash (" + JSON.stringify(bad.slice(0, 3)) + ")");

console.log("\n  " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
