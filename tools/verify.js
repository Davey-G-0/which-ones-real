// verify.js — checks every seed story's link resolves AND that key facts
// (verify phrases) actually appear on the target page. Not just a 200 check.
//
// Usage: node tools/verify.js [seed-file.json ...]
//        (no args = all *.json in tools/seeds/)
//
// Rate-limit friendly: caches by URL within a run (shared sources fetched once),
// retries with exponential backoff on 429/5xx, and runs modest concurrency.
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
const UA = "Mozilla/5.0 (compatible; WOR-verify/1.0; party-game source check)";
const CONCURRENCY = 3;
const MAX_RETRIES = 4;

function args() {
  const a = process.argv.slice(2);
  if (a.length) return a;
  return fs.readdirSync(SEED_DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(SEED_DIR, f));
}

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// Shared text cache by URL so multiple stories on one source fetch once.
const textCache = new Map();
let inflight = new Map();

async function fetchText(url) {
  if (textCache.has(url)) return textCache.get(url);
  if (inflight.has(url)) return inflight.get(url);

  const p = (async () => {
    let lastErr;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          redirect: "follow",
          headers: { "user-agent": UA },
          signal: AbortSignal.timeout(30000),
        });
        if (res.status === 429 || res.status >= 500) {
          const wait = 2000 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, wait));
          lastErr = `HTTP ${res.status}`;
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return toText(await res.text());
      } catch (e) {
        lastErr = e.message;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    throw new Error("fetch failed after retries: " + lastErr);
  })().finally(() => inflight.delete(url));

  inflight.set(url, p);
  return p;
}

async function checkSeed(s, idx) {
  const problems = [];
  if (!s.link || !/^https?:\/\//.test(s.link)) problems.push("bad link: " + s.link);
  if (!Array.isArray(s.fakes) || s.fakes.length !== 3) problems.push("need exactly 3 fakes");
  if (!s.real || s.real.length < 10) problems.push("real headline too short/missing");
  if (!s.verify || !s.verify.length) problems.push("no verify phrases");
  if (problems.length) return { idx, ok: false, problems };

  let text;
  try {
    text = await fetchText(s.link);
  } catch (e) {
    return { idx, ok: false, problems: [e.message] };
  }
  const missing = s.verify.filter((p) => !text.includes(p.toLowerCase().trim()));
  if (missing.length) return { idx, ok: false, problems: ["missing on page: " + JSON.stringify(missing)] };
  return { idx, ok: true, problems: [] };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

(async () => {
  const files = args();
  let total = 0, pass = 0;
  const fails = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.log("!! not found: " + f); continue; }
    const seeds = JSON.parse(fs.readFileSync(f, "utf8"));
    console.log(`\n== ${path.basename(f)} (${seeds.length} seeds) ==`);
    const results = await mapPool(seeds, CONCURRENCY, (s, i) => checkSeed(s, i));
    results.forEach((r, i) => {
      total++;
      if (r.ok) { pass++; console.log(`  [${i + 1}/${seeds.length}] OK   ${seeds[i].real}`); }
      else { fails.push({ file: f, ...r, real: seeds[i].real }); console.log(`  [${i + 1}/${seeds.length}] FAIL ${seeds[i].real}\n         -> ${r.problems.join("; ")}`); }
    });
  }
  console.log(`\n${pass}/${total} verified.`);
  if (fails.length) {
    console.log("FAILURES:");
    fails.forEach((x) => console.log(`  ${x.file} #${x.idx + 1}: ${x.real} — ${x.problems.join("; ")}`));
    process.exit(1);
  }
})();
