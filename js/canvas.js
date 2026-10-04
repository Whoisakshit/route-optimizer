/* ══════════════════════════════════════════════════════════
   js/canvas.js  — Map rendering (background, edges, nodes)
   Depends on: data.js
══════════════════════════════════════════════════════════ */
"use strict";

const canvas = document.getElementById("mapCanvas");
const ctx    = canvas.getContext("2d");

/* shared render state (written by ui.js, read here) */
window.renderState = {
  zoom: 1.0, panX: 0, panY: 0,
  startNode: 0, endNode: 14, traffic: 1,
  visitedNodes: {}, visitedEdges: {},
  currentNode: {}, finalPaths: {},
  activeAlgos: { dijkstra: true, bellman: true, astar: true },
};

/* ── Resize ─────────────────────────────────────────────── */
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}
window.addEventListener("resize", resizeCanvas);

/* ── Coordinate helper ──────────────────────────────────── */
function nodePixel(node) {
  const rs = window.renderState;
  const cx = canvas.width  / 2 + rs.panX;
  const cy = canvas.height / 2 + rs.panY;
  return {
    x: cx + (node.x - 0.5) * canvas.width  * rs.zoom,
    y: cy + (node.y - 0.5) * canvas.height * rs.zoom,
  };
}
window.nodePixel = nodePixel; // expose for ui.js tooltip

/* ── Main draw ──────────────────────────────────────────── */
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  drawBackground(W, H);
  drawGridTexture(W, H);
  drawBaseEdges();
  drawAlgoLayers();
  drawNodes();
}
window.draw = draw;

/* ── Background ─────────────────────────────────────────── */
function drawBackground(W, H) {
  const bg = ctx.createRadialGradient(W * .5, H * .4, 0, W * .5, H * .5, Math.max(W, H) * .8);
  bg.addColorStop(0,   "#1e2638");
  bg.addColorStop(0.5, "#181e2c");
  bg.addColorStop(1,   "#121722");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // District zones (subtle city blocks)
  const zones = [
    { x:.15, y:.30, w:.22, h:.28, r:40 },
    { x:.38, y:.25, w:.30, h:.34, r:50 },
    { x:.68, y:.32, w:.24, h:.38, r:45 },
    { x:.10, y:.62, w:.28, h:.25, r:35 },
    { x:.42, y:.70, w:.32, h:.22, r:40 },
  ];
  for (const z of zones) {
    ctx.beginPath();
    ctx.roundRect(z.x * W - (z.w * W) / 2, z.y * H - (z.h * H) / 2, z.w * W, z.h * H, z.r);
    ctx.fillStyle = "rgba(255,255,255,0.018)";
    ctx.fill();
  }
}

function drawGridTexture(W, H) {
  // Minor grid (city blocks)
  ctx.strokeStyle = "rgba(255,255,255,0.028)";
  ctx.lineWidth = .5;
  for (let x = 0; x < W; x += 36) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 36) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Major grid (arterials)
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = .7;
  for (let x = 0; x < W; x += 144) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 144) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

/* ── Base edges ─────────────────────────────────────────── */
function drawBaseEdges() {
  const edges = scaledEdges(window.renderState.traffic);
  for (const [u, v, w] of edges) {
    const p1 = nodePixel(NODES[u]), p2 = nodePixel(NODES[v]);
    // Road casing
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.stroke();
    // Road surface
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = "rgba(255,255,255,0.11)";
    ctx.lineWidth = 2.5; ctx.stroke();
    // Weight label
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.font = "9px 'DM Mono',monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(w, mx, my - 5);
  }
}

/* ── Algorithm visualization layers ───────────────────────── */
function drawAlgoLayers() {
  const rs    = window.renderState;
  const order = ["dijkstra", "bellman", "astar"];

  for (const algo of order) {
    if (!rs.activeAlgos[algo]) continue;
    const color = ALGO_CFG[algo].color;
    const edges = scaledEdges(rs.traffic);

    // Visited edges (explored frontier)
    const visitedEdgesSet = rs.visitedEdges[algo] || new Set();
    for (const [u, v] of edges) {
      if (!visitedEdgesSet.has(`${u}-${v}`) && !visitedEdgesSet.has(`${v}-${u}`)) continue;
      const p1 = nodePixel(NODES[u]), p2 = nodePixel(NODES[v]);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = color + "60";
      ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.stroke();
    }

    // Final shortest path (glowing)
    const fp = rs.finalPaths[algo] || [];
    if (fp.length > 1) {
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = 18;
      ctx.beginPath();
      fp.forEach((id, i) => {
        const pos = nodePixel(NODES[id]);
        i === 0 ? ctx.moveTo(pos.x, pos.y) : ctx.lineTo(pos.x, pos.y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = 4.5;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
      ctx.restore();
    }
  }

  // Visited node halos
  for (const algo of order) {
    if (!rs.activeAlgos[algo]) continue;
    const color = ALGO_CFG[algo].color;
    const visitedSet = rs.visitedNodes[algo] || new Set();
    for (const nid of visitedSet) {
      if (nid === rs.startNode || nid === rs.endNode) continue;
      const pos = nodePixel(NODES[nid]);
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = color + "25"; ctx.fill();
      ctx.strokeStyle = color + "50"; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  // Current node pulse (animated ring)
  for (const algo of order) {
    const curId = rs.currentNode[algo];
    if (curId === undefined || curId === null) continue;
    if (!rs.activeAlgos[algo]) continue;
    const color = ALGO_CFG[algo].color;
    const pos   = nodePixel(NODES[curId]);
    const t     = Date.now() / 280;
    const pulse = 13 + Math.sin(t) * 4;
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 28;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }
}

/* ── Nodes ──────────────────────────────────────────────── */
function drawNodes() {
  const rs = window.renderState;
  for (const node of NODES) {
    const pos     = nodePixel(node);
    const isStart = node.id === rs.startNode;
    const isEnd   = node.id === rs.endNode;
    const r       = isStart || isEnd ? 16 : 12;

    // Glow halo
    const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 2.8);
    if (isStart) {
      grd.addColorStop(0, "rgba(34,211,160,0.38)");
      grd.addColorStop(1, "rgba(34,211,160,0)");
    } else if (isEnd) {
      grd.addColorStop(0, "rgba(255,71,87,0.38)");
      grd.addColorStop(1, "rgba(255,71,87,0)");
    } else {
      grd.addColorStop(0, "rgba(255,255,255,0.07)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
    }
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 2.8, 0, Math.PI * 2); ctx.fill();

    // Node circle
    ctx.save();
    ctx.shadowColor = isStart ? "#22d3a0" : isEnd ? "#ff4757" : "#000";
    ctx.shadowBlur  = isStart || isEnd ? 20 : 7;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    if (isStart)      { ctx.fillStyle = "rgba(34,211,160,0.22)"; ctx.strokeStyle = "#22d3a0"; }
    else if (isEnd)   { ctx.fillStyle = "rgba(255,71,87,0.22)";  ctx.strokeStyle = "#ff4757"; }
    else              { ctx.fillStyle = "rgba(28,34,52,0.92)";   ctx.strokeStyle = "rgba(255,255,255,0.17)"; }
    ctx.lineWidth = isStart || isEnd ? 2.5 : 1.5;
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Icon
    ctx.font = `${r * 0.88}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = isStart ? "#22d3a0" : isEnd ? "#ff4757" : "rgba(255,255,255,0.48)";
    ctx.fillText(NODE_ICONS[node.id] || "•", pos.x, pos.y);

    // Label pill
    ctx.font = `${isStart || isEnd ? 600 : 400} ${isStart || isEnd ? 11 : 10}px 'DM Sans',sans-serif`;
    const lw = ctx.measureText(node.name).width + 10;
    const lx = pos.x - lw / 2, ly = pos.y + r + 4;
    ctx.fillStyle = "rgba(8,11,20,0.75)";
    ctx.beginPath(); ctx.roundRect(lx, ly, lw, 14, 4); ctx.fill();
    ctx.fillStyle = isStart ? "#22d3a0" : isEnd ? "#ff4757" : "rgba(255,255,255,0.5)";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(node.name, pos.x, ly + 2);
  }
}

/* ── Render loop ────────────────────────────────────────── */
let _raf = null;
function startRenderLoop() {
  if (_raf) cancelAnimationFrame(_raf);
  (function loop() { draw(); _raf = requestAnimationFrame(loop); })();
}
window.startRenderLoop = startRenderLoop;
window.resizeCanvas    = resizeCanvas;
