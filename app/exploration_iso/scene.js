const WIDTH = 1920;
const HEIGHT = 1080;

let grid = null;
let collisionCells = [];
let traversableCells = new Set();
let blockedCells = new Set();
let heroCell = null;
let lightPoint = null;
let lightAnimation = null;

const reachable = document.querySelector("#reachable");
const debug = document.querySelector("#debug");
const stage = document.querySelector("#stage");
const hero = document.querySelector("#hero");
const debugToggle = document.querySelector("#toggle-debug");
const reachableToggle = document.querySelector("#toggle-reachable");
const darknessToggle = document.querySelector("#toggle-darkness");

debugToggle.addEventListener("change", () => {
  stage.classList.toggle("debug-on", debugToggle.checked);
});

reachableToggle.addEventListener("change", () => {
  stage.classList.toggle("reachable-on", reachableToggle.checked);
});

darknessToggle.addEventListener("change", () => {
  stage.classList.toggle("darkness-on", darknessToggle.checked);
});

init();

stage.addEventListener("click", (event) => {
  if (!grid) return;
  const cell = eventToCell(event);
  if (!isWalkable(cell.x, cell.y)) return;
  heroCell = cell;
  placeHero(heroCell);
});

window.addEventListener("keydown", (event) => {
  if (!grid) return;
  const dir = keyToDir(event.key);
  if (!dir) return;
  event.preventDefault();
  const next = { x: heroCell.x + dir.x, y: heroCell.y + dir.y };
  if (!isWalkable(next.x, next.y)) return;
  heroCell = next;
  placeHero(heroCell);
});

async function init() {
  const area = await fetch("./greyharbour_dock_gridfirst/greyharbour_dock_gridfirst.area.json").then((res) => {
    if (!res.ok) throw new Error(`Failed to load greyharbour_dock_gridfirst.area.json: ${res.status}`);
    return res.json();
  });

  grid = {
    width: area.grid.width,
    height: area.grid.height,
    tileWidth: area.grid.tileWidth,
    tileHeight: area.grid.tileHeight,
    origin: area.grid.origin,
    xAxis: { x: area.grid.tileWidth / 2, y: area.grid.tileHeight / 2 },
    yAxis: { x: -area.grid.tileWidth / 2, y: area.grid.tileHeight / 2 },
  };

  collisionCells = area.collision?.cells || [];
  traversableCells = new Set(
    collisionCells
      .filter((cell) => ["walkable", "difficult", "trigger-only", "transition", "stairs", "elevation"].includes(cell.state))
      .map((cell) => key(cell.x, cell.y))
  );
  blockedCells = new Set(
    collisionCells
      .filter((cell) => cell.state === "blocked")
      .map((cell) => key(cell.x, cell.y))
  );

  heroCell = area.playerStart || { x: 0, y: 0 };
  lightPoint = projectCellCenter(heroCell);
  renderReachable();
  renderDebug();
  placeHero(heroCell, true);
}

function renderDebug() {
  debug.replaceChildren();
  if (!grid) return;

  for (let x = 0; x <= grid.width; x += 1) {
    line(debug, project({ x, y: 0 }), project({ x, y: grid.height }), "rgba(142, 242, 176, 0.34)", 1.2);
  }
  for (let y = 0; y <= grid.height; y += 1) {
    line(debug, project({ x: 0, y }), project({ x: grid.width, y }), "rgba(142, 242, 176, 0.34)", 1.2);
  }

  forEachCell((x, y) => {
    const points = cellPolygon({ x, y });
    if (blockedCells.has(key(x, y))) {
      polygon(debug, points, "rgba(255, 70, 60, 0.28)", "rgba(255, 70, 60, 0.82)", 1.8);
    }
  });
}

function renderReachable() {
  reachable.replaceChildren();
  if (!grid) return;

  forEachCell((x, y) => {
    if (!isWalkable(x, y)) return;
    polygon(reachable, cellPolygon({ x, y }), "rgba(100, 218, 132, 0.14)", "rgba(100, 218, 132, 0.34)", 1.2, "reachable-cell");
  });
}

function placeHero(cell, immediate = false) {
  const p = projectCellCenter(cell);
  hero.style.zIndex = String(Math.round(p.y + 200));
  if (immediate) hero.style.transition = "none";
  hero.style.left = `${p.x / WIDTH * 100}%`;
  hero.style.top = `${p.y / HEIGHT * 100}%`;
  moveLightTo(p, immediate);
  hero.classList.remove("walking");
  requestAnimationFrame(() => {
    if (immediate) hero.style.transition = "";
    hero.classList.add("walking");
  });
}

function moveLightTo(target, immediate = false) {
  if (lightAnimation) cancelAnimationFrame(lightAnimation);

  if (immediate) {
    lightPoint = { ...target };
    setLightVars(lightPoint);
    return;
  }

  const from = { ...lightPoint };
  const duration = 360;
  const started = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - started) / duration);
    const eased = easeInOutCubic(t);
    lightPoint = {
      x: from.x + (target.x - from.x) * eased,
      y: from.y + (target.y - from.y) * eased,
    };
    setLightVars(lightPoint);
    if (t < 1) lightAnimation = requestAnimationFrame(tick);
  }

  lightAnimation = requestAnimationFrame(tick);
}

function setLightVars(point) {
  stage.style.setProperty("--lanterna-x", `${point.x / WIDTH * 100}%`);
  stage.style.setProperty("--lanterna-y", `${point.y / HEIGHT * 100}%`);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function eventToCell(event) {
  const rect = stage.getBoundingClientRect();
  const point = {
    x: (event.clientX - rect.left) / rect.width * WIDTH,
    y: (event.clientY - rect.top) / rect.height * HEIGHT,
  };
  const gridPoint = screenToGrid(point);
  return {
    x: Math.floor(gridPoint.x),
    y: Math.floor(gridPoint.y),
  };
}

function keyToDir(key) {
  const k = key.toLowerCase();
  if (k === "arrowright" || k === "d") return { x: 1, y: 0 };
  if (k === "arrowleft" || k === "a") return { x: -1, y: 0 };
  if (k === "arrowdown" || k === "s") return { x: 0, y: 1 };
  if (k === "arrowup" || k === "w") return { x: 0, y: -1 };
  if (k === "e") return { x: 1, y: -1 };
  if (k === "q") return { x: -1, y: 1 };
  return null;
}

function isWalkable(x, y) {
  return traversableCells.has(key(x, y));
}

function forEachCell(fn) {
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      fn(x, y);
    }
  }
}

function project(point) {
  return {
    x: grid.origin.x + point.x * grid.xAxis.x + point.y * grid.yAxis.x,
    y: grid.origin.y + point.x * grid.xAxis.y + point.y * grid.yAxis.y,
  };
}

function projectCellCenter(cell) {
  return project({ x: cell.x + 0.5, y: cell.y + 0.5 });
}

function cellPolygon(cell) {
  return [
    project({ x: cell.x, y: cell.y }),
    project({ x: cell.x + 1, y: cell.y }),
    project({ x: cell.x + 1, y: cell.y + 1 }),
    project({ x: cell.x, y: cell.y + 1 }),
  ];
}

function screenToGrid(point) {
  const px = point.x - grid.origin.x;
  const py = point.y - grid.origin.y;
  const det = grid.xAxis.x * grid.yAxis.y - grid.xAxis.y * grid.yAxis.x;
  return {
    x: (px * grid.yAxis.y - py * grid.yAxis.x) / det,
    y: (py * grid.xAxis.x - px * grid.xAxis.y) / det,
  };
}

function polygon(svg, points, fill, stroke = "none", strokeWidth = 0, className = "") {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  el.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
  el.setAttribute("fill", fill);
  el.setAttribute("stroke", stroke);
  el.setAttribute("stroke-width", String(strokeWidth));
  if (className) el.setAttribute("class", className);
  svg.appendChild(el);
}

function path(svg, d, fill, stroke = "none", strokeWidth = 0) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  el.setAttribute("fill", fill);
  el.setAttribute("stroke", stroke);
  el.setAttribute("stroke-width", String(strokeWidth));
  svg.appendChild(el);
}

function rect(svg, x, y, width, height, fill) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  el.setAttribute("x", String(x));
  el.setAttribute("y", String(y));
  el.setAttribute("width", String(width));
  el.setAttribute("height", String(height));
  el.setAttribute("fill", fill);
  svg.appendChild(el);
}

function line(svg, from, to, stroke, strokeWidth) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
  el.setAttribute("x1", String(from.x));
  el.setAttribute("y1", String(from.y));
  el.setAttribute("x2", String(to.x));
  el.setAttribute("y2", String(to.y));
  el.setAttribute("stroke", stroke);
  el.setAttribute("stroke-width", String(strokeWidth));
  el.setAttribute("vector-effect", "non-scaling-stroke");
  svg.appendChild(el);
}

function key(x, y) {
  return `${x},${y}`;
}
