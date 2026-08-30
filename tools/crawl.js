// crawl.js — stage 1 of the content pipeline: discover + score Wikipedia candidates.
//
// Walks a per-segment category tree via the MediaWiki API, filters junk,
// fetches lead paragraphs, scores weirdness + (optionally) popularity, and
// writes a pool file in the EXACT format resolve.js consumes, plus a report
// with scores/leads for story authoring.
//
// Usage:
//   node tools/crawl.js <segment> [maxCandidates] [--no-pop]
//     segment        disasters | sports | sciencetech | weird | animals | history
//     maxCandidates  cap on pool size (default 60)
//     --no-pop       skip Wikimedia pageviews scoring (faster, weaker ranking)
//
// Output:
//   tools/pools/crawl-<segment>-<YYYYMMDD>.json   <- feed directly to resolve.js
//   tools/crawl-<segment>-report.md               <- score + lead for authoring
//
// This script DISCOVERS only. It never writes to data.js and never auto-merges.
// The pipeline stays: crawl -> resolve (gate) -> author bank -> generate (gate)
//   -> human review -> merge.

const fs = require("fs");
const path = require("path");

const UA = "Mozilla/5.0 (compatible; WOR-crawl/1.0; contact: graham)";
const WIKI = "https://en.wikipedia.org/w/api.php";
const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Segment config: which category subtrees to walk.
// Roots that don't exist are logged and skipped. Depth 2 = root -> sub -> leaf.
// ---------------------------------------------------------------------------
const SEGMENTS = {
  disasters: {
    label: "Disasters",
    roots: [
      "Category:Disasters by cause",
      "Category:Man-made disasters",
      "Category:Natural disasters",
      "Category:Environmental disasters",
      "Category:Transport disasters",
      "Category:Industrial disasters",
      "Category:Disasters by decade",
    ],
  },
  sports: {
    label: "Sports",
    roots: [
      "Category:Sports scandals",
      "Category:Olympic controversies",
      "Category:Sports controversies",
      "Category:Record holders in sports",
      "Category:Olympic Games medalists in athletics", // skip — too granular; kept for tuning
    ],
  },
  sciencetech: {
    label: "Science & Tech",
    roots: [
      "Category:Spaceflight accidents and incidents",
      "Category:Astronomy-related controversies",
      "Category:Scientific controversies",
      "Category:Technology-related controversies",
      "Category:Space Age",
      "Category:Artificial intelligence controversies",
    ],
  },
  weird: {
    label: "Weird",
    roots: [
      "Category:Hoaxes by century",
      "Category:Conspiracy theories",
      "Category:Mysterious disappearances",
      "Category:Unsolved mysteries",
      "Category:Mysterious deaths",
      "Category:Anomalies",
      "Category:Cryptid sightings",
      "Category:Urban legends",
    ],
  },
  animals: {
    label: "Animals",
    roots: [
      "Category:Animals in conflict",
      "Category:Animals in warfare",
      "Category:Famous animals",
      "Category:Animal hoaxes",
      "Category:Animals in folklore",
    ],
  },
  history: {
    label: "History",
    roots: [
      "Category:Historical controversies",
      "Category:Lost civilizations",
      "Category:Mysterious deaths",
      "Category:Unexploded ordnance",
      "Category:Wars by region", // skip if noisy
    ],
  },
};

// Category-name filters: skip subtrees that produce junk.
const SKIP_CAT = /list|timeline|outline|portal|management|by country|by state|by location|by organization|medalists in/i;
// Title junk filters.
const SKIP_TITLE = /^(list of|timeline of|outline of|category:|portal:|help:|draft:|index of)|\(disambiguation\)$/i;
// Weirdness bonus signals in lead text / title (word-boundary matched).
const WEIRD_SIGNALS = [
  "hoax", "hoaxed", "controvers", "scandal", "myster", "disappear", "fraud", "fraudulent",
  "conspirac", "unexplained", "accident", "crash", "explosion",
  "smog", "flood", "collapse", "sabotag", "doping", "cheat", "banned", "suspended",
  "record", "first", "only", "largest", "oldest",
  "iron mask", "ghost", "haunt", "curse", "alien", "ufo", "abduct",
  "declared war", "machine gun", "cipher", "treasure", "forged", "fake",
];
// Tone guard: hard-exclude topics that don't fit a family party game.
const BLACKLIST = /\bassassination|terroris|bin laden|9\/11|massac|genocide|war crime|slavery|slaves\b|bombing of\b/i;
// Definition-article / non-event markers (penalties).
const NON_EVENT = [
  { re: /\balso (known|referred) as\b/i, pen: 3, why: "definition-article" },
  { re: /\bborn (in|on) \d{4}\b/i, pen: 4, why: "person-article" },
  { re: /\b(studio )?album|television series|video game|novel by|film by|single by|song by/i, pen: 8, why: "media-work" },
  { re: /\bis an (annual |invitation-only )?(forum|organization|organization|institution|movement|group|phenomenon|type|kind)/i, pen: 3, why: "concept-article" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params, tries = 4) {
  const url = WIKI + "?" + new URLSearchParams({ format: "json", ...params });
  for (let a = 0; a < tries; a++) {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30000) });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status === 503) && a < tries - 1) {
      await sleep(8000 * (a + 1));
      continue;
    }
    throw new Error("api HTTP " + r.status + " for " + url.slice(0, 120));
  }
  throw new Error("rate limit exhausted");
}

// ---- dedupe corpus: live bank + all past pools + authored banks ------------
function loadDedupeCorpus() {
  const titles = new Set();
  const links = new Set();
  const dataPath = path.join(ROOT, "data.js");
  if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath, "utf8");
    for (const m of raw.matchAll(/link:\s*"(https:[^"]+)"/g)) links.add(m[1]);
    for (const m of raw.matchAll(/real:\s*"([^"]+)"/g)) titles.add(m[1].toLowerCase());
  }
  for (const dir of [path.join(ROOT, "tools", "pools"), path.join(ROOT, "tools", "banks"), path.join(ROOT, "tools", "seeds")]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      try {
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        const arr = Array.isArray(j) ? j : [];
        for (const e of arr) {
          if (e.title) titles.add(e.title.toLowerCase());
          if (e.source && !e.source.startsWith("http")) titles.add(e.source.toLowerCase());
          if (e.link) links.add(e.link);
          if (e.real) titles.add(e.real.toLowerCase());
        }
      } catch {}
    }
  }
  return { titles, links };
}

// ---- category walk (checkpointed: expensive, so never re-walk) -------------
async function walkCategories(roots, maxCats, ckptPath) {
  if (fs.existsSync(ckptPath)) {
    const c = JSON.parse(fs.readFileSync(ckptPath, "utf8"));
    console.log(`checkpoint found: ${Object.keys(c.pagesMap || {}).length} pages (skipping walk)`);
    const leafPages = new Map(Object.entries(c.pagesMap || {}));
    return { leafPages, examined: c.examined || 0, fromCheckpoint: true };
  }
  const visitedCats = new Set();
  const pagesMap = {};
  const queue = roots.map((r) => [r, 0]);
  let examined = 0;
  const save = () => fs.writeFileSync(ckptPath, JSON.stringify({ examined, pagesMap }));
  while (queue.length && visitedCats.size < maxCats) {
    const [cat, depth] = queue.shift();
    if (visitedCats.has(cat)) continue;
    visitedCats.add(cat);
    let members;
    try {
      members = await api({ action: "query", list: "categorymembers", cmtitle: cat, cmlimit: "500", cmtype: "page|subcat" });
    } catch (e) {
      console.log(`  skip ${cat}: ${e.message}`);
      save();
      continue;
    }
    const list = members.query?.categorymembers || [];
    for (const m of list) {
      if (m.ns === 14) {
        if (depth < 2 && !SKIP_CAT.test(m.title.replace("Category:", ""))) queue.push([m.title, depth + 1]);
      } else if (m.ns === 0) {
        if (!pagesMap[m.title]) pagesMap[m.title] = [];
        pagesMap[m.title].push(cat.replace("Category:", ""));
      }
    }
    examined++;
    if (examined % 5 === 0) {
      console.log(`  walked ${examined} cats, ${Object.keys(pagesMap).length} pages so far`);
      save();
    }
    await sleep(300);
  }
  save();
  return { leafPages: new Map(Object.entries(pagesMap)), examined, fromCheckpoint: false };
}

// ---- lead fetch (batched 50, chunk-resilient) ------------------------------
async function fetchLeads(titles) {
  const leads = {};
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    let ok = false;
    for (let a = 0; a < 4 && !ok; a++) {
      try {
        const j = await api({
          action: "query", titles: chunk.join("|"), prop: "extracts",
          exintro: "1", explaintext: "1", exlimit: "50", redirects: "1",
        });
        for (const p of Object.values(j.query?.pages || {})) {
          if (p.extract && p.missing === undefined) leads[p.title] = p.extract;
        }
        ok = true;
      } catch (e) {
        console.log(`  lead chunk ${i / 50 + 1} attempt ${a + 1} failed: ${e.message}`);
        await sleep(15000 * (a + 1)); // 429 backoff before retry
      }
    }
    if (!ok) console.log(`  SKIP lead chunk ${i / 50 + 1} (${chunk.length} titles lost to rate limit)`);
    await sleep(800);
  }
  return leads;
}

// ---- popularity (Wikimedia metrics, per article, capped) --------------------
async function fetchPopularity(titles, cap = 200) {
  const pop = {};
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const start = ym + "0100";
  const end = ym + "3100";
  for (const t of titles.slice(0, cap)) {
    const enc = encodeURIComponent(t).replace(/%2F/gi, "/");
    const u = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${enc}/monthly/${start}/${end}`;
    for (let a = 0; a < 3; a++) {
      try {
        const r = await fetch(u, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
        if (r.ok) {
          const d = await r.json();
          pop[t] = (d.items || []).reduce((s, x) => s + (x.views || 0), 0);
        } else if (r.status === 429 && a < 2) { await sleep(6000); continue; }
        else break;
        break;
      } catch { break; }
    }
    await sleep(250);
    if (Object.keys(pop).length % 25 === 0 && Object.keys(pop).length) console.log(`  pageviews ${Object.keys(pop).length}...`);
  }
  return pop;
}

// ---- scoring -----------------------------------------------------------------
function scoreCandidate(title, lead, cats) {
  const t = " " + title.toLowerCase() + " ";
  const l = " " + (lead || "").toLowerCase() + " ";
  let s = 0;
  const reasons = [];
  for (const sig of WEIRD_SIGNALS) {
    const re = new RegExp("\\b" + sig.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "(\\w*)\\b", "i");
    if (re.test(l) || re.test(t)) { s += 2; reasons.push(sig); }
  }
  const years = title.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g) || [];
  if (years.length) { s += 2; reasons.push("year-in-title"); }
  const leadWords = (lead || "").split(/\s+/).length;
  if (leadWords < 8) { s -= 6; reasons.push("stub-lead"); }
  else if (leadWords < 15) s -= 2;
  for (const ne of NON_EVENT) {
    if (ne.re.test(lead || "")) { s -= ne.pen; reasons.push(ne.why); }
  }
  if ((cats || []).some((c) => /hoax|conspir|myster|scandal|controvers/i.test(c))) { s += 1; reasons.push("weird-cat"); }
  return { score: s, reasons: [...new Set(reasons)].slice(0, 5), blacklisted: BLACKLIST.test(lead || "") || BLACKLIST.test(title) };
}

// auto verify phrases: title tokens + years + 1-2 distinctive lead words.
// resolve.js re-checks every phrase on the live page, so imperfect guesses are safe.
function autoVerify(title, lead) {
  const v = new Set();
  for (const y of (title.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/g) || []).slice(0, 2)) v.add(y);
  const words = title.replace(/\(.+\)/, "").replace(/[^\p{L}\p{N}\s'-]/gu, "").split(/\s+/).filter((w) => w.length > 3);
  for (const w of words.slice(0, 3)) v.add(w.toLowerCase());
  if (v.size < 3) {
    const stop = new Set(["the","and","was","were","for","with","from","that","this","have","has","had","its","his","her","their","into","over","under","after","before","between","against","about","more","most","than","then","them","they","when","where","which","while","also","been","being","first","second","three","four","five","six","seven","eight","nine","ten"]);
    for (const w of (lead || "").toLowerCase().split(/[^\p{L}'-]+/u).filter((w) => w.length > 6 && !stop.has(w))) {
      v.add(w);
      if (v.size >= 4) break;
    }
  }
  return [...v].slice(0, 4);
}

// ---------------------------------------------------------------------------
(async () => {
  const segKey = process.argv[2];
  const seg = SEGMENTS[segKey];
  if (!seg) {
    console.log("usage: node tools/crawl.js <" + Object.keys(SEGMENTS).join("|") + "> [maxCandidates] [--no-pop]");
    process.exit(1);
  }
  const maxCand = parseInt(process.argv[3] || "60", 10);
  const usePop = !process.argv.includes("--no-pop");
  const maxCats = 60;

  console.log(`== crawl ${seg.label} (roots: ${seg.roots.length}) ==`);
  const corpus = loadDedupeCorpus();
  console.log(`dedupe corpus: ${corpus.titles.size} headlines, ${corpus.links.size} links`);

  const { leafPages, examined, fromCheckpoint } = await walkCategories(seg.roots, maxCats, path.join(ROOT, "tools", `.crawl-ckpt-${segKey}.json`));
  console.log(`walked ${examined} categories -> ${leafPages.size} pages${fromCheckpoint ? " (from checkpoint)" : ""}`);

  // filter
  let cands = [...leafPages.entries()]
    .filter(([t]) => !SKIP_TITLE.test(t))
    .filter(([t]) => {
      const tl = t.toLowerCase();
      return ![...corpus.titles].some((x) => x.length > 12 && tl.includes(x)) &&
             ![...corpus.links].some((l) => l.includes(encodeURIComponent(t.replace(/ /g, "_"))));
    })
    .map(([t, cats]) => ({ title: t, cats }));
  console.log(`after junk+dedupe filters: ${cands.length}`);
  if (!cands.length) { console.log("nothing new found — widen roots in SEGMENTS config."); process.exit(0); }

  const leads = await fetchLeads(cands.map((c) => c.title));
  console.log(`leads fetched: ${Object.keys(leads).length}`);

  for (const c of cands) {
    c.lead = leads[c.title] || "";
    const sc = scoreCandidate(c.title, c.lead, c.cats);
    c.score = sc.score;
    c.reasons = sc.reasons;
  }

  let pool = cands.filter((c) => c.score >= 3 && !c.blacklisted).sort((a, b) => b.score - a.score);
  const blacked = cands.filter((c) => c.blacklisted).length;
  if (blacked) console.log(`tone guard excluded ${blacked} blacklisted pages`);
  if (usePop && pool.length) {
    console.log(`fetching pageviews for top ${Math.min(pool.length, 200)}...`);
    const pop = await fetchPopularity(pool.map((c) => c.title), Math.min(pool.length, 200));
    for (const c of pool) {
      c.views = pop[c.title] || 0;
      if (c.views >= 5000) c.score += 2;
      else if (c.views >= 1000) c.score += 1;
      else if (c.views === 0) c.score -= 1;
    }
    pool.sort((a, b) => b.score - a.score);
  }

  pool = pool.slice(0, maxCand).map((c) => ({
    title: c.title,
    verify: autoVerify(c.title, c.lead),
    score: c.score,
    views: c.views || null,
    why: c.reasons.join(", "),
    lead: (c.lead || "").slice(0, 220),
  }));

  // write pool
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const poolPath = path.join(ROOT, "tools", "pools", `crawl-${segKey}-${date}.json`);
  fs.writeFileSync(poolPath, JSON.stringify(pool, null, 1) + "\n");

  // write report for authoring
  const repPath = path.join(ROOT, `tools/crawl-${segKey}-report.md`);
  const lines = [
    `# Crawl report — ${seg.label} (${date})`,
    ``,
    `Walked ${examined} categories, ${cands.length} candidates after filters. Pool: top ${pool.length} by score.`,
    ``,
    `| # | title | score | views | why | lead (first 200ch) |`,
    `|---|-------|-------|-------|-----|--------------------|`,
  ];
  for (const [i, c] of cands.filter((c) => c.score >= 2).sort((a, b) => b.score - a.score).entries()) {
    const inPool = pool.some((p) => p.title === c.title);
    lines.push(`| ${i + 1}${inPool ? " ★" : ""} | ${c.title} | ${c.score} | ${c.views ?? "-"} | ${c.reasons.join(", ")} | ${(c.lead || "").replace(/\|/g, "/").slice(0, 200)} |`);
  }
  fs.writeFileSync(repPath, lines.join("\n") + "\n");

  console.log(`\nPOOL  ${path.relative(ROOT, poolPath)}  (${pool.length} candidates)`);
  console.log(`REPORT ${path.relative(ROOT, repPath)}`);
  console.log(`\nnext: node tools/resolve.js ${path.relative(ROOT, poolPath)}`);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
