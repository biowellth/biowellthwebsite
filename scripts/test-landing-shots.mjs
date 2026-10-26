#!/usr/bin/env node
// LANDING_PRODUCT_SHOTS_V1 -- the "What you get back" section on index.html and the three screenshots in it.
//
// WHAT IS PINNED.
//   LS-1  the section sits between #read and #sana, with data-orb, data-orb-m and data-reveal like its siblings
//   LS-2  every img has width, height, loading="lazy", decoding="async" and real alt text; the browser bar is aria-hidden
//   LS-3  the new copy and alt text carry no colon, no em dash, no "functional" and no numeric range
//   LS-4  the three WebP files exist, are real WebP, are 1600 / 1600 / 780 px wide and under 200KB each
//   LS-5  no PNG is tracked under assets/landing
//   LS-6  scripts/capture-landing-shots.mjs --check renders the synthetic panel and every crop is clean
//
// CONTROLS. Two mutants must fail the capture check, one planting "functional" and one planting a
// "Healthy N to N" range into each crop, so a screen that never runs cannot pass by being empty.
//
//   node scripts/test-landing-shots.mjs        (CHROME=/path/to/chrome, ROOT=/path/to/checkout)
import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.env.ROOT || ".";
let pass = 0, fail = 0;
const ok = (c, m) => c ? (pass++, console.log("  ok   " + m)) : (fail++, console.log("  FAIL " + m));
const done = () => { console.log("\n  " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0); };

const html = readFileSync(join(ROOT, "index.html"), "utf8");
const m = html.match(/<section class="shots"[\s\S]*?<\/section>/);
ok(!!m, "LS-0 the .shots section exists");
if (!m) done();
const sec = m[0];

// LS-1 order and attributes
const iRead = html.indexOf('id="read"'), iShots = html.indexOf('class="shots"'), iSana = html.indexOf('id="sana"');
ok(iRead > 0 && iRead < iShots && iShots < iSana, "LS-1 the section sits after #read and before #sana");
const between = html.slice(iShots, iSana).match(/<section\b/g) || [];
ok(between.length === 1, "LS-1 nothing else sits between it and #sana");
const orb = sec.match(/data-orb="([^"]+)" data-orb-m="([^"]+)"/);
ok(orb && orb[1].split(",").length === 3 && orb[2].split(",").length === 3, "LS-1 data-orb and data-orb-m are x,y,size triples");
ok((sec.match(/data-reveal/g) || []).length >= 3, "LS-1 the head and both rows carry data-reveal");

// LS-2 images
const imgs = sec.match(/<img\b[^>]*>/g) || [];
ok(imgs.length === 3, "LS-2 three images (" + imgs.length + ")");
for (const t of imgs) {
  const src = (t.match(/src="([^"]+)"/) || [])[1];
  const alt = (t.match(/alt="([^"]*)"/) || [])[1] || "";
  ok(/width="\d+"/.test(t) && /height="\d+"/.test(t), "LS-2 " + src + " has width and height");
  ok(/loading="lazy"/.test(t) && /decoding="async"/.test(t), "LS-2 " + src + " is lazy and async");
  ok(alt.length >= 60 && /sample/i.test(alt), "LS-2 " + src + " has descriptive alt text that says it is a sample (" + alt.length + " chars)");
}
ok(/class="shots-bar" aria-hidden="true"/.test(sec), "LS-2 the decorative browser bar is aria-hidden");

// LS-3 copy rules on everything a reader sees or hears
const visible = sec.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const alts = imgs.map(t => (t.match(/alt="([^"]*)"/) || [])[1] || "").join(" ");
const copy = visible + " " + alts;
ok(copy.includes("Every result explained in plain words, and tracked from one panel to the next. Sana, your AI companion, walks you through it."), "LS-3 the lead is the approved line");
ok(copy.includes("Sample report with illustrative data."), "LS-3 the caption is on the page");
ok(!/:/.test(copy), "LS-3 no colon in the new copy");
ok(!/—|&mdash;/.test(copy), "LS-3 no em dash in the new copy");
ok(!/functional/i.test(copy), "LS-3 no \"functional\" in the new copy");
ok(!/\d\s*(-|–|to)\s*\d/.test(copy), "LS-3 no numeric range in the new copy");

// LS-4 the files
const WANT = { "shot-01-dashboard.webp": 1600, "shot-02-trends.webp": 1600, "shot-03-mobile.webp": 780 };
const webpWidth = (b) => {
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const k = b.toString("ascii", 12, 16);
  if (k === "VP8X") return 1 + b.readUIntLE(24, 3);
  if (k === "VP8L") return 1 + (b.readUInt32LE(21) & 0x3fff);
  if (k === "VP8 ") return b.readUInt16LE(26) & 0x3fff;
  return null;
};
for (const [f, w] of Object.entries(WANT)) {
  const p = join(ROOT, "assets", "landing", f);
  if (!existsSync(p)) { ok(false, "LS-4 " + f + " exists"); continue; }
  const b = readFileSync(p), kb = statSync(p).size / 1024;
  ok(webpWidth(b) === w, "LS-4 " + f + " is WebP, " + webpWidth(b) + "px wide (expect " + w + ")");
  ok(kb < 200, "LS-4 " + f + " is " + kb.toFixed(1) + "KB (under 200KB)");
  ok(sec.includes('src="assets/landing/' + f + '"'), "LS-4 " + f + " is used by the section");
}

// LS-5 no PNGs tracked
let tracked = "";
try { tracked = execFileSync("git", ["-C", ROOT, "ls-files", "assets/landing"], { encoding: "utf8" }); } catch (e) {}
ok(!/\.png$/m.test(tracked), "LS-5 no PNG is tracked under assets/landing");

// LS-6 the capture script's own assertions, plus two mutants
const cap = (env) => spawnSync(process.execPath, [join(ROOT, "scripts", "capture-landing-shots.mjs"), "--check"],
  { cwd: ROOT, env: { ...process.env, ROOT, ...env }, encoding: "utf8", timeout: 240000 });
const clean = cap({});
ok(clean.status === 0, "LS-6 capture --check passes on the synthetic panel" + (clean.status ? "  " + (clean.stderr || clean.stdout).trim().split("\n").slice(-3).join(" ") : ""));
ok((clean.stdout.match(/chars of visible text read/g) || []).length === 3, "LS-6 CONTROL all three crops were read");
const m1 = cap({ MUTANT: "read against functional ranges" });
ok(m1.status === 1 && /functional/.test(m1.stderr), "LS-7 MUTANT \"functional\" planted in a crop is caught");
const m2 = cap({ MUTANT: "Healthy 30 to 100 ng/mL" });
ok(m2.status === 1 && /Healthy N to N/.test(m2.stderr), "LS-8 MUTANT a Healthy N to N range planted in a crop is caught");

done();
