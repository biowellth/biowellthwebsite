#!/usr/bin/env node
// scripts/check-live-exclusions.mjs
//
// Asserts that the internal paths in this repo are NOT served by biowellth.ai.
//
// WHY THIS IS A LIVE FETCH AND NOT A FILE READ. Reading _config.yml proves the
// exclude list says the right thing. It does not prove GitHub Pages honoured it,
// that the build ran, or that the file reached the served tree. Until
// 2026-09-12 15:39 /CLAUDE.md returned 200 on the live site, including a section
// naming unfixed defects in login.html. Nothing in the repo was wrong at that
// moment; the served artifact was. Only a request to the real origin can tell
// those two states apart.
//
// WHY IT IS NOT NAMED test-*.mjs, and so is NOT in the offline suite. Every
// other script here runs with no network. This one cannot, and a test that goes
// red on a train is a test people learn to ignore, which is worse than not
// having it. It is a deploy verification, the same role as the Kudu byte check
// in the backend repo, and it belongs beside a push rather than inside the unit
// suite. Run it after any push, and after any change to _config.yml.
//
// THE PATH LIST IS DERIVED FROM GIT, NOT TYPED. Anything tracked and internal is
// asserted, so a new file under scripts/ or docs/ is covered the day it lands
// rather than the day someone remembers to add it here.
//
//   node scripts/check-live-exclusions.mjs
//   ORIGIN=https://biowellth.ai node scripts/check-live-exclusions.mjs
import { execSync } from "node:child_process";

const ORIGIN = (process.env.ORIGIN || "https://biowellth.ai").replace(/\/$/, "");
const TIMEOUT_MS = 20000;

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m)));

async function status(path) {
	const url = ORIGIN + path;
	const ctl = AbortSignal.timeout(TIMEOUT_MS);
	try {
		const r = await fetch(url, { redirect: "manual", signal: ctl });
		return r.status;
	} catch (e) {
		return `ERR ${e.name}`;
	}
}

// ── the internal set, derived ────────────────────────────────────────────────
const tracked = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const isInternal = (p) =>
	p.startsWith("scripts/") || p.startsWith("docs/") || p.startsWith("mocks/") ||
	p === "CLAUDE.md" || p === "_config.yml" || p.startsWith(".");
const internal = tracked.filter(isInternal);
const publicPaths = tracked.filter((p) => !isInternal(p));

console.log(`ORIGIN ${ORIGIN}`);
console.log(`tracked ${tracked.length}, internal ${internal.length}, public ${publicPaths.length}`);

// ── controls first. If these are not 200 the run means nothing ───────────────
console.log("\nCONTROLS, these MUST be served");
const CONTROLS = ["/", "/dashboard.html", "/favicon.svg", "/index.html"];
let controlsGood = 0;
for (const p of CONTROLS) {
	const s = await status(p);
	const good = s === 200;
	if (good) controlsGood++;
	ok(good, `C ${p} -> ${s}`);
}
// A run where every control failed is a network problem wearing a pass. Say so
// rather than reporting 19 reassuring 404s from a machine that is simply offline.
if (controlsGood === 0) {
	console.log("\n  EVERY CONTROL FAILED. This is a network or DNS problem, not a result.");
	console.log(`\n  ${pass} passed, ${fail} failed`);
	process.exit(1);
}

// ── the assertions ───────────────────────────────────────────────────────────
console.log("\nINTERNAL PATHS, these must NOT be served");
for (const p of internal) {
	const s = await status("/" + p);
	// 200 is the failure. Anything else is fine, but say which so a 301 to a
	// mirror or a 403 is visible rather than counted as a win.
	ok(s !== 200, `X /${p} -> ${s}`);
}

// ── directory listings, a separate exposure from the files themselves ────────
console.log("\nDIRECTORY PATHS");
for (const d of ["/scripts/", "/docs/", "/mocks/"]) {
	const s = await status(d);
	ok(s !== 200, `D ${d} -> ${s}`);
}

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
