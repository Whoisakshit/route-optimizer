/* ══════════════════════════════════════════════════════════
   js/ui.js  — App state, events, orchestration, DOM updates
   Depends on: data.js, canvas.js, algorithms.js
══════════════════════════════════════════════════════════ */
"use strict";

/* ── App state ──────────────────────────────────────────── */
const appState = {
  startNode:   0,
  endNode:     14,
  traffic:     1,
  animSpeed:   150,   // ms per step (default = 1×)
  running:     false,
  paused:      false,
  results:     {},
  activeAlgos: { dijkstra: true, bellman: true, astar: true },
};

/* sync renderState with appState */
function syncRS() {
  Object.assign(window.renderState, {
    startNode:   appState.startNode,
    endNode:     appState.endNode,
    traffic:     appState.traffic,
    activeAlgos: appState.activeAlgos,
  });
}

/* ── Wire algorithm callbacks ───────────────────────────── */
window.algoCallbacks.logStep   = addStepEntry;
window.algoCallbacks.getSpeed  = () => appState.animSpeed;
window.algoCallbacks.isPaused  = () => appState.paused;
window.algoCallbacks.isRunning = () => appState.running;
window.algoCallbacks.sleep     = (ms) => new Promise(r => setTimeout(r, ms));

/* ── Populate selects ───────────────────────────────────── */
function populateSelects() {
  const ss = document.getElementById("startSel");
  const es = document.getElementById("endSel");
  ss.innerHTML = ""; es.innerHTML = "";
  for (const n of NODES) {
    ss.innerHTML += `<option value="${n.id}" ${n.id === appState.startNode ? "selected" : ""}>${n.name}</option>`;
    es.innerHTML += `<option value="${n.id}" ${n.id === appState.endNode   ? "selected" : ""}>${n.name}</option>`;
  }
}

/* ══════════════════════════════════════════════════════════
   STEP LOG (right panel)
══════════════════════════════════════════════════════════ */
let stepCounter = 0;

function clearStepLog() {
  stepCounter = 0;
  document.getElementById("stepLog").innerHTML =
    '<div class="step-idle">Press <strong>Start</strong> to begin visualization</div>';
  document.getElementById("stepLogTitle").innerHTML =
    '<span class="step-pip" id="stepPip"></span> Algorithm Steps';
}

function setStepLogAlgo(algo) {
  const color = ALGO_CFG[algo].color;
  const pip   = document.getElementById("stepPip");
  if (pip) { pip.style.background = color; pip.style.boxShadow = `0 0 8px ${color}`; pip.classList.add("live"); }
  document.querySelector("#stepLogTitle").lastChild.textContent = ` ${ALGO_CFG[algo].name} — Steps`;
}

function addStepEntry(algo, htmlMsg, isHighlight) {
  const log   = document.getElementById("stepLog");
  const color = ALGO_CFG[algo].color;

  // Remove idle placeholder
  const idle = log.querySelector(".step-idle");
  if (idle) idle.remove();

  stepCounter++;
  const entry = document.createElement("div");
  entry.className = "step-entry";
  entry.style.setProperty("--step-color", isHighlight ? color : "rgba(255,255,255,0.08)");
  entry.innerHTML = `
    <span class="step-num">${stepCounter}</span>
    <span class="step-text">${htmlMsg}</span>
  `;
  log.appendChild(entry);

  // Auto-scroll to bottom
  log.scrollTop = log.scrollHeight;

  // Keep last 60 entries for performance
  while (log.children.length > 60) log.removeChild(log.firstChild);
}

function addStepSectionHeader(algo, text) {
  const log   = document.getElementById("stepLog");
  const color = ALGO_CFG[algo].color;
  const hdr   = document.createElement("div");
  hdr.className = "step-section-header";
  hdr.style.setProperty("--step-color", color);
  hdr.textContent = text;
  log.appendChild(hdr);
  log.scrollTop = log.scrollHeight;
}

/* ══════════════════════════════════════════════════════════
   ALGO BOX STATUS
══════════════════════════════════════════════════════════ */
function setAlgoBoxStatus(algo, status) {
  // status: "waiting" | "running" | "done"
  const box = document.getElementById(`abox-${algo}`);
  const st  = document.getElementById(`astatus-${algo}`);
  if (!box || !st) return;

  st.className = `abox-status st-${status}`;
  const textEl = st.querySelector(".ast-text");
  const labels = { waiting: "Waiting", running: "Running…", done: "Done ✓" };
  if (textEl) textEl.textContent = labels[status] || status;

  box.classList.toggle("active-box", status === "running");
}

function setAlgoBoxEnabled(algo, enabled) {
  const box = document.getElementById(`abox-${algo}`);
  if (!box) return;
  box.classList.toggle("disabled-box", !enabled);
  box.classList.toggle("active-box", enabled);
  document.getElementById(`atoggle-${algo}`).textContent = enabled ? "ON" : "OFF";
  document.getElementById(`atoggle-${algo}`).classList.toggle("active", enabled);
}

/* ══════════════════════════════════════════════════════════
   RESULT CARDS
══════════════════════════════════════════════════════════ */
function resetResultCards() {
  for (const k of ["dijkstra", "bellman", "astar"]) {
    setResultStatus(k, "waiting");
    setAlgoBoxStatus(k, "waiting");
    const card = document.getElementById(`rc-${k}`);
    if (card) card.classList.remove("live", "done");
    const el = (id) => document.getElementById(id);
    el(`rp-${k}`).textContent     = "—";
    el(`rv-cost-${k}`).textContent  = "—";
    el(`rv-nodes-${k}`).textContent = "—";
    el(`rv-time-${k}`).textContent  = "—";
    setPill(k, "");
  }
  document.getElementById("comparePanel").classList.remove("visible");
}

function setResultStatus(algo, status) {
  const el   = document.getElementById(`rs-${algo}`);
  const card = document.getElementById(`rc-${algo}`);
  if (!el) return;
  el.className   = `rc-status status-${status}`;
  el.textContent = { waiting: "Waiting", running: "Running", done: "Done" }[status] || status;
  card.classList.toggle("live", status === "running");
  if (status === "done") card.classList.add("done");
}

function fillResultCard(algo, res, ms) {
  const pathStr = res.path.length
    ? res.path.map(i => NODES[i].name).join(" → ")
    : "No path found";
  document.getElementById(`rp-${algo}`).textContent        = pathStr;
  document.getElementById(`rv-cost-${algo}`).textContent   = res.cost === Infinity ? "∞" : res.cost;
  document.getElementById(`rv-nodes-${algo}`).textContent  = res.visited.length;
  document.getElementById(`rv-time-${algo}`).textContent   = ms;
}

/* ── Progress pills ─────────────────────────────────────── */
function setPill(algo, mode) {
  const el = document.getElementById(`pill-${algo}`);
  if (!el) return;
  el.className = "pill" + (mode ? " " + mode : "");
}

/* ── Running badge ──────────────────────────────────────── */
function showBadge(algo) {
  const badge = document.getElementById("currentAlgoBadge");
  const pip   = document.getElementById("badgePip");
  const txt   = document.getElementById("badgeText");
  pip.style.background  = ALGO_CFG[algo].color;
  pip.style.boxShadow   = `0 0 8px ${ALGO_CFG[algo].color}`;
  txt.textContent       = `Running ${ALGO_CFG[algo].name}…`;
  badge.classList.add("visible");
}
function hideBadge() {
  document.getElementById("currentAlgoBadge").classList.remove("visible");
}

/* ── Controls enable/disable ────────────────────────────── */
function setControls(mode) {
  document.getElementById("btnRun").disabled   = mode === "running";
  document.getElementById("btnPause").disabled = mode === "idle";
  const icon = document.querySelector("#btnRun .btn-icon");
  if (icon) icon.textContent = mode === "running" ? "⏳" : "▶";
}

/* ── Comparison panel ───────────────────────────────────── */
function showComparison() {
  const panel = document.getElementById("comparePanel");
  panel.classList.add("visible");
  const costs = Object.entries(appState.results)
    .filter(([, r]) => r.cost !== Infinity)
    .map(([, r]) => r.cost);
  const maxCost = Math.max(...costs, 1);

  for (const [algo, r] of Object.entries(appState.results)) {
    const row    = document.getElementById(`cmp-${algo}`);
    if (!row) continue;
    const fill   = row.querySelector(".cmp-fill");
    const valEl  = row.querySelector(".cmp-val");
    const metaEl = row.querySelector(".cmp-meta");
    const pct    = r.cost === Infinity ? 0 : (r.cost / maxCost) * 100;
    setTimeout(() => { fill.style.width = pct + "%"; }, 120);
    valEl.textContent  = r.cost === Infinity ? "∞" : r.cost;
    metaEl.textContent = `${r.visited.length} visited`;
  }
}

/* ══════════════════════════════════════════════════════════
   ORCHESTRATOR — runs all active algos sequentially
══════════════════════════════════════════════════════════ */
async function runAll() {
  if (appState.startNode === appState.endNode) return;

  appState.running = true;
  appState.paused  = false;
  appState.results = {};

  // Clear previous animation state
  for (const k of ["dijkstra", "bellman", "astar"]) {
    window.renderState.visitedNodes[k] = new Set();
    window.renderState.visitedEdges[k] = new Set();
    window.renderState.currentNode[k]  = null;
    window.renderState.finalPaths[k]   = [];
  }

  resetResultCards();
  clearStepLog();
  setControls("running");

  const queue = [
    { key: "dijkstra", fn: runDijkstra    },
    { key: "bellman",  fn: runBellmanFord },
    { key: "astar",    fn: runAstar       },
  ].filter(a => appState.activeAlgos[a.key]);

  for (const { key, fn } of queue) {
    if (!appState.running) break;

    // Visual cues
    setPill(key, "active");
    setResultStatus(key, "running");
    setAlgoBoxStatus(key, "running");
    showBadge(key);
    setStepLogAlgo(key);
    addStepSectionHeader(key, `━━ ${ALGO_CFG[key].name.toUpperCase()} ━━`);

    const t0  = performance.now();
    let res;
    try {
      res = await fn(appState.startNode, appState.endNode, appState.traffic);
    } catch (e) {
      // aborted mid-run
      break;
    }
    const ms = (performance.now() - t0).toFixed(1);

    if (!appState.running) break;

    appState.results[key] = { ...res, ms };
    fillResultCard(key, res, ms);
    setResultStatus(key, "done");
    setAlgoBoxStatus(key, "done");
    setPill(key, "done");

    // Brief pause between algos so user can see the result
    await window.algoCallbacks.sleep(500);
  }

  appState.running = false;
  hideBadge();
  setControls("idle");

  // Reset step pip
  const pip = document.getElementById("stepPip");
  if (pip) pip.classList.remove("live");

  if (Object.keys(appState.results).length) showComparison();
}

/* ══════════════════════════════════════════════════════════
   HARD RESET
══════════════════════════════════════════════════════════ */
function hardReset(full) {
  appState.running = false;
  appState.paused  = false;
  // Resume if paused
  if (window.algoCallbacks._pauseResolve) {
    window.algoCallbacks._pauseResolve();
    window.algoCallbacks._pauseResolve = null;
  }
  appState.results = {};

  for (const k of ["dijkstra", "bellman", "astar"]) {
    window.renderState.visitedNodes[k] = new Set();
    window.renderState.visitedEdges[k] = new Set();
    window.renderState.currentNode[k]  = null;
    window.renderState.finalPaths[k]   = [];
  }

  if (full) {
    appState.startNode = 0;
    appState.endNode   = 14;
    appState.traffic   = 1;
    appState.activeAlgos = { dijkstra: true, bellman: true, astar: true };

    document.getElementById("trafficSlider").value = 1;
    document.getElementById("trafficBadge").textContent = "LOW";
    document.getElementById("trafficBadge").className   = "traffic-badge tb-low";
    document.getElementById("rangeFill").style.width      = "16.5%";
    document.getElementById("rangeFill").style.background = "var(--success)";

    for (const k of ["dijkstra", "bellman", "astar"]) setAlgoBoxEnabled(k, true);
    populateSelects();
    syncRS();
  }

  hideBadge();
  resetResultCards();
  clearStepLog();
  setControls("idle");
  document.getElementById("btnPause").innerHTML = '<span class="btn-icon">⏸</span> Pause';
}

/* ══════════════════════════════════════════════════════════
   EVENT BINDINGS
══════════════════════════════════════════════════════════ */

// Node selects
document.getElementById("startSel").addEventListener("change", e => {
  appState.startNode = +e.target.value;
  syncRS(); hardReset(false);
});
document.getElementById("endSel").addEventListener("change", e => {
  appState.endNode = +e.target.value;
  syncRS(); hardReset(false);
});

// Traffic slider
document.getElementById("trafficSlider").addEventListener("input", e => {
  appState.traffic = +e.target.value;
  syncRS();
  const fill  = document.getElementById("rangeFill");
  const badge = document.getElementById("trafficBadge");
  const pct   = ((appState.traffic - 1) / 2) * 100;
  fill.style.width = `${16.5 + pct * 0.67}%`;
  if (appState.traffic === 1) {
    badge.textContent = "LOW";    badge.className = "traffic-badge tb-low";    fill.style.background = "var(--success)";
  } else if (appState.traffic === 2) {
    badge.textContent = "MEDIUM"; badge.className = "traffic-badge tb-medium"; fill.style.background = "var(--warning)";
  } else {
    badge.textContent = "HIGH";   badge.className = "traffic-badge tb-high";   fill.style.background = "var(--danger)";
  }
});

// Algorithm box toggles
document.querySelectorAll(".algo-box").forEach(el => {
  el.addEventListener("click", () => {
    if (appState.running) return;
    const k = el.dataset.algo;
    appState.activeAlgos[k] = !appState.activeAlgos[k];
    syncRS();
    setAlgoBoxEnabled(k, appState.activeAlgos[k]);
  });
});

// Speed buttons
document.querySelectorAll(".speed-btn").forEach(el => {
  el.addEventListener("click", () => {
    appState.animSpeed = +el.dataset.speed;
    document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
    el.classList.add("active");
  });
});

// Run
document.getElementById("btnRun").addEventListener("click", () => {
  if (!appState.running) runAll();
});

// Pause / Resume
document.getElementById("btnPause").addEventListener("click", () => {
  if (!appState.running) return;
  appState.paused = !appState.paused;
  const btn = document.getElementById("btnPause");
  if (appState.paused) {
    btn.innerHTML = '<span class="btn-icon">▶</span> Resume';
  } else {
    btn.innerHTML = '<span class="btn-icon">⏸</span> Pause';
    if (window.algoCallbacks._pauseResolve) {
      window.algoCallbacks._pauseResolve();
      window.algoCallbacks._pauseResolve = null;
    }
  }
});

// Reset
document.getElementById("btnReset").addEventListener("click", () => hardReset(true));

// Zoom buttons
document.getElementById("zoomIn").addEventListener("click", () => {
  window.renderState.zoom = Math.min(2.0, window.renderState.zoom + 0.15);
});
document.getElementById("zoomOut").addEventListener("click", () => {
  window.renderState.zoom = Math.max(0.4, window.renderState.zoom - 0.15);
});

// Scroll-to-zoom
const cvs = document.getElementById("mapCanvas");
cvs.addEventListener("wheel", e => {
  e.preventDefault();
  window.renderState.zoom = Math.max(0.4, Math.min(2.0, window.renderState.zoom - e.deltaY * 0.001));
}, { passive: false });

// Drag-to-pan
let drag = null;
cvs.addEventListener("mousedown", e => {
  drag = { x: e.clientX - window.renderState.panX, y: e.clientY - window.renderState.panY };
});
cvs.addEventListener("mousemove", e => {
  if (drag) {
    window.renderState.panX = e.clientX - drag.x;
    window.renderState.panY = e.clientY - drag.y;
  }
  // Tooltip
  for (const node of NODES) {
    const p = window.nodePixel(node);
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 16) {
      const tt = document.getElementById("tooltip");
      tt.style.display = "block";
      tt.textContent   = `${NODE_ICONS[node.id]} ${node.name}`;
      tt.style.left    = (e.clientX + 14) + "px";
      tt.style.top     = (e.clientY - 30) + "px";
      return;
    }
  }
  document.getElementById("tooltip").style.display = "none";
});
cvs.addEventListener("mouseup",    () => { drag = null; });
cvs.addEventListener("mouseleave", () => {
  drag = null;
  document.getElementById("tooltip").style.display = "none";
});

/* ══════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
syncRS();
populateSelects();
for (const k of ["dijkstra", "bellman", "astar"]) setAlgoBoxEnabled(k, true);
window.resizeCanvas();
window.startRenderLoop();
