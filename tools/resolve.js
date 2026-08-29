// resolve.js — curation helper. Given a candidate pool (array of {title, verify:[...]}),
// batch-resolves each title via the Wikipedia API (single call, gentle) and fetches the
// page text to confirm which verify phrases actually appear. Reports PASS/FAIL + the
// exact phrases that matched, so you can lock in accurate verify[] fields per story.
//
// Usage: node tools/resolve.js tools/pools/<pool>.json
//
// Pool format: [ { "title": "Great Molasses Flood", "verify": ["molasses","1919","boston"] }, ... ]
const fs = require("fs");
const path = require("path");

const UA = "Mozilla/5.0 (compatible; WOR-gen/1.0)";

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

async function api(params) {
  const url = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({ format: "json", ...params });
  const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error("api HTTP " + r.status);
  return r.json();
}

(async () => {
  const poolFile = process.argv[2];
  if (!poolFile) { console.log("usage: node tools/resolve.js <pool.json>"); process.exit(1); }
  const pool = JSON.parse(fs.readFileSync(poolFile, "utf8"));
  console.log(`== ${path.basename(poolFile)} (${pool.length} candidates) ==\n`);

  // 1) Resolve all titles in ONE API call.
  const titles = pool.map((p) => p.title);
  let norm = {};
  try {
    const j = await api({ action: "query", titles: titles.join("|") });
    for (const p of Object.values(j.query.pages)) {
      const cand = pool.find((x) => x.title === p.title || x.title === p.canonicaltitle);
      if (!cand) continue;
      norm[cand.title] = {
        ok: p.missing === undefined,
        finaltitle: p.title,
        canonical: p.canonicaltitle,
      };
    }
  } catch (e) {
    console.log("title-resolve failed: " + e.message); process.exit(1);
  }

  // 2) Fetch page text for the ones that exist, check phrases.
  let pass = 0, fail = 0;
  for (const p of pool) {
    const n = norm[p.title];
    if (!n || !n.ok) { fail++; console.log(`FAIL (no page)   ${p.title}`); continue; }
    const url = "https://en.wikipedia.org/wiki/" + encodeURIComponent(n.finaltitle.replace(/ /g, "_"));
    let matched = [];
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { fail++; console.log(`FAIL (HTTP ${r.status}) ${p.title}`); continue; }
      const text = toText(await r.text());
      matched = p.verify.map((v) => ({ v, hit: text.includes(v.toLowerCase().trim()) }));
    } catch (e) { fail++; console.log(`FAIL (fetch ${e.message}) ${p.title}`); continue; }

    const missing = matched.filter((m) => !m.hit).map((m) => m.v);
    if (missing.length) {
      fail++;
      console.log(`FAIL (phrases)  ${n.finaltitle}\n      missing: [${missing.join(", ")}]\n      hit:     [${matched.filter((m) => m.hit).map((m) => m.v).join(", ")}]`);
    } else {
      pass++;
      console.log(`PASS            ${n.finaltitle}  -> [${matched.map((m) => m.v).join(", ")}]  ${url}`);
    }
    await new Promise((r) => setTimeout(r, 600)); // be gentle
  }
  console.log(`\n${pass}/${pool.length} fully verified.`);
})();
