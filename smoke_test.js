// Headless smoke test: simulate the full game loop with a minimal DOM stub.
// Verifies the turn-two crash is gone and the Next button drives rounds.
const fs = require("fs");
const path = require("path");
const DIR = __dirname;

// ---- Minimal DOM stub ----
function makeEl(id) {
  return {
    id,
    children: [],
    _innerHTML: "",
    _className: "",
    _text: "",
    _hidden: false,
    onclick: null,
    disabled: false,
    style: {},
    dataset: {},
    classList: {
      _set: new Set(),
      add(...c) { c.forEach(x => this._set.add(x)); },
      remove(...c) { c.forEach(x => this._set.delete(x)); },
      contains(c) { return this._set.has(c); },
    },
    get className() { return this._className; },
    set className(v) { this._className = v; v.split(/\s+/).filter(Boolean).forEach(x => this.classList.add(x)); if (v.trim() === "") this.classList._set.clear(); },
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = String(v); this.children = []; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    get value() { return this._text; },
    set value(v) { this._text = String(v); },
    querySelectorAll() { return this._qsa || []; },
    focus() {},
    addEventListener() {},
  };
}

const ids = ["screen-home","screen-game","screen-results","player-chips","start-game",
  "player-name","add-player","add-default-players","category-grid","all-categories",
  "turn-avatar","turn-name","turn-label","round-pip","category-banner","question-prompt",
  "options","feedback","next-btn","leaderboard","play-again","change-setup","quit-btn"];
const els = {};
ids.forEach(i => els[i] = makeEl(i));

// option buttons: app.js queries document.querySelectorAll(".option")
let currentOptionBtns = [];
global.document = {
  getElementById: (id) => els[id] || (els[id] = makeEl(id)),
  createElement: (tag) => makeEl(tag),
  querySelectorAll: (sel) => {
    if (sel === ".option") return currentOptionBtns;
    return [];
  },
  body: makeEl("body"),
};
global.window = { scrollTo(){} };
global.navigator = { vibrate(){} };
global.confirm = () => true;

// Load data.js (defines QUESTIONS) then app.js (runs the IIFE).
const dataSrc = fs.readFileSync(path.join(DIR, "data.js"), "utf8");
const appSrc = fs.readFileSync(path.join(DIR, "app.js"), "utf8");
(0, eval)(dataSrc + "\n" + appSrc);

// ---- Drive the game ----
// Add 2 players
function addPlayer(name) {
  els["player-name"]._text = name;
  els["add-player"].onclick();
  els["player-name"]._text = "";
}
addPlayer("Graham");
addPlayer("Testy");

// Start the game (News headlines is pre-selected).
els["start-game"].onclick();

// The app reads $(id).value for the name input — our stub uses _text. Patch:
// addPlayer uses $(\"player-name\").value; give the input a .value getter.
// (Re-run with a proper value property to be faithful.)
console.log("players rendered:", els["player-chips"].children.length);

let rounds = 0;
let errors = [];
try {
  // Simulate playing through the ENTIRE queue by always clicking the first option.
  // Each pick() reveals, shows feedback, and shows the next button. advance() moves on.
  const total = els["round-pip"]._text; // "1/N"
  const N = parseInt(total.split("/")[1], 10);
  for (let r = 0; r < N; r++) {
    // Grab the option buttons rendered this round.
    currentOptionBtns = els["options"].children.slice();
    if (!currentOptionBtns.length) throw new Error("No option buttons rendered at round " + (r+1));
    // Click the first option.
    currentOptionBtns[0].onclick();
    // After pick, feedback must be a well-formed element (no raw 'class=' text leak).
    const fb = els["feedback"]._innerHTML;
    if (fb.includes('class="feedback')) {
      errors.push("Raw HTML attribute leaked into feedback at round " + (r+1) + ": " + fb);
    }
    // Next button must be visible (not hidden) after a pick.
    if (els["next-btn"].classList.contains("hidden")) {
      errors.push("Next button still hidden after pick at round " + (r+1));
    }
    rounds++;
    // Advance via the button (this is the part that used to crash on turn 2).
    els["next-btn"].onclick();
    // After advancing (non-final), feedback should be hidden again and next hidden.
    if (r + 1 < N) {
      if (!els["feedback"].className.includes("hidden")) {
        errors.push("Feedback not reset after advance at round " + (r+1));
      }
      if (!els["next-btn"].classList.contains("hidden")) {
        errors.push("Next button not hidden after advance at round " + (r+1));
      }
    }
  }
  // After the last advance we should be on the results screen.
  const onResults = els["screen-results"].classList.contains("active");
  console.log("completed rounds:", rounds, "/ expected", N);
  console.log("landed on results screen:", onResults);
  console.log("leaderboard rows:", els["leaderboard"].children.length);
  if (!onResults) errors.push("Did not land on results screen after final round");
} catch (e) {
  errors.push("EXCEPTION: " + e.message);
  console.log("CRASH at round", rounds + 1, ":", e.message);
}

console.log(errors.length ? "\n❌ FAILURES:\n" + errors.join("\n") : "\n✅ ALL CHECKS PASSED — turn two and beyond work, next button drives the game, no HTML leak.");
process.exit(errors.length ? 1 : 0);
