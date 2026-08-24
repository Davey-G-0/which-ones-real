// ============ Which One's Real? — game logic ============
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const screens = { home: $("screen-home"), game: $("screen-game"), results: $("screen-results") };
  const AVATARS = ["🦊", "🐸", "🦉", "🐼", "🐯", "🦄", "🐙", "🐨", "🦁", "🐵", "🐷", "🦜", "🐢", "🐺", "🦖", "🐧"];

  // Group questions by category label.
  const BY_CAT = {};
  for (const q of QUESTIONS) (BY_CAT[q.category] ||= []).push(q);

  const state = {
    players: [],          // {name, emoji, score}
    selectedCats: new Set(),
    round: 0,             // index into the shuffled question list
    queue: [],            // shuffled questions for this game
    locked: false,
  };

  // ---------- HOME ----------
  function renderPlayers() {
    const wrap = $("player-chips");
    wrap.innerHTML = "";
    state.players.forEach((p, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `<span class="chip-emoji">${p.emoji}</span>${escapeHtml(p.name)}
        <button class="chip-remove" data-i="${i}" aria-label="Remove ${escapeHtml(p.name)}">✕</button>`;
      wrap.appendChild(chip);
    });
    $("start-game").disabled = state.players.length < 2 || state.selectedCats.size === 0;
  }

  function renderCategories() {
    const grid = $("category-grid");
    grid.innerHTML = "";
    const emojis = {
      "News apps": "📰", "Food delivery apps": "🍔", "Music apps": "🎧",
      "Banking apps": "💳", "Social media apps": "📱", "Sports apps": "🏆",
      "Shopping apps": "🛒", "Travel apps": "✈️",
    };
    Object.keys(BY_CAT).forEach((cat) => {
      const b = document.createElement("button");
      b.className = "cat-btn" + (state.selectedCats.has(cat) ? " selected" : "");
      b.innerHTML = `<span class="cat-emoji">${emojis[cat] || "🎯"}</span>${escapeHtml(cat)}`;
      b.onclick = () => {
        state.selectedCats.has(cat) ? state.selectedCats.delete(cat) : state.selectedCats.add(cat);
        renderCategories(); renderPlayers();
      };
      grid.appendChild(b);
    });
  }

  function addPlayer(name) {
    name = (name || "").trim().slice(0, 16);
    if (!name) return;
    if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    state.players.push({ name, emoji: AVATARS[state.players.length % AVATARS.length], score: 0 });
    renderPlayers();
  }

  // ---------- GAME ----------
  function startGame() {
    // Build the queue: all questions in the selected categories, shuffled.
    const pool = [...state.selectedCats].flatMap((c) => BY_CAT[c]);
    state.queue = shuffle(pool);
    state.round = 0;
    state.players.forEach((p) => (p.score = 0));
    showScreen("game");
    renderRound();
  }

  function currentPlayer() {
    return state.players[state.round % state.players.length];
  }

  function renderRound() {
    state.locked = false;
    const p = currentPlayer();
    const q = state.queue[state.round];

    $("turn-avatar").textContent = p.emoji;
    $("turn-name").textContent = p.name;
    $("turn-label").textContent = "picks the real one";
    $("round-pip").textContent = `${state.round + 1}/${state.queue.length}`;
    $("category-banner").textContent = q.category;

    const opts = $("options");
    opts.innerHTML = "";
    shuffle([q.real, ...q.fakes]).forEach((label) => {
      const b = document.createElement("button");
      b.className = "option";
      b.textContent = label;
      b.onclick = () => pick(b, label, q, p);
      opts.appendChild(b);
    });

    const fb = $("feedback");
    fb.className = "feedback hidden";
    fb.innerHTML = "";
  }

  function pick(btn, label, q, player) {
    if (state.locked) return;
    state.locked = true;

    const isReal = label === q.real;
    // Reveal every option.
    [...document.querySelectorAll(".option")].forEach((o) => {
      o.classList.add("locked");
      o.classList.add(o.textContent === q.real ? "revealed-real" : "revealed-fake");
    });

    let fb;
    if (isReal) {
      player.score += 1;
      fb = `<div class="feedback win">🎉 ${escapeHtml(player.name)} nailed it!
        <div class="fb-sub">${escapeHtml(q.real)} is the real one. +1 point</div></div>`;
      vibrate(40);
    } else {
      fb = `<div class="feedback lose">😅 Not quite — that was a fake!
        <div class="fb-sub">${escapeHtml(q.real)} was the real app.</div></div>`;
      vibrate([60, 40, 60]);
    }
    $("feedback").outerHTML = fb.replace(/^<div|<\/div>$/g, "");

    // Auto-advance after a beat.
    setTimeout(() => {
      state.round++;
      if (state.round >= state.queue.length) endGame();
      else renderRound();
    }, isReal ? 1100 : 2200);
  }

  function endGame() {
    showScreen("results");
    const board = $("leaderboard");
    board.innerHTML = "";
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    sorted.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "lb-row";
      row.style.animationDelay = `${i * 0.06}s`;
      row.innerHTML = `<span class="lb-rank">#${i + 1}</span>
        <span class="lb-emoji">${p.emoji}</span>
        <span class="lb-name">${escapeHtml(p.name)}</span>
        <span class="lb-score">${p.score}</span>`;
      board.appendChild(row);
    });
  }

  // ---------- UTIL ----------
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo({ top: 0 });
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function vibrate(p) { if (navigator.vibrate) navigator.vibrate(p); }

  // ---------- WIRING ----------
  $("add-player").onclick = () => { addPlayer($("player-name").value); $("player-name").value = ""; };
  $("player-name").addEventListener("keydown", (e) => { if (e.key === "Enter") { addPlayer(e.target.value); e.target.value = ""; } });
  $("player-chips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip-remove");
    if (btn) { state.players.splice(+btn.dataset.i, 1); renderPlayers(); }
  });
  $("add-default-players").onclick = () => {
    ["Alex", "Sam", "Jordan", "Riley"].forEach(addPlayer);
  };
  $("all-categories").onclick = () => {
    if (state.selectedCats.size === Object.keys(BY_CAT).length) state.selectedCats.clear();
    else Object.keys(BY_CAT).forEach((c) => state.selectedCats.add(c));
    renderCategories(); renderPlayers();
  };
  $("start-game").onclick = startGame;
  $("quit-btn").onclick = () => {
    if (confirm("Quit this game? Scores will be reset.")) {
      Object.values(screens).forEach((s) => s.classList.remove("active"));
      screens.home.classList.add("active");
    }
  };
  $("play-again").onclick = startGame;
  $("change-setup").onclick = () => {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens.home.classList.add("active");
  };

  // ---------- INIT ----------
  renderCategories();
  renderPlayers();
  // Pre-select News apps so the game is ready to go with the classic mechanic.
  state.selectedCats.add("News apps");
  renderCategories();
})();
