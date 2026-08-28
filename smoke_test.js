// Headless smoke test v2: drives Classic, Endless Wave, and Sudden Death,
// the filter stack, and verifies the source link appears on every reveal.
const fs = require("fs");
const path = require("path");
const DIR = __dirname;

// ---- Minimal DOM stub (registry keyed by id) ----
function makeEl(tag, id) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: id || "",
    children: [],
    _innerHTML: "",
    _className: "",
    _text: "",
    onclick: null,
    disabled: false,
    value: "",
    style: {},
    dataset: {},
    focus() {},
    addEventListener() {},
    appendChild(c) { this.children.push(c); c.parent = this; return c; },
    get className() { return this._className; },
    set className(v) {
      this._className = String(v);
      this._classes = new Set(String(v).split(/\s+/).filter(Boolean));
    },
    get classList() {
      const self = this;
      return {
        add(...c) { c.forEach((x) => self._classes.add(x)); },
        remove(...c) { c.forEach((x) => self._classes.delete(x)); },
        toggle(c, force) {
          const has = self._classes.has(c);
          const want = force === undefined ? !has : force;
          want ? self._classes.add(c) : self._classes.delete(c);
          return want;
        },
        contains(c) { return self._classes.has(c); },
      };
    },
    get _classes() { return this.__c || (this.__c = new Set()); },
    set _classes(v) { this.__c = v; },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  el.className = ""; // initialize class set
  return el;
}

const els = {};
const byId = (id) => els[id] || (els[id] = makeEl("div", id));
let currentOptionBtns = [];

global.document = {
  getElementById: byId,
  createElement: (tag) => makeEl(tag),
  querySelectorAll: (sel) => (sel === ".option" ? currentOptionBtns : []),
  body: makeEl("body"),
};
global.window = { scrollTo() {} };
global.navigator = { vibrate() {} };
global.confirm = () => true;

// Load data.js (defines QUESTIONS) then app.js (runs the IIFE).
const dataSrc = fs.readFileSync(path.join(DIR, "data.js"), "utf8");
const appSrc = fs.readFileSync(path.join(DIR, "app.js"), "utf8");
(0, eval)(dataSrc + "\n; globalThis.QUESTIONS = QUESTIONS;\n" + appSrc);

// ---- Helpers ----
const errors = [];
function fail(msg) { errors.push(msg); }
function addPlayer(name) {
  byId("player-name").value = name;
  byId("add-player").onclick();
  byId("player-name").value = "";
}
function clickFirstOption() {
  currentOptionBtns = byId("options").children.slice();
  if (!currentOptionBtns.length) throw new Error("No option buttons rendered");
  currentOptionBtns[0].onclick();
}
function clickWrongOption() {
  currentOptionBtns = byId("options").children.slice();
  const realHeadlines = new Set(QUESTIONS.map((q) => q.real));
  const fake = currentOptionBtns.find((b) => !realHeadlines.has(b._text));
  if (!fake) throw new Error("No fake option rendered");
  fake.onclick();
}
function leaderboardScore(row) {
  const match = row._innerHTML.match(/class="lb-score">([^<]*)<\/span>/);
  if (!match) throw new Error("Leaderboard score cell not rendered");
  return match[1];
}
function checkReveal(round) {
  const fb = byId("feedback")._innerHTML;
  if (fb.includes('class="feedback')) fail(`Raw HTML leaked into feedback (round ${round})`);
  if (!fb.includes("fb-link")) fail(`Source link missing on reveal (round ${round})`);
  if (byId("next-btn").classList.contains("hidden")) fail(`Next button hidden after pick (round ${round})`);
}
function playRounds(n) {
  for (let r = 0; r < n; r++) {
    clickFirstOption();
    checkReveal(r + 1);
    byId("next-btn").onclick();
  }
}
function clickChip(dim, label) {
  const btns = byId("filter-" + dim).children;
  const b = btns.find((x) => x._text === label);
  if (!b) throw new Error(`Chip "${label}" not found in ${dim}`);
  b.onclick();
}

// ================= SETUP =================
addPlayer("Graham");
addPlayer("Testy");
addPlayer("Molly");
console.log("players rendered:", byId("player-chips").children.length);
if (byId("player-chips").children.length !== 3) fail("Expected 3 player chips");
console.log("pool count text:", byId("pool-count")._text);
const POOL = QUESTIONS.length;
console.log("questions in bank:", POOL);
if (POOL < 15) fail("Bank should have at least 15 verified stories");

// ---- Filter stack: pick a topic, check the pool shrinks ----
clickChip("segment", "Sports");
const sportsCount = byId("pool-count")._text;
console.log("after filter Sports:", sportsCount);
const expectedSports = QUESTIONS.filter((q) => q.segment === "Sports").length;
if (!new RegExp(expectedSports + " stor").test(sportsCount)) fail("Sports filter should leave " + expectedSports + " stories, got: " + sportsCount);
clickChip("segment", "All");
console.log("after clear:", byId("pool-count")._text);
if (byId("pool-count")._text !== `${POOL} stories in the pool`) fail("Clearing filter should restore full pool");

// ================= MODE 1: CLASSIC =================
byId("start-game").onclick();
if (!byId("screen-game").classList.contains("active")) fail("Classic: game screen not active");
console.log("\n--- Classic: playing through all", POOL, "rounds ---");
playRounds(POOL);
if (!byId("screen-results").classList.contains("active")) fail("Classic: did not land on results");
if (byId("leaderboard").children.length !== 3) fail("Classic: leaderboard should have 3 rows");
console.log("classic results title:", byId("results-title")._text);
console.log("classic leaderboard rows:", byId("leaderboard").children.length);

// ================= MODE 2: ENDLESS WAVE =================
byId("change-setup").onclick();
if (!byId("screen-home").classList.contains("active")) fail("Endless: change-setup did not go home");
// Select Endless Wave (second mode button).
byId("mode-grid").children[1].onclick();
byId("start-game").onclick();
console.log("\n--- Endless Wave: 7 rounds, then End Game ---");
const pipBefore = byId("round-pip")._text;
console.log("pip at start:", pipBefore);
if (pipBefore !== "Wave 1") fail("Endless should start at Wave 1, got: " + pipBefore);
playRounds(7);
// Waves increment every 3 rounds: after 7 rounds the current round is #8 -> wave 3.
console.log("pip after 7 rounds:", byId("round-pip")._text);
if (!byId("round-pip")._text.startsWith("Wave")) fail("Endless: pip lost the Wave label");
// Endless must NOT auto-end: still on the game screen.
if (!byId("screen-game").classList.contains("active")) fail("Endless: game ended before End Game was tapped");
if (byId("end-btn").classList.contains("hidden")) fail("Endless: End Game button should be visible");
byId("end-btn").onclick();
if (!byId("screen-results").classList.contains("active")) fail("Endless: End Game did not reach results");
console.log("endless results title:", byId("results-title")._text, "| sub:", byId("results-sub")._text);
if (!/Endless Wave/.test(byId("results-sub")._text)) fail("Endless: results sub should mention waves");
const endlessScores = byId("leaderboard").children.map(leaderboardScore);
console.log("endless scores (all players clicked the same first option):", endlessScores.join(","));
// Everyone clicked the same option every round; scores must be positive numbers
// and the wave bonus means total > rounds if they got some right.
const nums = endlessScores.map((s) => parseInt(s, 10));
if (nums.some((n) => Number.isNaN(n))) fail("Endless: leaderboard scores must be numbers, got: " + endlessScores);
if (nums.every((n) => n === 0)) fail("Endless: everyone scored 0 — wave points never awarded");

// ================= MODE 3: SUDDEN DEATH =================
byId("change-setup").onclick();
byId("mode-grid").children[2].onclick();
byId("start-game").onclick();
console.log("\n--- Sudden Death: 3 players, 3 wrong picks, 1 winner ---");
// Always choose an option that is not a verified real headline so the test
// deterministically exercises elimination rather than depending on shuffle.
const pips = [];
for (let r = 0; r < 3; r++) {
  clickWrongOption();
  checkReveal(r + 1);
  pips.push(byId("round-pip")._text);
  // After a pick in sudden death the next button is visible (unless it ended).
  if (!byId("screen-game").classList.contains("active")) break;
  byId("next-btn").onclick();
}
console.log("sudden pips:", pips.join(" -> "));
if (!byId("screen-results").classList.contains("active")) fail("Sudden: should end when 1 player remains");
console.log("sudden results title:", byId("results-title")._text);
if (!/wins/.test(byId("results-title")._text)) fail("Sudden: title should declare a winner, got: " + byId("results-title")._text);
const lbRows = byId("leaderboard").children;
if (lbRows.length !== 3) fail("Sudden: leaderboard should list all 3 players");
const scoreTexts = lbRows.map(leaderboardScore);
console.log("sudden board:", scoreTexts.join(" | "));
if (!scoreTexts.includes("survived")) fail("Sudden: winner row should say 'survived'");
if (scoreTexts.filter((t) => t === "eliminated").length !== 2) fail("Sudden: exactly 2 rows should say 'eliminated'");

// ================= REPORT =================
console.log();
if (errors.length) {
  console.log("❌ FAILURES:\n" + errors.join("\n"));
  process.exit(1);
} else {
  console.log("✅ ALL CHECKS PASSED — Classic, Endless Wave (wave scoring + End Game), Sudden Death (eliminations + winner), filter stack, and source links on every reveal.");
  process.exit(0);
}
