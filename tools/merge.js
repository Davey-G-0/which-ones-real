// merge.js — append APPROVED, verified seed entries into data.js, then
// re-run the smoke test to prove the bank still plays.
//
// Usage: node tools/merge.js <seed-file.json>
//
// Safety:
//   - only appends (never edits existing stories)
//   - dedupes against the current bank (by real headline + link)
//   - rewrites data.js preserving the header comment
//   - runs `node smoke_test.js` at the end; exits non-zero if it fails
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data.js");

const seedFile = process.argv[2];
if (!seedFile) { console.error("usage: node tools/merge.js <seed-file.json>"); process.exit(2); }
const seeds = JSON.parse(fs.readFileSync(seedFile, "utf8"));

const dataSrc = fs.readFileSync(DATA, "utf8");

// Pull existing {real, link} pairs out of the current bank to dedupe against.
const existing = new Set();
let storyCount = 0;
const re = /\{\s*segment:[\s\S]*?\}/g;
let m;
while ((m = re.exec(dataSrc))) {
  const blk = m[0];
  const realM = blk.match(/real:\s*"((?:[^"\\]|\\.)*)"/);
  const linkM = blk.match(/link:\s*"((?:[^"\\]|\\.)*)"/);
  if (realM) { existing.add(realM[1]); storyCount++; }
  if (linkM) existing.add(linkM[1]);
}

// Serialize one seed as a JS object literal, 2-space indented to match the bank.
function jsStr(s) { return JSON.stringify(s); }
function toJS(seed, i) {
  return [
    "  {",
    `    segment: ${jsStr(seed.segment)},`,
    `    region: ${jsStr(seed.region)},`,
    `    era: ${jsStr(seed.era)},`,
    `    outlet: ${jsStr(seed.outlet)},`,
    `    date: ${jsStr(seed.date)},`,
    `    real: ${jsStr(seed.real)},`,
    `    source: ${jsStr(seed.source)},`,
    `    link: ${jsStr(seed.link)},`,
    `    fakes: [`,
    seed.fakes.map((f) => `      ${jsStr(f)},`).join("\n"),
    "    ],",
    "  },",
  ].join("\n");
}

// Insert before the final "];\n" of the QUESTIONS array.
const endIdx = dataSrc.lastIndexOf("];");
if (endIdx === -1) { console.error("could not find end of QUESTIONS array"); process.exit(2); }

let added = 0, skipped = 0;
const blocks = [];
for (const s of seeds) {
  if (existing.has(s.real) || existing.has(s.link)) { skipped++; console.log("  skip (dup): " + s.real); continue; }
  blocks.push(toJS(s));
  added++;
}
if (!added) { console.log("nothing new to add."); process.exit(0); }

const newSrc = dataSrc.slice(0, endIdx) + blocks.join("\n") + "\n" + dataSrc.slice(endIdx);
fs.writeFileSync(DATA, newSrc);
console.log(`added ${added}, skipped ${skipped} (dups). bank now ${storyCount + added} stories.`);

// Prove it still plays.
console.log("\n-- running smoke test --");
try {
  const out = execFileSync("node", ["smoke_test.js"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  console.log(out.trim().split("\n").slice(-3).join("\n"));
} catch (e) {
  console.error("SMOKE TEST FAILED:\n" + (e.stdout || "") + (e.stderr || ""));
  console.error("Reverting data.js to pre-merge state.");
  // git checkout the file to undo a broken merge
  try { execFileSync("git", ["checkout", "--", "data.js"], { cwd: ROOT }); console.log("reverted."); } catch (_) {}
  process.exit(1);
}
console.log("\nMerge complete. Review with git diff data.js, then commit.");
