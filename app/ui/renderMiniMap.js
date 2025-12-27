// app/ui/renderMiniMap.js
// Small SVG “graph minimap” renderer.
//
// Design intent (150x150-ish):
// - Current node: glowing dot + label
// - Known nodes (visited): 50% opacity dot + label
// - Unknown nodes (unvisited but adjacent): no dot (or very faint) + label at ~25%
// - Links to unknown: line fades out at 50% length
// - Links to known: solid, lightly pulsing
//
// This module is UI-only. It does not mutate state.

import { getMiniMapLayout } from "./MiniMapLayouts.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function _el(tag, attrs = {}, children = []) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    n.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null) continue;
    n.appendChild(c);
  }
  return n;
}

function _clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function _clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function _key(a, b) {
  return `${a}__${b}`;
}

function _getVisitedAreas(mapState) {
  const v = mapState?.visitedAreas;
  return v && typeof v === "object" ? v : {};
}

function _gridToPx([gx, gy], cx, cy, step) {
  return [cx + gx * step, cy + gy * step];
}

function _makeGradient(id, strokeOpacity = 0.26) {
  // Fade after 50% length.
  return _el("linearGradient", { id, x1: "0", y1: "0", x2: "1", y2: "0" }, [
    _el("stop", { offset: "0%", "stop-color": "currentColor", "stop-opacity": String(strokeOpacity) }),
    _el("stop", { offset: "50%", "stop-color": "currentColor", "stop-opacity": String(strokeOpacity) }),
    _el("stop", { offset: "100%", "stop-color": "currentColor", "stop-opacity": "0" })
  ]);
}

function _formatLabel(id) {
  // Sentence case-ish: keep as-is if already has caps.
  if (!id) return "";
  const s = String(id);
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function _ensureDefs(svg) {
  const defs = _el("defs");

  // Soft glow for current node.
  const filter = _el("filter", { id: "mmGlow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, [
    _el("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "2", result: "blur" }),
    _el("feMerge", {}, [
      _el("feMergeNode", { in: "blur" }),
      _el("feMergeNode", { in: "SourceGraphic" })
    ])
  ]);

  // Animation for known links (subtle).
  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = `
    .mm-root { color: rgba(235, 240, 255, 0.16); opacity: 0.82; filter: blur(1.8px); animation: mmAleatory 4.8s ease-in-out infinite; }

    .mm-link-known { opacity: 0.41; }
    .mm-link-known.mm-pulse { animation: mmPulse 2.2s ease-in-out infinite; }
    @keyframes mmPulse { 0% { opacity: 0.26; } 50% { opacity: 0.52; } 100% { opacity: 0.26; } }
    @keyframes mmAleatory {
      0%   { opacity: 0.82; transform: translate(0px, 0px); }
      13%  { opacity: 0.72; transform: translate(0.6px, -0.4px); }
      27%  { opacity: 0.86; transform: translate(-0.4px, 0.5px); }
      41%  { opacity: 0.76; transform: translate(0.3px, 0.2px); }
      58%  { opacity: 0.90; transform: translate(-0.6px, -0.2px); }
      73%  { opacity: 0.74; transform: translate(0.4px, 0.6px); }
      89%  { opacity: 0.88; transform: translate(-0.2px, -0.5px); }
      100% { opacity: 0.82; transform: translate(0px, 0px); }
    }

    .mm-node-known { opacity: 0.26; }

    .mm-label { font-size: 8px; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; fill: currentColor; }
    .mm-label-current { opacity: 0.45; }
  `;

  defs.appendChild(filter);
  defs.appendChild(style);
  svg.appendChild(defs);

  return defs;
}

function _computeNodesToRender(currentAreaId, nextAreas, layout) {
  const nodes = new Set();
  nodes.add(currentAreaId);
  for (const a of (nextAreas || [])) nodes.add(a);
  // If layout includes extra nodes, include them too (safe).
  if (layout && typeof layout === "object") {
    for (const k of Object.keys(layout)) nodes.add(k);
  }
  return Array.from(nodes);
}

function _defaultLayoutFor(currentAreaId, nextAreas) {
  // Fallback if no layout exists: place current at [0,0], then fan out.
  const out = { [currentAreaId]: [0, 0] };
  const dirs = [ [0,-1], [1,0], [0,1], [-1,0] ];
  let i = 0;
  for (const a of (nextAreas || [])) {
    out[a] = dirs[i % dirs.length];
    i++;
  }
  return out;
}

/**
 * Render the minimap into a container.
 *
 * @param {Object} opts
 * @param {string} opts.currentAreaId
 * @param {string[]} [opts.nextAreas]
 * @param {Object} [opts.mapState] - expects shape { visitedAreas: { [areaId]: true } }
 * @param {HTMLElement|string} [opts.container] - element or selector. Defaults to '#minimap'.
 * @param {number} [opts.size] - pixels. Defaults 150.
 */
export function renderMiniMap(opts) {
  const currentAreaId = opts?.currentAreaId;
  if (!currentAreaId) return;

  const nextAreas = Array.isArray(opts?.nextAreas) ? opts.nextAreas : [];
  const visited = _getVisitedAreas(opts?.mapState);
  const hasAnyVisitedNeighbor = nextAreas.some((a) => Boolean(visited[a]));

  const container = typeof opts?.container === "string"
    ? document.querySelector(opts.container)
    : (opts?.container || document.querySelector("#minimap"));

  if (!container) return;

  const size = _clamp(Number(opts?.size ?? 150) || 150, 90, 260);
  const cx = size / 2;
  const cy = size / 2;
  const step = Math.round(size * 0.40); // 25% larger spacing within 150px

  // Layout: prefer generated layouts.
  const layout = getMiniMapLayout(currentAreaId) || _defaultLayoutFor(currentAreaId, nextAreas);

  // Choose a label position for the *current* node that avoids link directions.
  const _curGrid = layout[currentAreaId] || [0, 0];
  const _blocked = new Set();
  for (const a of nextAreas) {
    const g = layout[a];
    if (!g) continue;
    const dx = g[0] - _curGrid[0];
    const dy = g[1] - _curGrid[1];
    if (dx > 0) _blocked.add("E");
    if (dx < 0) _blocked.add("W");
    if (dy > 0) _blocked.add("S");
    if (dy < 0) _blocked.add("N");
  }
  const _labelPref = ["N", "S", "E", "W"];
  const _labelDir = _labelPref.find((d) => !_blocked.has(d)) || "S";

  // Build svg
  const svg = _el("svg", {
    width: String(size),
    height: String(size),
    viewBox: `${-12} ${-12} ${size + 24} ${size + 24}`,
    role: "img",
    "aria-label": "Minimap",
    class: "mm-root"
  });

  const defs = _ensureDefs(svg);

  // Gradients for unknown links (we orient each link individually via gradientUnits=userSpaceOnUse).
  const gradients = new Map();

  const nodes = _computeNodesToRender(currentAreaId, nextAreas, layout);

  // Links: from current -> each nextArea
  for (const dest of nextAreas) {
    const aGrid = layout[currentAreaId] || [0, 0];
    const bGrid = layout[dest];
    if (!bGrid) continue;

    const [ax, ay] = _gridToPx(aGrid, cx, cy, step);
    const [bx, by] = _gridToPx(bGrid, cx, cy, step);

    const destVisited = Boolean(visited[dest]);

    if (!destVisited) {
      // If we already have at least one visited neighbor, hide unknown-link fades to reduce clutter.
      if (hasAnyVisitedNeighbor) continue;
      // Unknown: gradient fade from start->end.
      const gid = `mmFade_${_key(currentAreaId, dest)}`;
      if (!gradients.has(gid)) {
        const g = _makeGradient(gid, 0.34);
        // set in user space to align line direction
        g.setAttribute("gradientUnits", "userSpaceOnUse");
        g.setAttribute("x1", String(ax));
        g.setAttribute("y1", String(ay));
        g.setAttribute("x2", String(bx));
        g.setAttribute("y2", String(by));
        defs.appendChild(g);
        gradients.set(gid, true);
      }

      svg.appendChild(_el("line", {
        x1: ax, y1: ay, x2: bx, y2: by,
        stroke: `url(#${gid})`,
        "stroke-width": "2.5",
        "stroke-linecap": "round"
      }));
    } else {
      // Known: solid + subtle pulse
      svg.appendChild(_el("line", {
        x1: ax, y1: ay, x2: bx, y2: by,
        stroke: "currentColor",
        "stroke-width": "2.5",
        "stroke-linecap": "round",
        class: "mm-link-known mm-pulse"
      }));
    }
  }

  // Nodes + labels
  for (const id of nodes) {
    const g = layout[id];
    if (!g) continue;
    const [x, y] = _gridToPx(g, cx, cy, step);

    const isCurrent = id === currentAreaId;
    const isKnown = isCurrent || Boolean(visited[id]);

    // Node circle
    if (isCurrent) {
      svg.appendChild(_el("circle", {
        cx: x, cy: y, r: "6.25",
        fill: "rgba(235, 240, 255, 0.64)",
        filter: "url(#mmGlow)"
      }));
    } else if (isKnown) {
      svg.appendChild(_el("circle", {
        cx: x, cy: y, r: "5",
        fill: "rgba(235, 240, 255, 0.41)",
        class: "mm-node-known"
      }));
    } else {
      // Unknown node: no circle (keeps it clean). If you want a hint-dot later, add it here.
    }

    // Labels intentionally omitted (screen title provides location).
  }

  // Mount
  _clear(container);

  // Hover-zoom (inspection): scale the minimap to 300% while hovered.
  if (!container.dataset.mmHoverZoomBound) {
    container.dataset.mmHoverZoomBound = "1";
    container.style.pointerEvents = "auto";
    container.style.transition = "transform 220ms ease-out, opacity 220ms ease-out";
    container.style.transformOrigin = "top right";

    container.addEventListener("mouseenter", () => {
      container.style.transform = "scale(3)";
      container.style.opacity = "0.95";
    });

    container.addEventListener("mouseleave", () => {
      container.style.transform = "";
      container.style.opacity = "";
    });
  }

  container.appendChild(svg);
}

export default renderMiniMap;