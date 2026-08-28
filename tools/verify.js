// verify.js — checks every seed story's link resolves AND that key facts
// (verify phrases) actually appear on the target page. Not just a 200 check.
//
// Usage: node tools/verify.js [seed-file.json ...]
//        (no args = all *.json in tools/seeds/)
//
// Seed format (JSON array), each entry:
// {
//   "segment": "...", "region": "...", "era": "...", "outlet": "...",
//   "date": "YYYY-MM-DD",
//   "real": "headline-style one-liner",
//   "source": "one-sentence verification note shown on reveal",
//   "link": "https://...",
//   "verify": ["phrase that must appear on the page", "..."],
//   "fakes": ["fake 1", "fake 2", "fake 3"]
// }
const fs = require("fs");
const path = require("path");

const SEED_DIR = path.join(__dirname, "seeds");

function args() {
  const a = process.argv.slice(2);
  if (a.length) return a;
  return fs.readdirSync(SEED_DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(SEED_DIR, f));
}

// Strip tags/scripts, collapse whitespace, lowercase.
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function checkSeed(s, idx) {
  const problems = [];
  if (!s.link || !/^https?:\/\//.test(s.link)) problems.push("bad link: " + s.link);
  if (!Array.isArray(s.fakes) || s.fakes.length !== 3) problems.push("need exactly 3 fakes");
  if (!s.real || s.real.length < 10) problems.push("real headline too short/missing");
  if (!s.verify || !s.verify.length) problems.push("no verify phrases");
  if (problems.length) return { idx, ok: false, problems };

  let res;
  try {
    res = await fetch(s.link, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; WOR-verify/1.0; party-game source check)" },
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return { idx, ok: false, problems: ["fetch failed: " + e.message] };
  }
  if (!res.ok) return { idx, ok: false, problems: [`HTTP ${res.status}`] };
  const html = await res.text();
  const text = toText(html);
  const missing = s.verify.filter((p) => !text.includes(p.toLowerCase().trim()));
  if (missing.length) return { idx, ok: false, problems: ["missing on page: " + JSON.stringify(missing)] };
  return { idx, ok: true, problems: [] };
}

(async () => {
  const files = args();
  let total = 0, pass = 0;
  const fails = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.log("!! not found: " + f); continue; }
    const seeds = JSON.parse(fs.readFileSync(f, "utf8"));
    console.log(`\n== ${path.basename(f)} (${seeds.length} seeds) ==`);
    for (let i = 0; i < seeds.length; i++) {
      total++;
      const r = await checkSeed(seeds[i], i);
      if (r.ok) { pass++; console.log(`  [${i + 1}/${seeds.length}] OK   ${seeds[i].real}`); }
      else { fails.push({ file: f, ...r, real: seeds[i].real }); console.log(`  [${i + 1}/${seeds.length}] FAIL ${seeds[i].real}\n         -> ${r.problems.join("; ")}`); }
    }
  }
  console.log(`\n${pass}/${total} verified.`);
  if (fails.length) {
    console.log("FAILURES:");
    fails.forEach((x) => console.log(`  ${x.file} #${x.idx + 1}: ${x.real} — ${x.problems.join("; ")}`));
    process.exit(1);
  }
})();
