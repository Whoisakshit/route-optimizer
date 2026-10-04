/* ══════════════════════════════════════════════════════════
   js/algorithms.js  — Animated pathfinding algorithms
   Each function runs step-by-step, yielding to the render
   loop each step, and calls logStep() for the right panel.
   Depends on: data.js
══════════════════════════════════════════════════════════ */
"use strict";

/* Helpers set by ui.js */
window.algoCallbacks = {
  logStep:   () => {},   // (algo, msg, highlight) → void
  onDone:    () => {},   // (algo, result, ms) → void
  sleep:     (ms) => new Promise(r => setTimeout(r, ms)),
  getSpeed:  () => 150,
  isPaused:  () => false,
  isRunning: () => true,
};

async function waitIfPaused() {
  const cb = window.algoCallbacks;
  if (!cb.isPaused()) return;
  await new Promise(resolve => { cb._pauseResolve = resolve; });
}

async function step() {
  await waitIfPaused();
  if (!window.algoCallbacks.isRunning()) throw new Error("aborted");
  await window.algoCallbacks.sleep(window.algoCallbacks.getSpeed());
}

/* ── Shared render state accessors ─────────────────────── */
function rs() { return window.renderState; }

/* ══════════════════════════════════════════════════════════
   1. DIJKSTRA
══════════════════════════════════════════════════════════ */
async function runDijkstra(src, dst, traffic) {
  const n   = NODES.length;
  const adj = buildAdj(traffic);
  const dist = Array(n).fill(Infinity);
  const prev = Array(n).fill(-1);
  const visited = new Set();
  const log = window.algoCallbacks.logStep;

  rs().visitedNodes.dijkstra = new Set();
  rs().visitedEdges.dijkstra = new Set();
  rs().currentNode.dijkstra  = null;
  rs().finalPaths.dijkstra   = [];

  dist[src] = 0;
  const pq = [[0, src]];

  log("dijkstra", `<strong>Init:</strong> dist[${NODES[src].name}] = 0. All others = ∞`, true);
  await step();

  let stepNum = 1;
  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, u] = pq.shift();
    if (visited.has(u)) continue;
    visited.add(u);

    rs().currentNode.dijkstra = u;
    rs().visitedNodes.dijkstra.add(u);

    if (u === dst) {
      log("dijkstra", `<strong>Reached destination</strong> ${NODES[dst].name} with cost <strong>${d}</strong>`, true);
      await step();
      break;
    }

    log("dijkstra",
      `<strong>Step ${stepNum++}:</strong> Visit <strong>${NODES[u].name}</strong> (dist=${d})`,
      false
    );
    await step();

    for (const { to, w } of adj[u]) {
      const nd = dist[u] + w;
      if (nd < dist[to]) {
        dist[to] = nd;
        prev[to] = u;
        pq.push([nd, to]);
        rs().visitedEdges.dijkstra.add(`${u}-${to}`);
        log("dijkstra",
          `<em>  Relax edge → ${NODES[to].name}: new dist = ${nd}</em>`,
          false
        );
      }
    }
  }

  rs().currentNode.dijkstra = null;
  const path = reconstructPath(prev, src, dst);
  if (path.length) {
    rs().finalPaths.dijkstra = path;
    log("dijkstra",
      `<strong>Path found:</strong> ${path.map(i => NODES[i].name).join(" → ")} <em>(cost ${dist[dst]})</em>`,
      true
    );
  } else {
    log("dijkstra", `<strong>No path found</strong> from ${NODES[src].name} to ${NODES[dst].name}`, false);
  }

  return { cost: dist[dst], path, visited: [...visited] };
}

/* ══════════════════════════════════════════════════════════
   2. BELLMAN-FORD
══════════════════════════════════════════════════════════ */
async function runBellmanFord(src, dst, traffic) {
  const n     = NODES.length;
  const edges = scaledEdges(traffic).flatMap(([u, v, w]) => [[u, v, w], [v, u, w]]);
  const dist  = Array(n).fill(Infinity);
  const prev  = Array(n).fill(-1);
  dist[src]   = 0;
  const log = window.algoCallbacks.logStep;

  rs().visitedNodes.bellman = new Set([src]);
  rs().visitedEdges.bellman = new Set();
  rs().currentNode.bellman  = src;
  rs().finalPaths.bellman   = [];

  log("bellman", `<strong>Init:</strong> dist[${NODES[src].name}] = 0. Starting ${n-1} relaxation passes.`, true);
  await step();

  for (let i = 0; i < n - 1; i++) {
    let updated = false;
    log("bellman", `<strong>Pass ${i + 1} of ${n - 1}:</strong> Checking all ${edges.length} directed edges`, false);
    await step();

    for (const [u, v, w] of edges) {
      if (!window.algoCallbacks.isRunning()) throw new Error("aborted");
      if (dist[u] !== Infinity && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
        rs().visitedNodes.bellman.add(v);
        rs().visitedEdges.bellman.add(`${u}-${v}`);
        rs().currentNode.bellman = v;
        updated = true;
        log("bellman",
          `<em>  Relax ${NODES[u].name} → ${NODES[v].name}: dist = ${dist[v]}</em>`,
          false
        );
        await step();
      }
    }

    if (!updated) {
      log("bellman", `<strong>Early stop:</strong> No updates in pass ${i + 1}. Converged!`, true);
      break;
    }
  }

  rs().currentNode.bellman = null;
  const path = reconstructPath(prev, src, dst);
  if (path.length) {
    rs().finalPaths.bellman = path;
    log("bellman",
      `<strong>Path found:</strong> ${path.map(i => NODES[i].name).join(" → ")} <em>(cost ${dist[dst]})</em>`,
      true
    );
  } else {
    log("bellman", `<strong>No path found</strong>.`, false);
  }

  return { cost: dist[dst], path, visited: [...rs().visitedNodes.bellman] };
}

/* ══════════════════════════════════════════════════════════
   3. A* SEARCH
══════════════════════════════════════════════════════════ */
async function runAstar(src, dst, traffic) {
  const n   = NODES.length;
  const adj = buildAdj(traffic);
  const gS  = Array(n).fill(Infinity);
  const fS  = Array(n).fill(Infinity);
  const prev = Array(n).fill(-1);
  const closed = new Set();
  const log = window.algoCallbacks.logStep;

  rs().visitedNodes.astar = new Set();
  rs().visitedEdges.astar = new Set();
  rs().currentNode.astar  = null;
  rs().finalPaths.astar   = [];

  gS[src] = 0;
  fS[src] = heuristic(src, dst);
  const open = [[fS[src], src]];

  log("astar",
    `<strong>Init:</strong> g(${NODES[src].name})=0, h=<em>${heuristic(src,dst).toFixed(1)}</em>, f=${fS[src].toFixed(1)}`,
    true
  );
  await step();

  let stepNum = 1;
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [f, u] = open.shift();
    if (closed.has(u)) continue;
    closed.add(u);

    rs().currentNode.astar = u;
    rs().visitedNodes.astar.add(u);

    if (u === dst) {
      log("astar", `<strong>Destination reached!</strong> ${NODES[dst].name}, f=${f.toFixed(1)}`, true);
      await step();
      break;
    }

    log("astar",
      `<strong>Step ${stepNum++}:</strong> Expand <strong>${NODES[u].name}</strong> — f=${f.toFixed(1)}, g=${gS[u].toFixed(1)}, h=${heuristic(u,dst).toFixed(1)}`,
      false
    );
    await step();

    for (const { to, w } of adj[u]) {
      if (closed.has(to)) continue;
      const tg = gS[u] + w;
      if (tg < gS[to]) {
        prev[to] = u;
        gS[to]   = tg;
        fS[to]   = tg + heuristic(to, dst);
        open.push([fS[to], to]);
        rs().visitedEdges.astar.add(`${u}-${to}`);
        log("astar",
          `<em>  ${NODES[to].name}: g=${tg}, h=${heuristic(to,dst).toFixed(1)}, f=${fS[to].toFixed(1)}</em>`,
          false
        );
      }
    }
  }

  rs().currentNode.astar = null;
  const path = reconstructPath(prev, src, dst);
  if (path.length) {
    rs().finalPaths.astar = path;
    log("astar",
      `<strong>Path found:</strong> ${path.map(i => NODES[i].name).join(" → ")} <em>(cost ${gS[dst].toFixed(0)})</em>`,
      true
    );
  } else {
    log("astar", `<strong>No path found.</strong>`, false);
  }

  return { cost: gS[dst], path, visited: [...closed] };
}
