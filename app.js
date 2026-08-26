// ============ Which One's Real? — game engine v2 ============
// Modes:
//   classic — one pass through the filtered bank, most correct wins.
//   endless — "Endless Wave": infinite rounds; correct answers are worth
//             (current wave) points. Ends when a host taps End Game.
//   sudden  — "Sudden Death": first wrong pick is out. Last one standing wins.
// Filter stack: segment × region × era, AND-combined. Empty = everything.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const screens = { home: $("screen-home"), game: $("screen-game"), results: $("screen-results") };
  const AVATARS = ["🦊", "🐸", "🦉", "🐼", "🐯", "🦄", "🐙", "🐨", "🦁", "🐵", "🐷", "🦜", "🐢", "🐺", "🦖", "🐧"];
  const DIMS = ["segment", "region", "era"];

  const MODES = {
    classic: { label: "Classic", icon: "📰", blurb: "One pass, most correct wins." },
    endless: { label: "Endless Wave", icon: "🌊", blurb: "Never ends — waves pay more." },
    sudden: { label: "Sudden Death", icon: "💀", blurb: "One wrong pick and you're out." },
  };

  const state = {
    players: [],          // {name, emoji, score}
    mode: "classic",
    filters: { segment: new Set(), region: new Set(), era: new Set() },
    queue: [],
    round: 0,
    locked: false,
    wave: 1,
    eliminated: new Set(), // names — sudden death only
    winner: null,
  };

  // ---------- FILTERS ----------
  function filterValues(dim) {
    const s = new Set();
    for (const q of QUESTIONS) s.add(q[dim]);
    return [...s].sort();
  }
  function matchesFilters(q) {
    for (const dim of DIMS) {
      const sel = state.filters[dim];
      if (sel.size && !sel.has(q[dim])) return false;
    }
    return true;
  }
  function filteredPool() {
    return QUESTIONS.filter(matchesFilters);
  }
  function activeFilterText() {
    const parts = DIMS.map((d) => (state.filters[d].size ? [...state.filters[d]].join("/") : null));
    const on = parts.filter(Boolean);
    return on.length ? on.join(" · ") : "Everything";
  }

  function renderFilters() {
    for (const dim of DIMS) {
      const wrap = $("filter-" + dim);
      wrap.innerHTML = "";
      // "All" chip
      const all = document.createElement("button");
      all.className = "chip-btn" + (state.filters[dim].size === 0 ? " selected" : "");
      all.textContent = "All";
      all.onclick = () => { state.filters[dim].clear(); renderFilters(); renderPoolCount(); };
      wrap.appendChild(all);
      for (const val of filterValues(dim)) {
        const b = document.createElement("button");
        b.className = "chip-btn" + (state.filters[dim].has(val) ? " selected" : "");
        b.textContent = val;
        b.onclick = () => {
          state.filters[dim].has(val) ? state.filters[dim].delete(val) : state.filters[dim].add(val);
          renderFilters(); renderPoolCount();
        };
        wrap.appendChild(b);
      }
    }
  }

  function renderPoolCount() {
    const n = filteredPool().length;
    $("pool-count").textContent =
      n === 0 ? "No stories match those filters" : `${n} ${n === 1 ? "story" : "stories"} in the pool`;
    $("start-game").disabled = state.players.length < 2 || n === 0;
  }

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
    $("start-game").disabled = state.players.length < 2 || filteredPool().length === 0;
  }

  function renderModes() {
    const grid = $("mode-grid");
    grid.innerHTML = "";
    Object.entries(MODES).forEach(([key, m]) => {
      const b = document.createElement("button");
      b.className = "mode-btn" + (state.mode === key ? " selected" : "");
      b.innerHTML = `<span class="mode-icon">${m.icon}</span>
        <span class="mode-text"><span class="mode-name">${m.label}</span>
        <span class="mode-blurb">${m.blurb}</span></span>`;
      b.onclick = () => { state.mode = key; renderModes(); };
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

  // ---------- QUEUE ----------
  function drawQuestion() {
    // Never repeat a story within a single pass; refill by reshuffling the pool.
    if (state.queue.length === 0) state.queue = shuffle(filteredPool());
    return state.queue.pop();
  }

  function alivePlayers() {
    return state.players.filter((p) => !state.eliminated.has(p.name));
  }

  function currentPlayer() {
    const pool = state.mode === "sudden" ? alivePlayers() : state.players;
    return pool[state.round % pool.length];
  }

  // ---------- GAME ----------
  function startGame() {
    state.round = 0;
    state.wave = 1;
    state.eliminated.clear();
    state.winner = null;
    state.queue = [];
    state.players.forEach((p) => (p.score = 0));
    showScreen("game");
    renderRound();
  }

  function roundPipText() {
    if (state.mode === "classic") {
      const total = filteredPool().length;
      return `${state.round + 1}/${total}`;
    }
    if (state.mode === "endless") return `Wave ${state.wave}`;
    return `${alivePlayers().length} in the game`;
  }

  function renderRound() {
    state.locked = false;
    const p = currentPlayer();
    const q = drawQuestion();

    $("turn-avatar").textContent = p.emoji;
    $("turn-name").textContent = p.name;
    $("turn-label").textContent =
      state.mode === "sudden" ? "one wrong pick ends it" : "picks the real one";
    $("round-pip").textContent = roundPipText();
    $("category-banner").textContent = `${q.segment} · ${q.era} · ${activeFilterText()}`;

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

    // End Game button only in Endless Wave.
    $("end-btn").classList.toggle("hidden", state.mode !== "endless");
    const next = $("next-btn");
    next.classList.add("hidden");
    if (state.mode === "endless") next.textContent = "Next question →";
  }

  function revealFeedback(q, player, isReal) {
    const link = `<a class="fb-link" href="${escapeHtml(q.link)}" target="_blank" rel="noopener">🔗 ${escapeHtml(q.outlet)} — open the source</a>`;
    const fb = $("feedback");
    if (isReal) {
      const pts = state.mode === "endless" ? state.wave : 1;
      const ptsText = state.mode === "endless" ? ` (+${pts})` : "";
      fb.className = "feedback win";
      fb.innerHTML = `🎉 ${escapeHtml(player.name)} nailed it!${ptsText}
        <div class="fb-sub">${escapeHtml(q.source)}</div>${link}`;
      vibrate(40);
    } else {
      const extra =
        state.mode === "sudden"
          ? `<div class="fb-sub fb-out">💀 ${escapeHtml(player.name)} is OUT.</div>`
          : "";
      fb.className = "feedback lose";
      fb.innerHTML = `😅 Not quite — that one's fake.${extra}
        <div class="fb-sub">${escapeHtml(q.real)} was real: ${escapeHtml(q.source)}</div>${link}`;
      vibrate([60, 40, 60]);
    }
  }

  function pick(btn, label, q, player) {
    if (state.locked) return;
    state.locked = true;

    const isReal = label === q.real;
    [...document.querySelectorAll(".option")].forEach((o) => {
      o.classList.add("locked");
      o.classList.add(o.textContent === q.real ? "revealed-real" : "revealed-fake");
    });

    if (isReal) {
      player.score += state.mode === "endless" ? state.wave : 1;
    } else if (state.mode === "sudden") {
      state.eliminated.add(player.name);
      if (alivePlayers().length === 1) state.winner = alivePlayers()[0].name;
    }

    revealFeedback(q, player, isReal);

    // Sudden death: game over the moment one player is left.
    if (state.mode === "sudden" && alivePlayers().length <= 1) {
      $("end-btn").classList.add("hidden");
      const next = $("next-btn");
      next.textContent = "See the winner →";
      next.classList.remove("hidden");
      next.focus();
      return;
    }

    const next = $("next-btn");
    next.textContent =
      state.mode === "classic" && state.round + 1 >= filteredPool().length ? "See scores →" : "Next question →";
    next.classList.remove("hidden");
    next.focus();
  }

  function advance() {
    state.round++;
    if (state.mode === "endless" && state.round % 3 === 0) state.wave++;
    if (state.mode === "sudden" && alivePlayers().length <= 1) endGame();
    else if (state.mode === "classic" && state.round >= filteredPool().length) endGame();
    else renderRound();
  }

  function endGame() {
    showScreen("results");
    const board = $("leaderboard");
    board.innerHTML = "";

    if (state.mode === "sudden") {
      $("results-title").textContent = state.winner
        ? `${state.winner} wins!`
        : "Everyone survived!";
      $("results-sub").textContent = "Sudden Death — last one standing.";
      $("results-sub").classList.remove("hidden");
    } else {
      $("results-title").textContent = "Final Scores";
      $("results-sub").textContent =
        state.mode === "endless" ? `Endless Wave — ${state.wave} waves played.` : "";
      $("results-sub").classList.toggle("hidden", !$("results-sub").textContent);
    }

    const sorted = [...state.players].sort((a, b) => {
      if (state.mode === "sudden") {
        const aOut = state.eliminated.has(a.name) ? 1 : 0;
        const bOut = state.eliminated.has(b.name) ? 1 : 0;
        return aOut - bOut;
      }
      return b.score - a.score;
    });
    sorted.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "lb-row" + (state.mode === "sudden" && state.eliminated.has(p.name) ? " lb-out" : "");
      row.style.animationDelay = `${i * 0.06}s`;
      const scoreText =
        state.mode === "sudden"
          ? state.eliminated.has(p.name) ? "eliminated" : "survived"
          : String(p.score);
      row.innerHTML = `<span class="lb-rank">#${i + 1}</span>
        <span class="lb-emoji">${p.emoji}</span>
        <span class="lb-name">${escapeHtml(p.name)}</span>
        <span class="lb-score">${scoreText}</span>`;
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
  $("start-game").onclick = startGame;
  $("next-btn").onclick = advance;
  $("end-btn").onclick = endGame;
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
  renderModes();
  renderFilters();
  renderPlayers();
  renderPoolCount();
})();
