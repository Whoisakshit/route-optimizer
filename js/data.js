/* ══════════════════════════════════════════════════════════
   js/data.js  — Graph nodes, edges, and adjacency builder
══════════════════════════════════════════════════════════ */
"use strict";

const NODES = [
  { id:0,  name:"Airport",       x:0.12, y:0.20 },
  { id:1,  name:"University",    x:0.30, y:0.13 },
  { id:2,  name:"Tech Park",     x:0.55, y:0.11 },
  { id:3,  name:"Mall",          x:0.79, y:0.20 },
  { id:4,  name:"Hospital",      x:0.18, y:0.46 },
  { id:5,  name:"City Center",   x:0.43, y:0.39 },
  { id:6,  name:"Stadium",       x:0.68, y:0.36 },
  { id:7,  name:"Old Town",      x:0.87, y:0.50 },
  { id:8,  name:"Bus Terminal",  x:0.10, y:0.71 },
  { id:9,  name:"Market",        x:0.32, y:0.64 },
  { id:10, name:"School",        x:0.58, y:0.62 },
  { id:11, name:"Port",          x:0.82, y:0.75 },
  { id:12, name:"Park",          x:0.22, y:0.87 },
  { id:13, name:"Museum",        x:0.50, y:0.85 },
  { id:14, name:"Station",       x:0.72, y:0.90 },
];

const NODE_ICONS = [
  "✈","🎓","💻","🛍","🏥","🏙","🏟","🏛",
  "🚌","🛒","📚","⚓","🌳","🏛","🚉"
];

// [fromId, toId, baseWeight]
const BASE_EDGES = [
  [0,1,4],[0,4,7],[1,2,5],[1,5,8],[2,3,6],[2,5,4],[3,6,5],[3,7,9],
  [4,5,6],[4,8,5],[5,6,7],[5,9,6],[6,7,4],[6,10,5],[7,11,6],
  [8,9,4],[8,12,5],[9,10,7],[9,12,6],[9,13,8],[10,11,5],[10,13,6],
  [11,14,4],[12,13,5],[13,14,6],[1,4,10],[2,6,9],[5,10,8],
];

const ALGO_CFG = {
  dijkstra: { name: "Dijkstra",     color: "#3b9eff" },
  bellman:  { name: "Bellman-Ford", color: "#ff7043" },
  astar:    { name: "A* Search",    color: "#22d3a0" },
};

const TRAFFIC_MULT = [1.0, 1.5, 2.2];

function scaledEdges(traffic) {
  const m = TRAFFIC_MULT[traffic - 1];
  return BASE_EDGES.map(([u, v, w]) => [u, v, Math.round(w * m)]);
}

function buildAdj(traffic) {
  const adj = NODES.map(() => []);
  for (const [u, v, w] of scaledEdges(traffic)) {
    adj[u].push({ to: v, w });
    adj[v].push({ to: u, w });
  }
  return adj;
}

function reconstructPath(prev, src, dst) {
  const path = [];
  let cur = dst;
  while (cur !== -1) { path.unshift(cur); cur = prev[cur]; }
  return path[0] === src ? path : [];
}

function heuristic(a, b) {
  const na = NODES[a], nb = NODES[b];
  return Math.sqrt((na.x - nb.x) ** 2 + (na.y - nb.y) ** 2) * 22;
}
