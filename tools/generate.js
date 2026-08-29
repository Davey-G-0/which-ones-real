// generate.js — the "infinite generator" front-end.
//
// It does NOT invent stories (that's how you get fake links and dull filler).
// It takes a curated EVENT BANK (real, verifiable events, one per entry), and
// mechanically:  (1) dedupes against the live bank, (2) writes a seed batch,
// (3) runs the verify gate (live link + facts-on-page) on every entry, and
// (4) emits a review sheet. Only verified entries are merge-ready.
//
// Usage:  node tools/generate.js <bank.json>
//
// Bank format = same as a seed file (JSON array). Add as many as you like —
// there is no cap. Each entry:
// {
//   "segment","region","era","outlet","date","real","source","link",
//   "verify": ["phrase on page"], "fakes": ["f1","f2","f3"]
// }
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data.js");
const SEED_DIR = path.join(__dirname, "seeds");

const bankFile = process.argv[2];
const nameArg = process.argv[3] || null; // optional slug for per-day multi-batch runs
if (!bankFile) { console.error("usage: node tools/generate.js <bank.json> [name-slug]"); process.exit(2); }
const bank = JSON.parse(fs.readFileSync(bankFile, "utf8"));
if (!Array.isArray(bank) || !bank.length) { console.error("bank must be a non-empty JSON array"); process.exit(2); }

// Dedupe against the current live bank by real headline + link.
const dataSrc = fs.readFileSync(DATA, "utf8");
const existing = new Set();
const re = /\{\s*segment:[\s\S]*?\}/g;
let m;
while ((m = re.exec(dataSrc))) {
  const blk = m[0];
  const realM = blk.match(/real:\s*"((?:[^"\\]|\\.)*)"/);
  const linkM = blk.match(/link:\s*"((?:[^"\\]|\\.)*)"/);
  if (realM) existing.add(realM[1]);
  if (linkM) existing.add(linkM[1]);
}

const fresh = bank.filter((s) => !existing.has(s.real) && !existing.has(s.link));
const dups = bank.length - fresh.length;

const stamp = (nameArg || new Date().toISOString().slice(0, 10).replace(/-/g, ""));
const seedFile = path.join(SEED_DIR, `generated-${stamp}.json`);
fs.writeFileSync(seedFile, JSON.stringify(fresh, null, 2));
console.log(`bank: ${bank.length} entries -> ${fresh.length} new, ${dups} dup(s) skipped. wrote ${path.basename(seedFile)}\n`);
if (!fresh.length) { console.log("nothing new to verify."); process.exit(0); }

// Run the verify gate (live link + facts-on-page) on the fresh batch.
console.log("-- running verify gate --");
let verifyOut = "", ok = false;
try {
  verifyOut = execFileSync("node", ["tools/verify.js", seedFile], { cwd: ROOT, encoding: "utf8" });
  ok = true;
} catch (e) {
  verifyOut = (e.stdout || "") + (e.stderr || "");
}
console.log(verifyOut.trim());

// Emit a review sheet for the verified batch.
const parsed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
const lines = [
  `# Generated batch ${stamp} — Review Sheet`,
  "",
  `Source bank: ${path.basename(bankFile)} (${bank.length} entries; ${fresh.length} new, ${dups} dup).`,
  ok ? "All entries PASSED the verify gate (live link + facts found on page)." : "⚠️ Some entries FAILED verify — see FAILURES below; fix the bank and re-run.",
  "",
  "| # | Story | Segment / Region / Era | Verdict |",
  "|---|-------|------------------------|---------|",
];
parsed.forEach((s, i) => lines.push(`| ${i + 1} | ${s.real.replace("|", "\\|")} | ${s.segment} / ${s.region} / ${s.era} | |`));
lines.push("", ok ? "To merge (after your sign-off): `node tools/merge.js " + path.basename(seedFile) + "`" : "Fix the failing entries in the bank, then re-run generate.js.");
const sheet = path.join(__dirname, `review-${stamp}.md`);
fs.writeFileSync(sheet, lines.join("\n"));
console.log(`\nreview sheet: ${path.basename(sheet)}`);
process.exit(ok ? 0 : 1);
